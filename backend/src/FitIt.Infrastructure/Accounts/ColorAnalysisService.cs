using System.Diagnostics;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Wardrobe;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Accounts;

/// <summary>
/// The colour analysis: a selfie or three answers in, a seasonal type and palette out. Only the result is stored on the profile. A
/// selfie is deleted from storage in the same request, whether the analysis worked or not.
/// </summary>
public sealed class ColorAnalysisService(
    AppDbContext db,
    IImageStorage storage,
    IColorAnalyst analyst,
    UsageCounters usage,
    AiLedger ledger,
    AppClock clock,
    IOptions<StorageOptions> storageOptions,
    ILogger<ColorAnalysisService> logger)
{
    public static readonly TimeSpan UploadLifetime = WardrobeService.UploadLifetime;

    private static readonly TimeSpan ReadLifetime = TimeSpan.FromMinutes(5);

    private static readonly ApiError ConsentRequired =
        ApiError.Forbidden("consent_required", "Consent to processing photos by external AI services is needed first.");

    private static readonly ApiError Unavailable =
        new(503, "color_analysis_unavailable", "The color analysis is not answering. Try again in a moment, or answer three questions instead.");

    public long MaxUploadBytes => storageOptions.Value.MaxUploadBytes;

    /// <summary>An address the phone can PUT one selfie to during the next five minutes. The key lies under the person's own <c>selfie/</c> folder.</summary>
    public async Task<Result<UploadTicket>> CreateUploadAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (!await HasConsentAsync(userId, cancellationToken))
        {
            return ConsentRequired;
        }

        if (!await usage.HasRoomAsync(userId, UsageKind.ColorAnalysis, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.ColorAnalysis, cancellationToken);
        }

        return storage.CreateUpload(ObjectKeys.NewSelfie(userId), WardrobeService.PhotoContentType, UploadLifetime);
    }

    /// <summary>Exactly one of <paramref name="photoKey"/> and <paramref name="quiz"/> must be given.</summary>
    public async Task<Result<ColorProfile>> AnalyzeAsync(Guid userId, string? photoKey, ColorQuiz? quiz, CancellationToken cancellationToken)
    {
        if ((photoKey is null) == (quiz is null))
        {
            return ApiError.BadRequest("analysis_input_invalid", "Send either a photo key or the three answers.");
        }

        if (photoKey is not null && !ObjectKeys.IsSelfieOf(userId, photoKey))
        {
            // Not this person's selfie, so not ours to touch: nothing is deleted.
            return ApiError.BadRequest("key_invalid", "The key is not one issued to this account by POST /api/me/color-analysis/upload.");
        }

        try
        {
            return await RunAsync(userId, photoKey, quiz, cancellationToken);
        }
        finally
        {
            if (photoKey is not null)
            {
                // The selfie never outlives the request, whatever happened to it.
                await DeleteSelfieAsync(photoKey);
            }
        }
    }

    public async Task<ColorProfile?> GetAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.AsNoTracking().Where(user => user.Id == userId).Select(user => user.ColorAnalysis).FirstOrDefaultAsync(cancellationToken);

    /// <summary>Forgets the result. Saying it twice is fine.</summary>
    public async Task RemoveAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.Where(user => user.Id == userId).ExecuteUpdateAsync(setters => setters.SetProperty(user => user.ColorAnalysis, (ColorProfile?)null), cancellationToken);

    private async Task<Result<ColorProfile>> RunAsync(Guid userId, string? photoKey, ColorQuiz? quiz, CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ApiError.Unauthorized("account_gone", "The account no longer exists.");
        }

        // Three answers never leave the server, so they need neither consent to external AI nor a share of the daily allowance.
        var external = photoKey is not null;
        if (external && user.AiConsentAt is null)
        {
            return ConsentRequired;
        }

        if (photoKey is not null && await CheckUploadAsync(photoKey, cancellationToken) is { } refusal)
        {
            return refusal;
        }

        var day = await usage.TodayOfAsync(userId, cancellationToken);
        if (external && !await usage.TryTakeAsync(userId, UsageKind.ColorAnalysis, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.ColorAnalysis, cancellationToken);
        }

        var watch = Stopwatch.StartNew();
        ColorAnalysisOutcome outcome;
        try
        {
            var photo = photoKey is null ? null : new ImageSource(photoKey, storage.SignRead(photoKey, ReadLifetime));
            outcome = await analyst.AnalyzeAsync(new ColorAnalysisRequest(photo, quiz), cancellationToken);
        }
        catch (ProviderException exception)
        {
            logger.LogWarning(exception, "The color analysis failed");
            if (photoKey is not null)
            {
                ledger.Record(userId, AiOperation.ColorAnalysis, exception.Cost ?? AiCost.None("unknown"), watch.Elapsed, success: false);
            }

            await db.SaveChangesAsync(CancellationToken.None);
            if (external)
            {
                await usage.RefundAsync(userId, UsageKind.ColorAnalysis, day, CancellationToken.None);
            }

            return Unavailable;
        }

        if (photoKey is not null)
        {
            ledger.Record(userId, AiOperation.ColorAnalysis, outcome.Cost, watch.Elapsed, success: true);
        }

        var result = new ColorProfile(
            outcome.Season, photoKey is null ? ColorAnalysisSource.Quiz : ColorAnalysisSource.Photo, outcome.Best, outcome.Soften, clock.UtcNow);
        user.ColorAnalysis = result;
        await db.SaveChangesAsync(cancellationToken);
        return result;
    }

    /// <summary>Looks at what was really uploaded: there, small enough, and a JPEG by its first bytes.</summary>
    private async Task<ApiError?> CheckUploadAsync(string key, CancellationToken cancellationToken)
    {
        var uploaded = await storage.FindAsync(key, cancellationToken);
        if (uploaded is null)
        {
            return ApiError.BadRequest("upload_missing", "No file was uploaded under this key. Ask for a new upload address and send the photo again.");
        }

        if (uploaded.Size > MaxUploadBytes)
        {
            return ApiError.BadRequest("upload_too_large", "The photo is larger than the limit.") with
            {
                Extensions = new Dictionary<string, object?>(StringComparer.Ordinal) { ["maxBytes"] = MaxUploadBytes },
            };
        }

        var head = await storage.ReadAsync(key, 3, cancellationToken);
        return head is [0xFF, 0xD8, 0xFF] ? null : ApiError.BadRequest("upload_not_jpeg", "The file is not a JPEG photo.");
    }

    private async Task DeleteSelfieAsync(string key)
    {
        try
        {
            await storage.DeleteAsync([key], CancellationToken.None);
        }
        catch (Exception exception)
        {
            // The sweep removes any selfie still there within the hour; the answer to the person must not depend on it.
            logger.LogError(exception, "A selfie could not be deleted; the sweep will remove it");
        }
    }

    private Task<bool> HasConsentAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Users.AnyAsync(user => user.Id == userId && user.AiConsentAt != null, cancellationToken);
}
