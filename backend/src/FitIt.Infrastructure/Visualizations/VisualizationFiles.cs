using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>
/// The pictures of visualizations leave with the outfit they were made for. The rows follow their outfit by cascade, so
/// the keys have to be read before the outfit is deleted, and the files removed after.
/// </summary>
public sealed class VisualizationFiles(AppDbContext db, IImageStorage storage, ILogger<VisualizationFiles> logger)
{
    /// <summary>Keys of the finished pictures made for the outfits selected by <paramref name="outfitIds"/>.</summary>
    public async Task<IReadOnlyList<string>> KeysOfAsync(IQueryable<Guid> outfitIds, CancellationToken cancellationToken) =>
        await db.Visualizations.AsNoTracking()
            .Where(visualization => visualization.ImageKey != null && outfitIds.Contains(visualization.OutfitId))
            .Select(visualization => visualization.ImageKey!)
            .ToListAsync(cancellationToken);

    public async Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        if (keys.Count == 0)
        {
            return;
        }

        try
        {
            await storage.DeleteAsync(keys, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // The rows are gone; the nightly sweep removes files that no row points to.
            logger.LogWarning(exception, "Could not delete {Count} visualization files; the orphan sweep will", keys.Count);
        }
    }
}
