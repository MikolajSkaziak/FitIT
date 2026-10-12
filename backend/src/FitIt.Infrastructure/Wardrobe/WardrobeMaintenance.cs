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

    /// <summary>A selfie is deleted in the request that used it. One still there after this long was left by a crash, and goes.</summary>
    public static readonly TimeSpan SelfieKeptFor = TimeSpan.FromHours(1);

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

    /// <summary>
    /// Crops the cutouts stored before cropping existed (see <see cref="CutoutTrimmer"/>), so that garments already in a wardrobe
    /// sit on the figure like new ones. Each picture moves to a name of today's shape, which is how a finished garment is told
    /// from one still to do and how the phone learns the picture changed. Safe to run any number of times.
    /// </summary>
    public async Task<int> TightenCutoutsAsync()
    {
        var padded = await db.Clothes
            .Where(item => item.CutoutKey != null && item.CutoutKey.Contains("/cut/") && !item.CutoutKey.Contains(ObjectKeys.TightMark))
            .OrderBy(item => item.CreatedAt)
            .ToListAsync();
        var moved = 0;
        foreach (var item in padded)
        {
            var old = item.CutoutKey!;
            try
            {
                var picture = await storage.ReadAsync(old, null, CancellationToken.None);
                var tight = CutoutTrimmer.Trim(picture);
                var extension = tight is null ? Path.GetExtension(old).TrimStart('.') : CutoutTrimmer.Extension;
                var key = ObjectKeys.Cutout(item.UserId, item.Id, extension);
                await storage.WriteAsync(key, tight ?? picture, extension == CutoutTrimmer.Extension ? CutoutTrimmer.ContentType : "image/jpeg", CancellationToken.None);
                item.MoveCutout(key);
                await db.SaveChangesAsync();
                await storage.DeleteAsync([old], CancellationToken.None);
                moved++;
            }
            catch (Exception exception) when (exception is not DbUpdateException)
            {
                // One unreadable picture must not hold up the rest; it is tried again on the next run.
                logger.LogWarning(exception, "Could not crop the cutout of garment {ItemId}", item.Id);
            }
        }

        if (moved > 0)
        {
            logger.LogInformation("Cropped {Count} cutouts to their garments", moved);
        }

        return moved;
    }

    /// <summary>Deletes stored files that no garment, garment photo or visualization points to and that are older than a day, and the rows of long-refused photos.</summary>
    public async Task<int> RemoveOrphansAsync()
    {
        var now = clock.UtcNow;
        var refusedBefore = now - RejectedKeptFor;
        await db.Clothes.Where(item => item.Status == ClothingStatus.Rejected && item.UpdatedAt < refusedBefore).ExecuteDeleteAsync();

        var olderThan = now - OrphanAfter;
        var selfiesOlderThan = now - SelfieKeptFor;
        var removed = 0;
        var batch = new List<string>(200);
        await foreach (var stored in storage.ListAsync(ObjectKeys.Root, CancellationToken.None))
        {
            // A silhouette copy belongs to no row; it is kept for as long as the person has an account.
            // A selfie belongs to no row either, and a face photo is not kept for a day while nobody looks.
            if (ObjectKeys.IsSelfie(stored.Key) ? stored.LastModified < selfiesOlderThan : stored.LastModified < olderThan && !ObjectKeys.IsSilhouette(stored.Key))
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
        var pictures = await db.Visualizations.AsNoTracking()
            .Where(visualization => visualization.ImageKey != null && keys.Contains(visualization.ImageKey))
            .Select(visualization => visualization.ImageKey)
            .ToListAsync();
        var extras = await db.ClothingPhotos.AsNoTracking().Where(photo => keys.Contains(photo.Key)).Select(photo => photo.Key).ToListAsync();
        var referenced = used.SelectMany(pair => new[] { pair.OriginalKey, pair.CutoutKey }).Concat(pictures).Concat(extras).Where(key => key is not null).ToHashSet(StringComparer.Ordinal);
        var orphans = keys.Where(key => !referenced.Contains(key)).ToList();
        await storage.DeleteAsync(orphans, CancellationToken.None);
        return orphans.Count;
    }
}
