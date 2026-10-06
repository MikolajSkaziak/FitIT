using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Usage;

/// <summary>Every paid AI call is written here; the day's total is compared with the global budget (product spec 11.1).</summary>
public sealed class AiLedger(AppDbContext db, AppClock clock, IOptions<LimitOptions> options)
{
    /// <summary>False once today's calls have cost the whole budget. Tagging then waits for tomorrow, the stylist uses rules.</summary>
    public async Task<bool> HasBudgetAsync(CancellationToken cancellationToken)
    {
        var dayStart = clock.StartOf(clock.Today);
        var spent = await db.AiUsage.Where(entry => entry.CreatedAt >= dayStart).SumAsync(entry => (decimal?)entry.CostUsd, cancellationToken) ?? 0m;
        return spent < options.Value.AiBudgetUsdPerDay;
    }

    /// <summary>The moment tomorrow's budget opens.</summary>
    public DateTimeOffset NextBudgetStart => clock.StartOf(clock.Today.AddDays(1));

    /// <summary>Adds the entry to the unit of work; it is stored with the caller's next save.</summary>
    public void Record(Guid? userId, AiOperation operation, AiCost cost, TimeSpan duration, bool success) =>
        db.AiUsage.Add(new AiUsageEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Operation = operation,
            Model = cost.Model,
            CostUsd = cost.Usd,
            DurationMs = (int)Math.Min(int.MaxValue, duration.TotalMilliseconds),
            Success = success,
            CreatedAt = clock.UtcNow,
        });
}
