using System.Diagnostics;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Weather;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Styling;

/// <summary>The stylist's reply and the person's garments it names, by id, for the app's garment shape.</summary>
public sealed record StylistChatView(StylistChatReply Reply, IReadOnlyDictionary<Guid, ClothingItem> Clothes);

/// <summary>
/// The chat with the person's stylist. Stateless: the app sends the recent conversation with every message and nothing of it
/// is stored. Each message counts against the day's allowance (given back when the reply fails) and goes to the configured
/// stylist; the rules answer when the day's AI budget is spent, when the model fails, and for an empty wardrobe, where there
/// is nothing to ask a model about and nothing is counted.
/// </summary>
public sealed class StylistChatService(
    AppDbContext db,
    WeatherService weather,
    IStylistChat stylist,
    FakeStylistChat rules,
    UsageCounters usage,
    AiLedger ledger,
    PersonalCalendar calendar,
    ILogger<StylistChatService> logger)
{
    /// <param name="day">The day of the person's calendar the conversation is about: today or one of the next six; today when left out.</param>
    public async Task<Result<StylistChatView>> ReplyAsync(
        Guid userId, IReadOnlyList<ChatMessage> messages, Occasion? occasion, DateOnly? day, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(found => found.Id == userId, cancellationToken);
        if (user is null)
        {
            return ApiError.NotFound();
        }

        var today = await calendar.OfAsync(userId, cancellationToken);
        WeatherProfile? forecast = null;
        if (user.Place is { } place)
        {
            var asked = await weather.AtAsync(place, user.ThermalPreference, cancellationToken, day);
            if (asked.IsOk)
            {
                forecast = asked.Value.Profile;
            }
            else if (asked.Error == WeatherErrors.OutOfRange)
            {
                return asked.Error;
            }
            else
            {
                // The chat does without the weather; the stylist is told it is not known.
                logger.LogWarning("The weather could not be told for the stylist chat ({Code})", asked.Error!.Code);
            }
        }
        else if (day is { } wanted && (wanted < today.Today || wanted >= today.Today.AddDays(WeatherProfile.HorizonDays)))
        {
            return WeatherErrors.OutOfRange;
        }

        var clothes = await db.Clothes.AsNoTracking()
            .Where(item => item.UserId == userId && item.Status == ClothingStatus.Ready)
            .OrderBy(item => item.Id)
            .ToListAsync(cancellationToken);
        var wardrobe = new List<Garment>(clothes.Count);
        foreach (var item in clothes)
        {
            if (item.Tags is { } tags)
            {
                wardrobe.Add(new Garment(
                    item.Id, tags, item.Description ?? tags.Describe(), item.WearCount, item.IsForgotten(today.Today, today.Zone), InLaundry: item.InLaundry));
            }
        }

        var chat = new StylistChatCase(
            messages,
            wardrobe,
            [.. user.StylePreferences.Select(EnumCodes.Parse<StyleTag>)],
            user.ThermalPreference,
            user.Gender,
            day ?? today.Today,
            forecast,
            occasion,
            user.ColorAnalysis is { } colors ? [.. colors.Best.Select(swatch => swatch.Name.ToLowerInvariant())] : null);
        var byId = clothes.ToDictionary(item => item.Id);
        if (wardrobe.Count == 0)
        {
            return new StylistChatView(FakeStylistChat.Reply(chat), byId);
        }

        if (!await usage.TryTakeAsync(userId, UsageKind.StylistChat, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.StylistChat, cancellationToken);
        }

        var counted = await usage.TodayOfAsync(userId, cancellationToken);
        try
        {
            var reply = await AskAsync(userId, chat, cancellationToken);
            if (reply.Dropped.Count > 0)
            {
                logger.LogWarning("The stylist's outfit broke the rules and was left out: {Errors}", string.Join(' ', reply.Dropped));
            }

            await db.SaveChangesAsync(cancellationToken);
            return new StylistChatView(reply, byId);
        }
        catch
        {
            // The person got nothing for it: the message does not count against the day's allowance.
            await usage.RefundAsync(userId, UsageKind.StylistChat, counted, CancellationToken.None);
            throw;
        }
    }

    /// <summary>The configured stylist, or the rules when the budget is spent or the model fails; every paid call goes to the usage log.</summary>
    private async Task<StylistChatReply> AskAsync(Guid userId, StylistChatCase chat, CancellationToken cancellationToken)
    {
        if (stylist is FakeStylistChat)
        {
            return await rules.ReplyAsync(chat, cancellationToken);
        }

        if (!await ledger.HasBudgetAsync(cancellationToken))
        {
            logger.LogWarning("Today's AI budget is used up; the stylist chat answers from the rules");
            return await rules.ReplyAsync(chat, cancellationToken);
        }

        var watch = Stopwatch.StartNew();
        try
        {
            var reply = await stylist.ReplyAsync(chat, cancellationToken);
            ledger.Record(userId, AiOperation.StylistChat, reply.Cost ?? AiCost.None("unknown"), watch.Elapsed, success: true);
            return reply;
        }
        catch (Exception exception) when (exception is ProviderException || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            ledger.Record(userId, AiOperation.StylistChat, (exception as ProviderException)?.Cost ?? AiCost.None("unknown"), watch.Elapsed, success: false);
            logger.LogWarning(exception, "The stylist chat did not answer; the rules answer instead");
            return await rules.ReplyAsync(chat, cancellationToken);
        }
    }
}
