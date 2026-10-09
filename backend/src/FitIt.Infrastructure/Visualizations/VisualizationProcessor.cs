using System.Diagnostics;
using FitIt.Core.Usage;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Wardrobe;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>
/// The background job behind every visualization: order the picture from the provider, remember the provider's id, wait
/// for the answer, keep the picture (product spec 7.5). Safe to run any number of times. Each run does one step and, while
/// the picture is still being made, schedules the next run instead of sleeping, so a waiting order holds no worker.
/// Whatever the outcome, the person never pays for a picture they did not get: failure, refusal and timeout give the
/// day's allowance back.
/// </summary>
public sealed class VisualizationProcessor(
    AppDbContext db,
    IImageStorage storage,
    IOutfitVisualizer visualizer,
    SilhouetteStore silhouettes,
    AiLedger ledger,
    UsageCounters usage,
    IBackgroundJobs jobs,
    AppClock clock,
    IOptions<VisualizationOptions> options,
    ILogger<VisualizationProcessor> logger)
{
    /// <summary>Tries at sending the order. On the last failed try the order is given up instead of failing the job again.</summary>
    public const int MaxAttempts = 3;

    public async Task RunAsync(Guid visualizationId)
    {
        var cancellationToken = CancellationToken.None;
        var visualization = await db.Visualizations.FirstOrDefaultAsync(found => found.Id == visualizationId, cancellationToken);
        if (visualization is null || visualization.IsFinal)
        {
            return;
        }

        // The hard limit of product spec 13, counted from the moment the provider took the order (or the request, if it never did).
        var started = visualization.StartedAt ?? visualization.CreatedAt;
        if (clock.UtcNow - started >= options.Value.TimeLimit)
        {
            await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.TimedOut, null, cancellationToken);
            return;
        }

        if (visualization.ProviderRequestId is null && !await SubmitAsync(visualization, cancellationToken))
        {
            return;
        }

        await PollAsync(visualization, cancellationToken);
    }

    /// <summary>Sends the order. False when the order was given up or the job has to run again.</summary>
    private async Task<bool> SubmitAsync(Visualization visualization, CancellationToken cancellationToken)
    {
        // Consent can be withdrawn and the budget can run out while an order waits: nothing is sent out then.
        if (!await db.Users.AnyAsync(user => user.Id == visualization.UserId && user.AiConsentAt != null, cancellationToken))
        {
            await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.ConsentWithdrawn, null, cancellationToken);
            return false;
        }

        if (!await ledger.HasBudgetAsync(cancellationToken))
        {
            logger.LogWarning("Today's AI budget is used up; visualization {VisualizationId} is not ordered", visualization.Id);
            await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.BudgetExhausted, null, cancellationToken);
            return false;
        }

        var input = await BuildInputAsync(visualization, cancellationToken);
        visualization.BeginAttempt(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);

        var watch = Stopwatch.StartNew();
        string providerRequestId;
        try
        {
            providerRequestId = await visualizer.SubmitAsync(input, cancellationToken);
        }
        catch (ProviderException exception)
        {
            ledger.Record(visualization.UserId, AiOperation.Visualization, exception.Cost ?? AiCost.None(visualizer.Model), watch.Elapsed, success: false);
            await db.SaveChangesAsync(cancellationToken);
            if (visualization.Attempts < MaxAttempts)
            {
                throw;
            }

            logger.LogWarning(exception, "The image provider kept refusing visualization {VisualizationId}; it is given up", visualization.Id);
            await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.ProviderFailed, null, cancellationToken);
            return false;
        }

        // Saved before anybody polls: a job that runs again from here on asks about this order and never places another.
        visualization.MarkSubmitted(providerRequestId, visualizer.Model, VisualizationPrompt.Version, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task PollAsync(Visualization visualization, CancellationToken cancellationToken)
    {
        var requestId = visualization.ProviderRequestId!;
        ProviderJobStatus status;
        try
        {
            status = await visualizer.GetStatusAsync(requestId, cancellationToken);
        }
        catch (ProviderException exception)
        {
            // The provider could not say. The order is still there; the time limit decides how long to keep asking.
            logger.LogWarning(exception, "Could not read the state of visualization {VisualizationId}; asking again", visualization.Id);
            await WaitAsync(visualization, cancellationToken);
            return;
        }

        switch (status.State)
        {
            case ProviderJobState.Queued or ProviderJobState.Running:
                await WaitAsync(visualization, cancellationToken);
                break;
            case ProviderJobState.Blocked:
                await GiveUpAsync(visualization, VisualizationStatus.Blocked, VisualizationErrors.ContentBlocked, status.Cost, cancellationToken);
                break;
            case ProviderJobState.Failed:
                await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.ProviderFailed, status.Cost, cancellationToken);
                break;
            default:
                await KeepResultAsync(visualization, requestId, cancellationToken);
                break;
        }
    }

    private async Task KeepResultAsync(Visualization visualization, string requestId, CancellationToken cancellationToken)
    {
        VisualizedImage image;
        try
        {
            image = await visualizer.GetResultAsync(requestId, cancellationToken);
        }
        catch (ProviderException exception)
        {
            logger.LogWarning(exception, "Could not fetch the picture of visualization {VisualizationId}; asking again", visualization.Id);
            await WaitAsync(visualization, cancellationToken);
            return;
        }

        if (!LooksLikeImage(image.Content))
        {
            await GiveUpAsync(visualization, VisualizationStatus.Failed, VisualizationErrors.InvalidImage, image.Cost, cancellationToken);
            return;
        }

        // Copied into our own storage under the person's prefix: the provider's file is not ours and does not last.
        var key = ObjectKeys.Visualization(visualization.UserId, visualization.Id, image.Extension);
        await storage.WriteAsync(key, image.Content, image.ContentType, cancellationToken);

        var now = clock.UtcNow;
        var elapsed = now - (visualization.StartedAt ?? visualization.CreatedAt);
        var cost = image.Cost.Usd;
        var done = await db.Visualizations
            .Where(found => found.Id == visualization.Id && (found.Status == VisualizationStatus.Pending || found.Status == VisualizationStatus.Running))
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(found => found.Status, VisualizationStatus.Completed)
                    .SetProperty(found => found.ImageKey, key)
                    .SetProperty(found => found.CostUsd, cost)
                    .SetProperty(found => found.CompletedAt, now)
                    .SetProperty(found => found.UpdatedAt, now),
                cancellationToken);
        if (done == 1)
        {
            ledger.Record(visualization.UserId, AiOperation.Visualization, image.Cost, elapsed, success: true);
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (!await db.Visualizations.AnyAsync(found => found.Id == visualization.Id, cancellationToken))
        {
            // The outfit was deleted while the picture was being made: its files go with it.
            await storage.DeleteAsync([key], cancellationToken);
        }
    }

    /// <summary>Still being made: run again after a pause.</summary>
    private async Task WaitAsync(Visualization visualization, CancellationToken cancellationToken)
    {
        visualization.Touch(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        jobs.Schedule<VisualizationProcessor>(processor => processor.RunAsync(visualization.Id), options.Value.PollInterval);
    }

    /// <summary>
    /// Ends the order without a picture and gives the day's allowance back, in one transaction and only if this run is the
    /// one that ends it: two runs that finish the same order at once cannot both refund.
    /// </summary>
    private async Task GiveUpAsync(Visualization visualization, VisualizationStatus outcome, string errorCode, AiCost? cost, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var ended = await db.Visualizations
            .Where(found => found.Id == visualization.Id && (found.Status == VisualizationStatus.Pending || found.Status == VisualizationStatus.Running))
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(found => found.Status, outcome)
                    .SetProperty(found => found.ErrorCode, errorCode)
                    .SetProperty(found => found.CompletedAt, now)
                    .SetProperty(found => found.UpdatedAt, now),
                cancellationToken);
        if (ended == 1)
        {
            await usage.RefundAsync(visualization.UserId, UsageKind.Visualization, visualization.UsageDay, cancellationToken);
            if (visualization.StartedAt is { } started)
            {
                // An order that reached the provider is in the log whatever came of it; one that never left is not a call.
                ledger.Record(visualization.UserId, AiOperation.Visualization, cost ?? AiCost.None(visualization.Model ?? visualizer.Model), now - started, success: false);
                await db.SaveChangesAsync(cancellationToken);
            }
        }

        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>The silhouette and the garments of the outfit, in the order of the roles, each as a signed address, with the prompt made from their descriptions.</summary>
    private async Task<VisualizationInput> BuildInputAsync(Visualization visualization, CancellationToken cancellationToken)
    {
        var avatar = await db.Avatars.AsNoTracking().FirstAsync(found => found.Id == visualization.AvatarId, cancellationToken);
        var silhouette = await silhouettes.EnsureAsync(visualization.UserId, avatar, ClothingProcessor.ProviderReadLifetime, cancellationToken);

        var parts = await db.OutfitItems.AsNoTracking().Where(part => part.OutfitId == visualization.OutfitId).ToListAsync(cancellationToken);
        var ids = parts.Select(part => part.ClothingItemId).ToList();
        var clothes = await db.Clothes.AsNoTracking().Where(item => ids.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);

        var ordered = parts
            .Where(part => clothes.ContainsKey(part.ClothingItemId))
            .OrderBy(part => part.Slot).ThenBy(part => part.ClothingItemId)
            .ToList();
        var accessories = 0;
        var chosen = new List<(ClothingItem Item, Category Role)>();
        foreach (var part in ordered)
        {
            if (part.Slot == Category.Accessory && ++accessories > VisualizationPrompt.MaxAccessories)
            {
                continue;
            }

            chosen.Add((clothes[part.ClothingItemId], part.Slot));
        }

        var build = await db.Users.AsNoTracking().Where(user => user.Id == visualization.UserId).Select(user => new { user.ClothingSize, user.LegLength }).FirstOrDefaultAsync(cancellationToken);
        var fit = VisualizationPrompt.FitHint(build?.ClothingSize, build?.LegLength);
        var prompt = VisualizationPrompt.Build([.. chosen.Select(entry => new PromptGarment(entry.Item.Description ?? entry.Item.Tags?.Describe() ?? entry.Item.Name ?? "garment", entry.Role))], fit);
        var sources = chosen.Select(entry => new ImageSource(entry.Item.ImageKey, storage.SignRead(entry.Item.ImageKey, ClothingProcessor.ProviderReadLifetime))).ToList();
        return new VisualizationInput(prompt, silhouette, sources);
    }

    /// <summary>A JPEG or a PNG by its first bytes: a provider that answers with an error page must not end up in the person's storage as a picture.</summary>
    private static bool LooksLikeImage(byte[] content) => content is [0xFF, 0xD8, 0xFF, ..] or [0x89, 0x50, 0x4E, 0x47, ..];
}

/// <summary>Scheduled housekeeping for visualizations.</summary>
public sealed class VisualizationMaintenance(AppDbContext db, IBackgroundJobs jobs, AppClock clock, ILogger<VisualizationMaintenance> logger)
{
    /// <summary>An order that has not moved for this long is taken to be stuck: the job that was to poll it was lost (a restart at the wrong moment).</summary>
    public static readonly TimeSpan StuckAfter = TimeSpan.FromMinutes(1);

    /// <summary>Runs the job again for orders that stopped moving. The job itself gives up the ones past the time limit.</summary>
    public async Task<int> RequeueStuckAsync()
    {
        var stuckBefore = clock.UtcNow - StuckAfter;
        var stuck = await db.Visualizations.AsNoTracking()
            .Where(visualization => (visualization.Status == VisualizationStatus.Pending || visualization.Status == VisualizationStatus.Running) && visualization.UpdatedAt < stuckBefore)
            .OrderBy(visualization => visualization.CreatedAt)
            .Select(visualization => visualization.Id)
            .Take(200)
            .ToListAsync();
        foreach (var id in stuck)
        {
            jobs.Enqueue<VisualizationProcessor>(processor => processor.RunAsync(id));
        }

        if (stuck.Count > 0)
        {
            logger.LogInformation("Re-queued {Count} visualizations that stopped moving", stuck.Count);
        }

        return stuck.Count;
    }
}
