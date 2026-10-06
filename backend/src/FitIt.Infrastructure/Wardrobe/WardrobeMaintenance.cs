using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>Scheduled housekeeping for the wardrobe.</summary>
public sealed class WardrobeMaintenance(AppDbContext db, IImageStorage storage, IBackgroundJobs jobs, AppClock clock, ILogger<WardrobeMaintenance> logger)
{
    /// <summary>A garment that has not moved for this long is taken to be stuck (a lost job, a restart at the wrong moment).</summary>
    public static readonly TimeSpan StuckAfter = TimeSpan.FromMinutes(10);

    /// <summary>A file with no row is left alone this long: an upload may simply not have been confirmed yet.</summary>
    public static readonly TimeSpan OrphanAfter = TimeSpan.FromHours(24);

    /// <summary>How long a refused photo's row is kept so the app can say why it was refused.</summary>
    public static readonly TimeSpan RejectedKeptFor = TimeSpan.FromHours(24);

    /// <summary>Puts garments back in the queue that are stuck in processing or whose wait for the AI budget is over.</summary>
    public async Task<int> RequeueWaitingAsync()
    {
        var now = clock.UtcNow;
        var stuckBefore = now - StuckAfter;
        var waiting = await db.Clothes.AsNoTracking()
            .Where(item => item.Status == ClothingStatus.Processing)
            .Where(item => item.DeferredUntil != null ? item.DeferredUntil <= now : item.UpdatedAt < stuckBefore)
            .OrderBy(item => item.CreatedAt)
            .Select(item => item.Id)
            .Take(500)
            .ToListAsync();
        foreach (var id in waiting)
        {
            jobs.Enqueue<ClothingProcessor>(processor => processor.RunAsync(id));
        }

        if (waiting.Count > 0)
        {
            logger.LogInformation("Re-queued {Count} waiting garments", waiting.Count);
        }

        return waiting.Count;
    }

    /// <summary>Deletes stored files that no garment points to and that are older than a day, and the rows of long-refused photos.</summary>
    public async Task<int> RemoveOrphansAsync()
    {
        var now = clock.UtcNow;
        var refusedBefore = now - RejectedKeptFor;
        await db.Clothes.Where(item => item.Status == ClothingStatus.Rejected && item.UpdatedAt < refusedBefore).ExecuteDeleteAsync();

        var olderThan = now - OrphanAfter;
        var removed = 0;
        var batch = new List<string>(200);
        await foreach (var stored in storage.ListAsync(ObjectKeys.Root, CancellationToken.None))
        {
            if (stored.LastModified < olderThan)
            {
                batch.Add(stored.Key);
            }

            if (batch.Count == 200)
            {
                removed += await RemoveUnreferencedAsync(batch);
                batch.Clear();
            }
        }

        removed += await RemoveUnreferencedAsync(batch);
        if (removed > 0)
        {
            logger.LogInformation("Removed {Count} files that no garment points to", removed);
        }

        return removed;
    }

    private async Task<int> RemoveUnreferencedAsync(List<string> keys)
    {
        if (keys.Count == 0)
        {
            return 0;
        }

        var used = await db.Clothes.AsNoTracking()
            .Where(item => keys.Contains(item.OriginalKey) || (item.CutoutKey != null && keys.Contains(item.CutoutKey)))
            .Select(item => new { item.OriginalKey, item.CutoutKey })
            .ToListAsync();
        var referenced = used.SelectMany(pair => new[] { pair.OriginalKey, pair.CutoutKey }).Where(key => key is not null).ToHashSet(StringComparer.Ordinal);
        var orphans = keys.Where(key => !referenced.Contains(key)).ToList();
        await storage.DeleteAsync(orphans, CancellationToken.None);
        return orphans.Count;
    }
}
