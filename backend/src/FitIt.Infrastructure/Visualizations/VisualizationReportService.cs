using FitIt.Core.Common;
using FitIt.Core.Visualizations;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>
/// "Report a problem" on a try-on picture. The report is stored and logged. An inappropriate picture also goes at once: the
/// row and the file are deleted, so offensive output never stays on the person's screen. The day's allowance is not given back.
/// </summary>
public sealed class VisualizationReportService(AppDbContext db, VisualizationFiles files, AppClock clock, ILogger<VisualizationReportService> logger)
{
    /// <summary>Somebody else's picture is not found, exactly like one that does not exist. A picture still being made has nothing to report yet.</summary>
    public async Task<Result<Unit>> ReportAsync(Guid userId, Guid visualizationId, ReportReason reason, CancellationToken cancellationToken)
    {
        var visualization = await db.Visualizations.FirstOrDefaultAsync(found => found.Id == visualizationId && found.UserId == userId, cancellationToken);
        if (visualization is null)
        {
            return ApiError.NotFound();
        }

        if (visualization.Status != VisualizationStatus.Completed)
        {
            return ApiError.Conflict("picture_not_ready", "There is no finished picture to report.");
        }

        db.VisualizationReports.Add(new VisualizationReport
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            VisualizationId = visualization.Id,
            OutfitId = visualization.OutfitId,
            Reason = reason,
            CreatedAt = clock.UtcNow,
        });

        var imageKey = visualization.ImageKey;
        var hide = reason == ReportReason.Inappropriate;
        if (hide)
        {
            db.Visualizations.Remove(visualization);
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogWarning("Try-on picture {VisualizationId} of outfit {OutfitId} reported by {UserId}: {Reason}{Hidden}",
            visualization.Id, visualization.OutfitId, userId, EnumCodes.ToCode(reason), hide ? " (removed)" : "");

        if (hide && imageKey is not null)
        {
            await files.DeleteAsync([imageKey], cancellationToken);
        }

        return Unit.Value;
    }
}
