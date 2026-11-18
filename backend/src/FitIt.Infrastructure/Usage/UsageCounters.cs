using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Usage;

public sealed record UsageLine(UsageKind Kind, int Used, int Limit);

/// <summary>What a person has used today and when the count starts again.</summary>
public sealed record UsageSnapshot(IReadOnlyList<UsageLine> Lines, DateTimeOffset ResetsAt)
{
    public UsageLine this[UsageKind kind] => Lines.First(line => line.Kind == kind);
}

/// <summary>Daily limits per person (product spec 11.1). A day is a calendar day where the person's weather place lies.</summary>
public sealed class UsageCounters(AppDbContext db, PersonalCalendar calendar, IOptions<LimitOptions> options)
{
    public int LimitFor(UsageKind kind) => kind switch
    {
        UsageKind.ItemAdded => options.Value.ItemsPerDay,
        UsageKind.Suggestion => options.Value.SuggestionsPerDay,
        UsageKind.Visualization => options.Value.VisualizationsPerDay,
        UsageKind.ColorAnalysis => options.Value.ColorAnalysesPerDay,
        UsageKind.Tips => options.Value.TipsPerDay,
        UsageKind.StylistChat => options.Value.StylistMessagesPerDay,
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    /// <summary>The day a count taken now for this person lands on; pass it to <see cref="RefundAsync"/>.</summary>
    public async Task<DateOnly> TodayOfAsync(Guid userId, CancellationToken cancellationToken) => (await calendar.OfAsync(userId, cancellationToken)).Today;

    /// <summary>
    /// Takes one from today's allowance; false when it is used up. A single statement: the row lock makes parallel requests
    /// queue up, so the limit cannot be overshot however many arrive at once.
    /// </summary>
    public async Task<bool> TryTakeAsync(Guid userId, UsageKind kind, CancellationToken cancellationToken)
    {
        var limit = LimitFor(kind);
        if (limit <= 0)
        {
            return false;
        }

        var day = (await calendar.OfAsync(userId, cancellationToken)).Today;
        var code = EnumCodes.ToCode(kind);
        var taken = await db.Database.SqlQuery<int>($"""
            INSERT INTO usage_counters (user_id, day, kind, count) VALUES ({userId}, {day}, {code}, 1)
            ON CONFLICT (user_id, day, kind) DO UPDATE SET count = usage_counters.count + 1 WHERE usage_counters.count < {limit}
            RETURNING count AS "Value"
            """).ToListAsync(cancellationToken);
        return taken.Count == 1;
    }

    /// <summary>Gives one back to the day it was taken from (a visualization that failed). Never goes below zero.</summary>
    public Task RefundAsync(Guid userId, UsageKind kind, DateOnly day, CancellationToken cancellationToken)
    {
        var code = EnumCodes.ToCode(kind);
        return db.Database.ExecuteSqlAsync(
            $"UPDATE usage_counters SET count = count - 1 WHERE user_id = {userId} AND day = {day} AND kind = {code} AND count > 0",
            cancellationToken);
    }

    public async Task<UsageSnapshot> ReadAsync(Guid userId, CancellationToken cancellationToken)
    {
        var today = await calendar.OfAsync(userId, cancellationToken);
        var day = today.Today;
        var used = await db.UsageCounters.AsNoTracking()
            .Where(counter => counter.UserId == userId && counter.Day == day)
            .ToDictionaryAsync(counter => counter.Kind, counter => counter.Count, cancellationToken);
        return new UsageSnapshot(
            [.. Enum.GetValues<UsageKind>().Select(kind => new UsageLine(kind, used.GetValueOrDefault(kind), LimitFor(kind)))],
            today.StartOf(day.AddDays(1)));
    }

    public async Task<bool> HasRoomAsync(Guid userId, UsageKind kind, CancellationToken cancellationToken)
    {
        var day = (await calendar.OfAsync(userId, cancellationToken)).Today;
        var used = await db.UsageCounters.AsNoTracking()
            .Where(counter => counter.UserId == userId && counter.Day == day && counter.Kind == kind)
            .Select(counter => (int?)counter.Count)
            .FirstOrDefaultAsync(cancellationToken) ?? 0;
        return used < LimitFor(kind);
    }

    /// <summary>The refusal the app turns into "you can add more tomorrow".</summary>
    public async Task<ApiError> LimitReachedAsync(Guid userId, UsageKind kind, CancellationToken cancellationToken)
    {
        var today = await calendar.OfAsync(userId, cancellationToken);
        return ApiError.TooManyRequests("limit_reached", "Today's limit for this action is used up.") with
        {
            Extensions = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["kind"] = EnumCodes.ToCode(kind),
                ["limit"] = LimitFor(kind),
                ["resetsAt"] = today.StartOf(today.Today.AddDays(1)),
            },
        };
    }
}
