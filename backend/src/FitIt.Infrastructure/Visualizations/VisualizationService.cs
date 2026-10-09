using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>Ordering an image of an outfit on the person's silhouette and reading how the order stands (product spec 7.5).</summary>
public sealed class VisualizationService(
    AppDbContext db,
    IImageStorage storage,
    UsageCounters usage,
    AiLedger ledger,
    IBackgroundJobs jobs,
    AppClock clock)
{
    public static readonly TimeSpan ReadLifetime = TimeSpan.FromHours(1);

    private static readonly ApiError ConsentRequired =
        ApiError.Forbidden("consent_required", "Consent to processing garment photos by external AI services is needed first.");

    private static readonly ApiError Paused =
        new(503, "visualizations_paused", "Visualizations are paused for today. Try again tomorrow; the outfit itself is not affected.");

    /// <summary>
    /// Orders the picture, or returns the order that already exists: the same <paramref name="key"/> from the same person is
    /// the same order and is counted once, and an order still in progress for this outfit is never started twice.
    /// Somebody else's outfit is not found, exactly like one that does not exist.
    /// </summary>
    public async Task<Result<(Visualization Item, bool Created)>> RequestAsync(Guid userId, Guid outfitId, string key, CancellationToken cancellationToken)
    {
        if (!await db.Outfits.AnyAsync(outfit => outfit.Id == outfitId && outfit.UserId == userId, cancellationToken))
        {
            return ApiError.NotFound();
        }

        if (await FindByKeyAsync(userId, key, cancellationToken) is { } known)
        {
            return known.OutfitId == outfitId
                ? (known, false)
                : ApiError.Conflict("idempotency_key_reused", "The key was already used for a different outfit. Use a new key for each request.");
        }

        var inProgress = await db.Visualizations.AsNoTracking()
            .Where(visualization => visualization.OutfitId == outfitId && visualization.UserId == userId
                && (visualization.Status == VisualizationStatus.Pending || visualization.Status == VisualizationStatus.Running))
            .OrderByDescending(visualization => visualization.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (inProgress is not null)
        {
            return (inProgress, false);
        }

        var user = await db.Users.AsNoTracking().Where(found => found.Id == userId).Select(found => new { found.AvatarId, Consent = found.AiConsentAt != null }).FirstOrDefaultAsync(cancellationToken);
        if (user is null)
        {
            return ApiError.NotFound();
        }

        if (!user.Consent)
        {
            return ConsentRequired;
        }

        if (!await ledger.HasBudgetAsync(cancellationToken))
        {
            return Paused;
        }

        var now = clock.UtcNow;
        var visualization = new Visualization
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            OutfitId = outfitId,
            AvatarId = user.AvatarId,
            IdempotencyKey = key,
            UsageDay = await usage.TodayOfAsync(userId, cancellationToken),
            CreatedAt = now,
        };
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            // The count and the record stand or fall together: a refused or repeated request costs nothing.
            if (!await usage.TryTakeAsync(userId, UsageKind.Visualization, cancellationToken))
            {
                return await usage.LimitReachedAsync(userId, UsageKind.Visualization, cancellationToken);
            }

            db.Visualizations.Add(visualization);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same key arrived twice at once and the other request won.
                await transaction.RollbackAsync(cancellationToken);
                db.Entry(visualization).State = EntityState.Detached;
                var winner = await FindByKeyAsync(userId, key, cancellationToken);
                return winner is null ? ApiError.Conflict("key_in_use", "The request is already being handled.") : (winner, false);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        jobs.Enqueue<VisualizationProcessor>(processor => processor.RunAsync(visualization.Id));
        return (visualization, true);
    }

    /// <summary>Somebody else's visualization is not found, exactly like one that does not exist.</summary>
    public async Task<Result<Visualization>> GetAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        await db.Visualizations.AsNoTracking().FirstOrDefaultAsync(visualization => visualization.Id == id && visualization.UserId == userId, cancellationToken)
            is { } found ? found : ApiError.NotFound();

    /// <summary>The signed address of a finished picture, valid for an hour; null while there is none.</summary>
    public Uri? ImageUrl(Visualization visualization) =>
        visualization.Status == VisualizationStatus.Completed && visualization.ImageKey is { } key ? storage.SignRead(key, ReadLifetime) : null;

    private Task<Visualization?> FindByKeyAsync(Guid userId, string key, CancellationToken cancellationToken) =>
        db.Visualizations.AsNoTracking().FirstOrDefaultAsync(visualization => visualization.UserId == userId && visualization.IdempotencyKey == key, cancellationToken);
}
