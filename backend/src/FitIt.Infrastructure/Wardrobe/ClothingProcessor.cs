using System.Diagnostics;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>
/// The background job behind every new garment: remove the background, store the cutout, tag, done (product spec 5.1).
/// Safe to run any number of times: each run looks at what is already settled and continues from there.
/// </summary>
public sealed class ClothingProcessor(
    AppDbContext db,
    IImageStorage storage,
    IBackgroundRemover remover,
    IGarmentTagger tagger,
    AiLedger ledger,
    WardrobeService wardrobe,
    AppClock clock,
    ILogger<ClothingProcessor> logger)
{
    /// <summary>Tries per step. On the last failed try the step gives up gracefully instead of failing the job.</summary>
    public const int MaxAttempts = 3;

    /// <summary>How long a provider may read the picture through its signed address.</summary>
    public static readonly TimeSpan ProviderReadLifetime = TimeSpan.FromMinutes(15);

    public async Task RunAsync(Guid itemId)
    {
        var cancellationToken = CancellationToken.None;
        var item = await db.Clothes.FirstOrDefaultAsync(found => found.Id == itemId, cancellationToken);
        if (item is null || item.Status != ClothingStatus.Processing)
        {
            return;
        }

        if (item.DeferredUntil is { } until && until > clock.UtcNow)
        {
            return;
        }

        // Consent can be withdrawn while a photo waits: nothing more is sent out, and the garment waits for the person.
        if (!await db.Users.AnyAsync(user => user.Id == item.UserId && user.AiConsentAt != null, cancellationToken))
        {
            item.MarkFailed(clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        if (!await ledger.HasBudgetAsync(cancellationToken))
        {
            item.Defer(ledger.NextBudgetStart, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogWarning("Today's AI budget is used up; garment {ItemId} waits until {Until}", item.Id, item.DeferredUntil);
            return;
        }

        if (item.CutoutKey is null)
        {
            await RemoveBackgroundAsync(item, cancellationToken);
        }

        await TagAsync(item, cancellationToken);
    }

    private async Task RemoveBackgroundAsync(ClothingItem item, CancellationToken cancellationToken)
    {
        item.BeginAttempt(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);

        var watch = Stopwatch.StartNew();
        try
        {
            var photo = new ImageSource(item.OriginalKey, storage.SignRead(item.OriginalKey, ProviderReadLifetime));
            var removal = await remover.RemoveAsync(photo, cancellationToken);
            var key = ObjectKeys.Cutout(item.UserId, item.Id, removal.Extension);
            await storage.WriteAsync(key, removal.Content, removal.ContentType, cancellationToken);
            ledger.Record(item.UserId, AiOperation.BackgroundRemoval, removal.Cost, watch.Elapsed, success: true);
            item.AttachCutout(key, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (ProviderException exception)
        {
            ledger.Record(item.UserId, AiOperation.BackgroundRemoval, exception.Cost ?? AiCost.None("unknown"), watch.Elapsed, success: false);
            if (item.Attempts < MaxAttempts)
            {
                await db.SaveChangesAsync(cancellationToken);
                throw;
            }

            // The garment is worth more with its background than not at all: the photo itself becomes the cutout.
            logger.LogWarning(exception, "Background removal gave up on garment {ItemId}; the original photo is used", item.Id);
            item.AttachCutout(item.OriginalKey, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task TagAsync(ClothingItem item, CancellationToken cancellationToken)
    {
        item.BeginAttempt(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);

        var watch = Stopwatch.StartNew();
        TaggingOutcome outcome;
        try
        {
            var cutout = new ImageSource(item.ImageKey, storage.SignRead(item.ImageKey, ProviderReadLifetime));
            outcome = await tagger.TagAsync(cutout, cancellationToken);

            // An answer that does not fit the closed lists is as useless as no answer, and is retried the same way.
            if (outcome.Rejected is null && (outcome.Tags is null || outcome.Tags.Check() is not null))
            {
                throw new ProviderException($"The tagger's answer does not fit the dictionaries ({outcome.Tags?.Check()?.Code ?? "no tags"}).") { Cost = outcome.Cost };
            }
        }
        catch (ProviderException exception)
        {
            ledger.Record(item.UserId, AiOperation.Tagging, exception.Cost ?? AiCost.None("unknown"), watch.Elapsed, success: false);
            if (item.Attempts < MaxAttempts)
            {
                await db.SaveChangesAsync(cancellationToken);
                throw;
            }

            logger.LogWarning(exception, "Tagging gave up on garment {ItemId}; it waits for tags from the person", item.Id);
            item.MarkFailed(clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        ledger.Record(item.UserId, AiOperation.Tagging, outcome.Cost, watch.Elapsed, success: true);
        if (outcome.Rejected is { } reason)
        {
            // Not a garment we can dress anybody in: the row stays for a day to explain why, the pictures go now.
            item.MarkRejected(reason, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            await wardrobe.DeleteFilesAsync(item, cancellationToken);
            return;
        }

        var tags = outcome.Tags!;
        item.MarkReady(tags, string.IsNullOrWhiteSpace(outcome.Description) ? tags.Describe() : outcome.Description.Trim(), clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
    }
}
