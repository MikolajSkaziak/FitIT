using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Visualizations;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Styling;

/// <summary>An outfit together with its garments, in the order of the slots, and the newest visualization made for it, if any.</summary>
public sealed record OutfitView(Outfit Outfit, IReadOnlyList<ClothingItem> Garments, Visualization? Visualization = null);

/// <summary>What a person does with an outfit after it was proposed. A null member means "leave as it is".</summary>
public sealed record OutfitPatch(bool? Saved, OutfitRating? Rating, bool Wear);

/// <summary>The person's outfits: the saved ones, their ratings, and "I am wearing this" (product spec 9).</summary>
public sealed class OutfitService(AppDbContext db, AppClock clock, PersonalCalendar calendar, VisualizationFiles visualizationFiles)
{
    public const int MaxListed = 200;

    /// <summary>Newest request first. With <paramref name="saved"/> only the outfits the person kept (or only those they did not).</summary>
    public async Task<IReadOnlyList<OutfitView>> ListAsync(Guid userId, bool? saved, CancellationToken cancellationToken)
    {
        var mine = db.Outfits.AsNoTracking().Include(outfit => outfit.Items).Where(outfit => outfit.UserId == userId);
        if (saved is { } wanted)
        {
            mine = mine.Where(outfit => outfit.IsSaved == wanted);
        }

        // Within one request the ids rise in the order the proposals were shown: best score first.
        var found = await mine.OrderByDescending(outfit => outfit.CreatedAt).ThenBy(outfit => outfit.Id)
            .Take(MaxListed).ToListAsync(cancellationToken);
        return await ViewAsync(found, cancellationToken);
    }

    /// <summary>Somebody else's outfit is not found, exactly like one that does not exist.</summary>
    public async Task<Result<OutfitView>> GetAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        await FindAsync(userId, id, cancellationToken) is { } outfit ? (await ViewAsync([outfit], cancellationToken))[0] : ApiError.NotFound();

    public async Task<Result<OutfitView>> UpdateAsync(Guid userId, Guid id, OutfitPatch patch, CancellationToken cancellationToken)
    {
        var outfit = await FindAsync(userId, id, cancellationToken);
        if (outfit is null)
        {
            return ApiError.NotFound();
        }

        var now = clock.UtcNow;
        if (patch.Saved is { } saved)
        {
            outfit.Save(saved);
        }

        if (patch.Rating is { } rating)
        {
            outfit.Rate(rating, now);
        }

        if (patch.Wear)
        {
            // The day is the person's own: somebody in Tokyo who dresses at seven wears the outfit on their date, not on the server's.
            var today = (await calendar.OfAsync(userId, cancellationToken)).Today;
            outfit.Wear(today);
            var ids = outfit.Items.Select(item => item.ClothingItemId).ToList();
            foreach (var garment in await db.Clothes.Where(item => ids.Contains(item.Id)).ToListAsync(cancellationToken))
            {
                // Counted once per garment and day, however many outfits it is part of and however often the button is pressed.
                garment.RecordWear(today, now);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return (await ViewAsync([outfit], cancellationToken))[0];
    }

    public async Task<Result<Unit>> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        // The visualizations follow the outfit by cascade; their pictures are files and have to be named before the rows are gone.
        var files = await visualizationFiles.KeysOfAsync(db.Outfits.Where(outfit => outfit.Id == id && outfit.UserId == userId).Select(outfit => outfit.Id), cancellationToken);
        var deleted = await db.Outfits.Where(outfit => outfit.Id == id && outfit.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0)
        {
            return ApiError.NotFound();
        }

        await visualizationFiles.DeleteAsync([.. files], cancellationToken);
        return Unit.Value;
    }

    /// <summary>Loads the garments and the newest visualization of the given outfits, one query each.</summary>
    public async Task<IReadOnlyList<OutfitView>> ViewAsync(IReadOnlyList<Outfit> outfits, CancellationToken cancellationToken)
    {
        var ids = outfits.SelectMany(outfit => outfit.Items).Select(item => item.ClothingItemId).Distinct().ToList();
        var clothes = await db.Clothes.AsNoTracking().Where(item => ids.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);
        var outfitIds = outfits.Select(outfit => outfit.Id).ToList();
        var newest = (await db.Visualizations.AsNoTracking().Where(visualization => outfitIds.Contains(visualization.OutfitId)).ToListAsync(cancellationToken))
            .GroupBy(visualization => visualization.OutfitId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(visualization => visualization.CreatedAt).ThenByDescending(visualization => visualization.Id).First());
        return
        [
            .. outfits.Select(outfit => new OutfitView(
                outfit,
                [.. outfit.Items.OrderBy(item => item.Slot).ThenBy(item => item.ClothingItemId).Select(item => clothes[item.ClothingItemId])],
                newest.GetValueOrDefault(outfit.Id))),
        ];
    }

    private Task<Outfit?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Outfits.Include(outfit => outfit.Items).FirstOrDefaultAsync(outfit => outfit.Id == id && outfit.UserId == userId, cancellationToken);
}
