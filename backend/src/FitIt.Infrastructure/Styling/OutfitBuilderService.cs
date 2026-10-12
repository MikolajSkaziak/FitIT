using System.Diagnostics;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Weather;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Styling;

/// <summary>
/// Outfits the person puts together themselves, and tips on them. The only hard rules are those of integrity (the garments
/// are the person's own and ready, and they fit in one outfit); the weather and the style are never a reason to refuse.
/// </summary>
public sealed class OutfitBuilderService(
    AppDbContext db,
    WeatherService weather,
    IOutfitCritic critic,
    OutfitService outfits,
    UsageCounters usage,
    AiLedger ledger,
    AppClock clock)
{
    public const int MinItems = 2;
    public const int MaxItems = 8;
    public const int MaxAccessories = 3;

    public static readonly ApiError SizeInvalid =
        ApiError.BadRequest("outfit_size_invalid", $"An outfit has between {MinItems} and {MaxItems} garments.");

    public static readonly ApiError ItemRepeated = ApiError.BadRequest("item_repeated", "A garment can be in an outfit only once.");

    public static readonly ApiError ItemNotFound = ApiError.BadRequest("item_not_found", "Every garment must be one of your own.");

    public static readonly ApiError ItemNotReady = ApiError.BadRequest("item_not_ready", "A garment that is still being prepared cannot be used yet.");

    public static readonly ApiError RoleRepeated = ApiError.BadRequest("role_repeated", "An outfit has one garment per role; only accessories can be several.");

    public static readonly ApiError TooManyAccessories = ApiError.BadRequest("too_many_accessories", $"An outfit has at most {MaxAccessories} accessories.");

    public static readonly ApiError OnePieceWithSeparates = ApiError.BadRequest("one_piece_with_separates", "A dress or jumpsuit cannot be combined with a top or a bottom.");

    /// <summary>
    /// Stores the outfit the person built. Saved by default: making it was the decision to keep it. Unsaved, it is a draft
    /// that exists so a try-on picture can be ordered before saving; saving later passes the draft's id as
    /// <paramref name="draftId"/>, and the pictures ordered for the draft come along to the saved outfit.
    /// <paramref name="layout"/> is how the person arranged the garments on the board, if they did,
    /// <paramref name="figureLayout"/> how they arranged them on the figure.
    /// </summary>
    public async Task<Result<OutfitView>> CreateAsync(
        Guid userId, IReadOnlyList<Guid> ids, Occasion? occasion, string? name, bool saved, Guid? draftId, IReadOnlyList<OutfitPlacement>? layout,
        IReadOnlyList<OutfitPlacement>? figureLayout, CancellationToken cancellationToken)
    {
        if ((layout is not null && !Outfit.FitsLayout(layout, [.. ids])) || (figureLayout is not null && !Outfit.FitsLayout(figureLayout, [.. ids])))
        {
            return OutfitService.LayoutInvalid;
        }

        var chosen = await ChooseAsync(userId, ids, MinItems, cancellationToken);
        if (!chosen.IsOk)
        {
            return chosen.Error!;
        }

        var garments = chosen.Value;
        var separate = garments.Where(garment => garment.Role != Category.Accessory).GroupBy(garment => garment.Role).Any(group => group.Count() > 1);
        if (separate)
        {
            return RoleRepeated;
        }

        if (garments.Count(garment => garment.Role == Category.Accessory) > MaxAccessories)
        {
            return TooManyAccessories;
        }

        if (garments.Any(garment => garment.Role == Category.OnePiece) && garments.Any(garment => garment.Role is Category.Top or Category.Bottom))
        {
            return OnePieceWithSeparates;
        }

        var now = clock.UtcNow;
        var snapshot = await WeatherOfAsync(userId, cancellationToken);
        var outfit = new Outfit
        {
            Id = Guid.CreateVersion7(now),
            UserId = userId,
            RequestId = Guid.CreateVersion7(now),
            Occasion = occasion ?? Occasion.Everyday,
            Name = string.IsNullOrWhiteSpace(name) ? null : name.Trim(),
            Weather = snapshot?.Snapshot,
            Source = OutfitSource.Manual,
            Score = RuleBasedCritique.Of(new CritiqueRequest(garments, occasion, snapshot?.Weather), AiCost.None("rules")).Score,
            Reasoning = "",
            CreatedAt = now,
            Items = [.. garments.Select(garment => new OutfitItem { ClothingItemId = garment.Id, Slot = garment.Role })],
        };
        outfit.Save(saved);
        outfit.Arrange(layout);
        outfit.ArrangeFigure(figureLayout);
        db.Outfits.Add(outfit);
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            await db.SaveChangesAsync(cancellationToken);
            if (draftId is { } draft && await db.Outfits.AnyAsync(found => found.Id == draft && found.UserId == userId && !found.IsSaved && found.Source == OutfitSource.Manual, cancellationToken))
            {
                await db.Visualizations.Where(visualization => visualization.OutfitId == draft).ExecuteUpdateAsync(set => set.SetProperty(visualization => visualization.OutfitId, outfit.Id), cancellationToken);
                await db.Outfits.Where(found => found.Id == draft).ExecuteDeleteAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        return (await outfits.ViewAsync([outfit], cancellationToken))[0];
    }

    /// <summary>What works and what could be better in the combination, from the critic. Counts against its own daily allowance.</summary>
    public async Task<Result<Critique>> TipsAsync(Guid userId, IReadOnlyList<Guid> ids, Occasion? occasion, CancellationToken cancellationToken)
    {
        var chosen = await ChooseAsync(userId, ids, 1, cancellationToken);
        if (!chosen.IsOk)
        {
            return chosen.Error!;
        }

        if (!await usage.TryTakeAsync(userId, UsageKind.Tips, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.Tips, cancellationToken);
        }

        var day = await usage.TodayOfAsync(userId, cancellationToken);
        try
        {
            var weatherNow = (await WeatherOfAsync(userId, cancellationToken))?.Weather;
            var watch = Stopwatch.StartNew();
            var critique = await critic.CritiqueAsync(new CritiqueRequest(chosen.Value, occasion, weatherNow), cancellationToken);
            ledger.Record(userId, AiOperation.Critique, critique.Cost, watch.Elapsed, success: true);
            await db.SaveChangesAsync(cancellationToken);
            return critique;
        }
        catch
        {
            // The person got nothing for it: the request does not count against the day's allowance.
            await usage.RefundAsync(userId, UsageKind.Tips, day, CancellationToken.None);
            throw;
        }
    }

    /// <summary>The garments, in the order asked for, when they are the person's own and ready; otherwise the first thing wrong.</summary>
    private async Task<Result<List<Garment>>> ChooseAsync(Guid userId, IReadOnlyList<Guid> ids, int minimum, CancellationToken cancellationToken)
    {
        if (ids.Count < minimum || ids.Count > MaxItems)
        {
            return SizeInvalid;
        }

        if (ids.Distinct().Count() != ids.Count)
        {
            return ItemRepeated;
        }

        var found = await db.Clothes.AsNoTracking().Where(item => item.UserId == userId && ids.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);
        if (ids.Any(id => !found.ContainsKey(id)))
        {
            return ItemNotFound;
        }

        if (found.Values.Any(item => item.Status != ClothingStatus.Ready || item.Tags is null))
        {
            return ItemNotReady;
        }

        return ids.Select(id => new Garment(id, found[id].Tags!, found[id].Description ?? found[id].Tags!.Describe())).ToList();
    }

    private sealed record Here(WeatherSnapshot Snapshot, CritiqueWeather Weather);

    /// <summary>Today's weather where the person is, or null when they have no place or the forecast is not available: an outfit does not wait for it.</summary>
    private async Task<Here?> WeatherOfAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(found => found.Id == userId, cancellationToken);
        if (user?.Place is not { } place)
        {
            return null;
        }

        var forecast = await weather.AtAsync(place, user.ThermalPreference, cancellationToken);
        return forecast.IsOk ? new Here(WeatherSnapshot.Of(place.Name, forecast.Value.Profile), new CritiqueWeather(place.Name, forecast.Value.Profile)) : null;
    }
}
