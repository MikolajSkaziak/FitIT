using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Weather;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Styling;

/// <summary>
/// The answer to "what should I wear": either up to three stored proposals, best first, or the roles the wardrobe
/// lacks for this weather and occasion (then <see cref="Outfits"/> is empty and nothing was counted). <see cref="Missing"/>
/// are roles that are each required, <see cref="MissingEither"/> roles of which any one would do.
/// </summary>
public sealed record Suggestions(
    PersonalWeather Weather,
    Occasion Occasion,
    IReadOnlyList<Category> Missing,
    IReadOnlyList<Category> MissingEither,
    IReadOnlyList<Relaxation> Relaxations,
    bool Umbrella,
    bool Fallback,
    IReadOnlyList<OutfitView> Outfits);

/// <summary>
/// The stylist of product spec 6.1, end to end: context, candidate filter, the model's choice, validation and scoring,
/// one retry with the list of errors, and the rule-based fallback when the model cannot be used.
/// </summary>
public sealed class StylistService(
    AppDbContext db,
    WeatherService weather,
    IOutfitStylist stylist,
    OutfitService outfits,
    UsageCounters usage,
    AiLedger ledger,
    AppClock clock,
    PersonalCalendar calendar,
    ILogger<StylistService> logger)
{
    public static readonly ApiError BaseItemInvalid =
        ApiError.BadRequest("base_item_invalid", "The garment to build around must be a described garment from this wardrobe.");

    /// <summary>
    /// The picks of the person's day for an occasion, as the Today tab shows them: the newest set made for today, or a new
    /// one when there is none yet or a <paramref name="fresh"/> one is asked for. Making a set is an ordinary request, counted
    /// against the day's limit. A lock per person and occasion makes requests that arrive together wait for one another,
    /// so the app opened twice at once still pays for one set.
    /// </summary>
    public async Task<Result<Suggestions>> TodayAsync(Guid userId, Occasion occasion, bool fresh, CancellationToken cancellationToken)
    {
        var key = $"daily-picks:{userId:N}:{EnumCodes.ToCode(occasion)}";
        // The lock belongs to the connection, so the connection stays open until it is given back.
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_lock(hashtextextended({key}, 0))", cancellationToken);
            try
            {
                if (!fresh && await KeptTodayAsync(userId, occasion, cancellationToken) is { } kept)
                {
                    return kept;
                }

                return await SuggestAsync(userId, occasion, null, null, cancellationToken, daily: true);
            }
            finally
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock(hashtextextended({key}, 0))", CancellationToken.None);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    /// <summary>Today's newest stored picks for the occasion with the weather as it is now; null when there are none, or an error when the weather cannot be told.</summary>
    private async Task<Result<Suggestions>?> KeptTodayAsync(Guid userId, Occasion occasion, CancellationToken cancellationToken)
    {
        var day = (await calendar.OfAsync(userId, cancellationToken)).Today;
        var mine = db.Outfits.AsNoTracking().Include(outfit => outfit.Items)
            .Where(outfit => outfit.UserId == userId && outfit.Occasion == occasion && outfit.DailyOn == day);
        var newest = await mine.OrderByDescending(outfit => outfit.CreatedAt).ThenByDescending(outfit => outfit.RequestId)
            .Select(outfit => (Guid?)outfit.RequestId).FirstOrDefaultAsync(cancellationToken);
        if (newest is null)
        {
            return null;
        }

        var forecast = await weather.TodayAsync(userId, cancellationToken);
        if (!forecast.IsOk)
        {
            return forecast.Error!;
        }

        var kept = await mine.Where(outfit => outfit.RequestId == newest).OrderBy(outfit => outfit.Id).ToListAsync(cancellationToken);
        return new Suggestions(
            forecast.Value, occasion, [], [], [.. kept[0].Relaxations.Select(Outfit.ParseRelaxation)], kept[0].Umbrella,
            kept.All(outfit => outfit.Source == OutfitSource.Rules), await outfits.ViewAsync(kept, cancellationToken));
    }

    public async Task<Result<Suggestions>> SuggestAsync(
        Guid userId, Occasion occasion, string? note, Guid? baseItemId, CancellationToken cancellationToken, bool daily = false)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(found => found.Id == userId, cancellationToken);
        if (user is null)
        {
            return ApiError.NotFound();
        }

        var today = await calendar.OfAsync(userId, cancellationToken);
        var wardrobe = await WardrobeAsync(userId, today, cancellationToken);
        if (baseItemId is { } wanted && wardrobe.All(garment => garment.Id != wanted))
        {
            return BaseItemInvalid;
        }

        if (user.Place is not { } place)
        {
            return Core.Weather.WeatherErrors.NoPlace;
        }

        var forecast = await weather.AtAsync(place, user.ThermalPreference, cancellationToken);
        if (!forecast.IsOk)
        {
            return forecast.Error!;
        }

        var candidates = CandidateFilter.Select(wardrobe, forecast.Value.Profile, occasion, baseItemId);
        if (!candidates.IsComplete)
        {
            // Nothing was proposed, so nothing is taken from the day's allowance and the model is not asked.
            return new Suggestions(forecast.Value, occasion, candidates.Missing, candidates.MissingEither, candidates.Relaxations, candidates.Umbrella, Fallback: false, []);
        }

        if (!await usage.TryTakeAsync(userId, UsageKind.Suggestion, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.Suggestion, cancellationToken);
        }

        try
        {
            note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            var styling = new StylingCase(
                forecast.Value.Profile,
                occasion,
                note,
                [.. user.StylePreferences.Select(EnumCodes.Parse<StyleTag>)],
                user.ThermalPreference,
                candidates,
                await HistoryAsync(userId, today, cancellationToken),
                user.ColorAnalysis is { } colors ? [.. colors.Best.Select(swatch => swatch.Name.ToLowerInvariant())] : null);

            var run = await ComposeAsync(userId, styling, cancellationToken);
            var proposals = run.Proposals;
            if (proposals.Count == 0)
            {
                throw new InvalidOperationException("A complete set of candidates produced no outfit.");
            }

            var requestId = Guid.CreateVersion7();
            var now = clock.UtcNow;
            // Best score first. The ids rise in that order (their leading bits are a timestamp), so a list sorted by id
            // shows the proposals of one request the way they were first shown.
            var stored = proposals.OrderByDescending(proposal => proposal.Score).Select((proposal, rank) => new Outfit
            {
                Id = Guid.CreateVersion7(now.AddMilliseconds(rank)),
                UserId = userId,
                RequestId = requestId,
                Occasion = occasion,
                OccasionNote = note,
                Weather = WeatherSnapshot.Of(place.Name, styling.Weather),
                Relaxations = [.. candidates.Relaxations.Select(Outfit.RelaxationCode)],
                Umbrella = candidates.Umbrella,
                Source = run.Fallback ? OutfitSource.Rules : OutfitSource.Model,
                Kind = proposal.Kind,
                Score = proposal.Score,
                Reasoning = proposal.Reasoning,
                WeatherNote = proposal.WeatherNote,
                PromptVersion = run.Fallback ? null : stylist.PromptVersion,
                Model = run.Model,
                CreatedAt = now,
                DailyOn = daily ? today.Today : null,
                Items = [.. proposal.Outfit.Items.Select(garment => new OutfitItem { ClothingItemId = garment.Id, Slot = garment.Role })],
            }).ToList();
            db.Outfits.AddRange(stored);
            await db.SaveChangesAsync(cancellationToken);

            return new Suggestions(
                forecast.Value, occasion, [], [], candidates.Relaxations, candidates.Umbrella, run.Fallback, await outfits.ViewAsync(stored, cancellationToken));
        }
        catch
        {
            // The person got nothing for it: the request does not count against the day's limit.
            await usage.RefundAsync(userId, UsageKind.Suggestion, today.Today, CancellationToken.None);
            throw;
        }
    }

    /// <summary>
    /// Asks the model, or the rules when the day's AI budget is used up, and writes every call to the usage log. The rules
    /// take over when the model failed, did not answer in time, refused, or gave nothing valid twice.
    /// </summary>
    private async Task<StylistRun> ComposeAsync(Guid userId, StylingCase styling, CancellationToken cancellationToken)
    {
        var budget = await ledger.HasBudgetAsync(cancellationToken);
        if (!budget)
        {
            logger.LogWarning("Today's AI budget is used up; outfits come from the rules");
        }

        var run = await StylistPipeline.RunAsync(budget ? stylist : null, styling, new Random(Guid.NewGuid().GetHashCode()), cancellationToken);
        foreach (var call in run.Calls)
        {
            ledger.Record(userId, AiOperation.Styling, call.Cost, call.Duration, call.Success);
        }

        switch (run.Reason)
        {
            case FallbackReason.Failed:
                logger.LogWarning(run.Failure, "The stylist did not answer; outfits come from the rules");
                break;
            case FallbackReason.Refused:
                logger.LogWarning("The stylist refused to answer; outfits come from the rules");
                break;
            case FallbackReason.NoValidOutfit:
                logger.LogWarning("The stylist's answers had no valid outfit: {Errors}", string.Join(' ', run.Errors));
                break;
        }

        return run;
    }

    /// <summary>The garments the stylist may think about: described and owned by the person. Forgotten and recently worn are settled against their own day.</summary>
    private async Task<List<Garment>> WardrobeAsync(Guid userId, LocalDay today, CancellationToken cancellationToken)
    {
        var clothes = await db.Clothes.AsNoTracking()
            .Where(item => item.UserId == userId && item.Status == ClothingStatus.Ready)
            .OrderBy(item => item.Id)
            .ToListAsync(cancellationToken);
        var likes = await db.OutfitItems
            .Where(item => db.Outfits.Any(outfit => outfit.Id == item.OutfitId && outfit.UserId == userId && outfit.Rating == OutfitRating.Like))
            .GroupBy(item => item.ClothingItemId)
            .Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.Id, entry => entry.Count, cancellationToken);
        var recently = today.Today.AddDays(-StylingHistory.RecentDays);

        var garments = new List<Garment>(clothes.Count);
        foreach (var item in clothes)
        {
            if (item.Tags is { } tags)
            {
                garments.Add(new Garment(
                    item.Id,
                    tags,
                    item.Description ?? tags.Describe(),
                    item.WearCount,
                    item.IsForgotten(today.Today, today.Zone),
                    item.LastWornOn >= recently,
                    likes.GetValueOrDefault(item.Id),
                    item.InLaundry));
            }
        }

        return garments;
    }

    /// <summary>What the person wore lately and what they made of earlier proposals (product spec 6.8).</summary>
    private async Task<StylingHistory> HistoryAsync(Guid userId, LocalDay today, CancellationToken cancellationToken)
    {
        var mine = db.Outfits.AsNoTracking().Where(outfit => outfit.UserId == userId);
        var recently = today.Today.AddDays(-StylingHistory.RecentDays);

        async Task<List<IReadOnlyList<Guid>>> IdsAsync(IQueryable<Outfit> query) =>
        [
            .. (await query.Select(outfit => outfit.Items.Select(item => item.ClothingItemId).ToList()).ToListAsync(cancellationToken))
                .Select(ids => (IReadOnlyList<Guid>)ids),
        ];

        var recent = await IdsAsync(mine.Where(outfit => outfit.WornOn >= recently).OrderByDescending(outfit => outfit.WornOn).ThenBy(outfit => outfit.Id));
        var liked = await IdsAsync(mine.Where(outfit => outfit.Rating == OutfitRating.Like).OrderByDescending(outfit => outfit.RatedAt).ThenBy(outfit => outfit.Id).Take(StylingHistory.Examples));
        var disliked = await IdsAsync(mine.Where(outfit => outfit.Rating == OutfitRating.Dislike).OrderByDescending(outfit => outfit.RatedAt).ThenBy(outfit => outfit.Id).Take(StylingHistory.Examples));

        var worn = await mine.Where(outfit => outfit.WornOn != null)
            .Select(outfit => new
            {
                Top = outfit.Items.Where(item => item.Slot == Category.Top).Select(item => (Guid?)item.ClothingItemId).FirstOrDefault(),
                Bottom = outfit.Items.Where(item => item.Slot == Category.Bottom).Select(item => (Guid?)item.ClothingItemId).FirstOrDefault(),
            })
            .Distinct()
            .ToListAsync(cancellationToken);
        var pairs = worn.Where(pair => pair.Top is not null && pair.Bottom is not null).Select(pair => (pair.Top!.Value, pair.Bottom!.Value)).ToHashSet();

        return new StylingHistory(recent, liked, disliked, pairs);
    }
}
