using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>How many pieces a request added, and how many of its codes the wardrobe already had.</summary>
public sealed record StarterAddition(int Added, int AlreadyThere);

/// <summary>
/// Adds the common pieces of <see cref="StarterCatalog"/> to a wardrobe as garments that are ready at once: no photo, no AI call,
/// no consent, and nothing counted against the daily limit of added items. Each garment gets its own copy of the picture under the
/// person's prefix, so deleting it, or the account, cleans up like for any other garment.
/// </summary>
public sealed class StarterPieceService(AppDbContext db, IImageStorage storage, IWebHostEnvironment environment, AppClock clock, ILogger<StarterPieceService> logger)
{
    public const string PictureContentType = "image/png";

    /// <summary>The codes of the starter pieces that have a garment in this person's wardrobe right now.</summary>
    public async Task<HashSet<string>> AddedCodesAsync(Guid userId, CancellationToken cancellationToken) =>
        [.. await db.Clothes.AsNoTracking()
            .Where(item => item.UserId == userId && item.StarterCode != null)
            .Select(item => item.StarterCode!)
            .ToListAsync(cancellationToken)];

    /// <summary>Codes already in the wardrobe are skipped, so saying the same thing twice changes nothing.</summary>
    public async Task<Result<StarterAddition>> AddAsync(Guid userId, IReadOnlyCollection<string> codes, CancellationToken cancellationToken)
    {
        var wanted = new List<StarterPiece>();
        foreach (var code in codes.Distinct(StringComparer.Ordinal))
        {
            if (StarterCatalog.Find(code) is not { } piece)
            {
                return ApiError.BadRequest("starter_piece_unknown", "One of the codes is not a starter piece. Ask GET /api/starter-pieces for the list.");
            }

            wanted.Add(piece);
        }

        var codesWanted = wanted.Select(piece => piece.Code).ToList();
        var have = await db.Clothes.AsNoTracking()
            .Where(item => item.UserId == userId && item.StarterCode != null && codesWanted.Contains(item.StarterCode))
            .Select(item => item.StarterCode!)
            .ToListAsync(cancellationToken);
        var missing = wanted.Where(piece => !have.Contains(piece.Code, StringComparer.Ordinal)).ToList();
        if (missing.Count == 0)
        {
            return new StarterAddition(0, wanted.Count);
        }

        var now = clock.UtcNow;
        var written = new List<string>();
        try
        {
            foreach (var piece in missing)
            {
                var content = await ReadPictureAsync(piece, cancellationToken);
                var id = Guid.CreateVersion7();
                // One file serves as the original and as the cutout: the picture is already free of background.
                var key = ObjectKeys.Cutout(userId, id, "png");
                await storage.WriteAsync(key, content, PictureContentType, cancellationToken);
                written.Add(key);

                var item = new ClothingItem { Id = id, UserId = userId, OriginalKey = key, StarterCode = piece.Code, CreatedAt = now };
                item.AttachCutout(key, now);
                item.MarkReady(piece.Tags, piece.Tags.Describe(), now);
                db.Clothes.Add(item);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The same pieces arrived twice at once and the other request won: ours add nothing, and their files go.
            db.ChangeTracker.Clear();
            await DeleteAsync(written);
            return new StarterAddition(0, wanted.Count);
        }
        catch
        {
            await DeleteAsync(written);
            throw;
        }

        return new StarterAddition(missing.Count, wanted.Count - missing.Count);
    }

    private async Task<byte[]> ReadPictureAsync(StarterPiece piece, CancellationToken cancellationToken)
    {
        var file = environment.WebRootFileProvider.GetFileInfo(piece.ImagePath);
        if (!file.Exists)
        {
            throw new InvalidOperationException($"The starter picture {piece.ImagePath} is missing from the static files.");
        }

        await using var stream = file.CreateReadStream();
        using var memory = new MemoryStream();
        await stream.CopyToAsync(memory, cancellationToken);
        var picture = memory.ToArray();
        return CutoutTrimmer.Trim(picture) ?? picture;
    }

    private async Task DeleteAsync(List<string> keys)
    {
        if (keys.Count == 0)
        {
            return;
        }

        try
        {
            await storage.DeleteAsync(keys, CancellationToken.None);
        }
        catch (Exception exception)
        {
            // The nightly sweep removes files that no row points to.
            logger.LogWarning(exception, "Could not delete the pictures of starter pieces that were not added; the orphan sweep will");
        }
    }
}
