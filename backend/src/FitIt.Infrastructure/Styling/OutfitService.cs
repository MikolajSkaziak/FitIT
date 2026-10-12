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

/// <summary>
/// What a person does with an outfit after it was proposed. A null member means "leave as it is"; the board is only
/// touched with <c>Arrange</c>, and then a null or empty <c>Layout</c> goes back to the automatic one; the figure likewise
/// with <c>ArrangeFigure</c> and <c>FigureLayout</c>.
/// </summary>
public sealed record OutfitPatch(
    bool? Saved, OutfitRating? Rating, bool Wear, bool Arrange = false, IReadOnlyList<OutfitPlacement>? Layout = null,
    bool ArrangeFigure = false, IReadOnlyList<OutfitPlacement>? FigureLayout = null);

/// <summary>The person's outfits: the saved ones, their ratings, and "I am wearing this" (product spec 9).</summary>
public sealed class OutfitService(AppDbContext db, AppClock clock, PersonalCalendar calendar, VisualizationFiles visualizationFiles)
{
    public const int MaxListed = 200;

    public static readonly ApiError LayoutInvalid = ApiError.BadRequest(
        "layout_invalid", "An arrangement places each garment of the outfit at most once, on the board (x and y from 0 to 1) and at a size that can be seen.");

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

        if (patch.Arrange)
        {
            if (patch.Layout is { } layout && !Outfit.FitsLayout(layout, [.. outfit.Items.Select(item => item.ClothingItemId)]))
            {
                return LayoutInvalid;
            }

            outfit.Arrange(patch.Layout);
        }

        if (patch.ArrangeFigure)
        {
            if (patch.FigureLayout is { } figureLayout && !Outfit.FitsLayout(figureLayout, [.. outfit.Items.Select(item => item.ClothingItemId)]))
            {
                return LayoutInvalid;
            }

            outfit.ArrangeFigure(patch.FigureLayout);
        }

        var now = clock.UtcNow;
        // Wearing writes to the calendar in a statement of its own; the outfit, its garments and the day are kept together or not at all.
        await using var transaction = patch.Wear ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
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
            await RecordWearAsync(outfit, today, cancellationToken);
            // The calendar gets the day too: a planned entry for today becomes a worn one, and without one a worn entry is
            // written, after whatever the day already holds. One statement, so the button pressed twice at once still leaves one entry. Wearing is a fact, so
            // the cap on what can be planned for a day does not refuse it.
            var entry = CalendarEntry.Of(userId, outfit.Id, today, worn: true, now);
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO calendar_entries (id, user_id, outfit_id, day, worn, created_at)
                VALUES ({entry.Id}, {userId}, {outfit.Id}, {today}, TRUE, GREATEST({now}, (
                    SELECT max(created_at) + interval '1 microsecond' FROM calendar_entries WHERE user_id = {userId} AND day = {today})))
                ON CONFLICT (user_id, day, outfit_id) DO UPDATE SET worn = TRUE
                """, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return (await ViewAsync([outfit], cancellationToken))[0];
    }

    /// <summary>
    /// Writes "worn on this day" on a tracked outfit and on its garments; the caller saves. A garment counts once per day,
    /// however many outfits worn that day it is part of and however often it is said.
    /// </summary>
    public async Task RecordWearAsync(Outfit outfit, DateOnly day, CancellationToken cancellationToken)
    {
        outfit.Wear(day);
        var ids = outfit.Items.Select(item => item.ClothingItemId).ToList();
        var already = await db.CalendarEntries
            .Where(entry => entry.UserId == outfit.UserId && entry.Day == day && entry.Worn && entry.OutfitId != outfit.Id)
            .SelectMany(entry => db.OutfitItems.Where(item => item.OutfitId == entry.OutfitId).Select(item => item.ClothingItemId))
            .Distinct()
            .ToListAsync(cancellationToken);
        var now = clock.UtcNow;
        foreach (var garment in await db.Clothes.Where(item => ids.Contains(item.Id) && !already.Contains(item.Id)).ToListAsync(cancellationToken))
        {
            garment.RecordWear(day, now);
        }
    }

    public async Task<Result<Unit>> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        // The visualizations and the calendar entries follow the outfit by cascade; their pictures are files and have to be named before the rows are gone.
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
