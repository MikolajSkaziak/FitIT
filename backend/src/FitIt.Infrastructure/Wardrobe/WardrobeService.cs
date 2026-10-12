using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Visualizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using SkiaSharp;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>What to show from the wardrobe. Rejected photos appear only when asked for by id.</summary>
public sealed record ClothingQuery
{
    public string? Search { get; init; }

    public Category? Category { get; init; }

    /// <summary>A garment in any of these groups is listed.</summary>
    public IReadOnlyCollection<GarmentGroup>? Groups { get; init; }

    /// <summary>A garment of any of these types is listed.</summary>
    public IReadOnlyCollection<Subcategory>? Types { get; init; }

    /// <summary>A garment with any of these colours is listed.</summary>
    public IReadOnlyCollection<Color>? Colors { get; init; }

    /// <summary>A garment for any of these seasons is listed.</summary>
    public IReadOnlyCollection<Season>? Seasons { get; init; }

    /// <summary>A garment made of any of these materials is listed.</summary>
    public IReadOnlyCollection<Material>? Materials { get; init; }

    /// <summary>Whether the garment is part of at least one of the person's saved outfits.</summary>
    public WardrobeUsage? Usage { get; init; }

    public bool Forgotten { get; init; }

    /// <summary>Exactly these garments, whatever their state: how the upload queue follows what it sent.</summary>
    public IReadOnlyCollection<Guid>? Ids { get; init; }
}

public enum WardrobeUsage
{
    Used,
    Unused,
}

/// <summary>Changes to a garment. A null member means "leave as it is".</summary>
public sealed record ClothingPatch
{
    public Category? Category { get; init; }

    public Subcategory? Subcategory { get; init; }

    public string? Name { get; init; }

    public IReadOnlyList<Color>? Colors { get; init; }

    public Pattern? Pattern { get; init; }

    public Material? Material { get; init; }

    public int? Formality { get; init; }

    public int? Warmth { get; init; }

    public bool? RainOk { get; init; }

    public IReadOnlyList<StyleTag>? Styles { get; init; }

    public IReadOnlyList<Season>? Seasons { get; init; }

    public bool? InLaundry { get; init; }

    public bool? RarelyWorn { get; init; }

    public bool ChangesTags =>
        Category is not null || Subcategory is not null || Name is not null || Colors is not null || Pattern is not null
        || Material is not null || Formality is not null || Warmth is not null || RainOk is not null || Styles is not null || Seasons is not null;
}

public sealed record WardrobeStats(int Total, int WornLast30Days, int Forgotten, int Processing, int NeedsTags);

public sealed class WardrobeService(
    AppDbContext db,
    IImageStorage storage,
    UsageCounters usage,
    IBackgroundJobs jobs,
    AppClock clock,
    PersonalCalendar calendar,
    VisualizationFiles visualizationFiles,
    IOptions<StorageOptions> storageOptions,
    ILogger<WardrobeService> logger)
{
    public const string PhotoContentType = "image/jpeg";
    public const int MaxListed = 500;
    public const int MaxIds = 60;

    public static readonly TimeSpan UploadLifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ReadLifetime = TimeSpan.FromHours(1);

    private static readonly ApiError ConsentRequired =
        ApiError.Forbidden("consent_required", "Consent to processing garment photos by external AI services is needed first.");

    private static readonly ApiError PhotoLimitReached = ApiError.Conflict("photo_limit_reached", "The garment already has as many extra photos as it can hold.") with
    {
        Extensions = new Dictionary<string, object?>(StringComparer.Ordinal) { ["max"] = ClothingPhoto.MaxPerGarment },
    };

    private static readonly ApiError PhotoKeyInUse = ApiError.Conflict("key_in_use", "The photo is already attached to another garment.");

    private static readonly ClothingStatus[] InWardrobe = [ClothingStatus.Processing, ClothingStatus.Ready, ClothingStatus.Failed];

    public long MaxUploadBytes => storageOptions.Value.MaxUploadBytes;

    /// <summary>An address the phone can PUT one photo to during the next five minutes.</summary>
    public async Task<Result<UploadTicket>> CreateUploadAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (!await HasConsentAsync(userId, cancellationToken))
        {
            return ConsentRequired;
        }

        // Asked here so that nobody uploads a photo that is certain to be refused a moment later. The real count is taken when the garment is created.
        if (!await usage.HasRoomAsync(userId, UsageKind.ItemAdded, cancellationToken))
        {
            return await usage.LimitReachedAsync(userId, UsageKind.ItemAdded, cancellationToken);
        }

        return storage.CreateUpload(ObjectKeys.NewOriginal(userId), PhotoContentType, UploadLifetime);
    }

    /// <summary>
    /// Turns an uploaded photo into a garment that is being processed. Sending the same key again returns the same garment
    /// and is counted once.
    /// </summary>
    public async Task<Result<(ClothingItem Item, bool Created)>> AddAsync(Guid userId, string key, CancellationToken cancellationToken)
    {
        if (!ObjectKeys.IsOriginalOf(userId, key))
        {
            return ApiError.BadRequest("key_invalid", "The key is not one issued to this account by POST /api/uploads.");
        }

        if (!await HasConsentAsync(userId, cancellationToken))
        {
            return ConsentRequired;
        }

        if (await FindByKeyAsync(userId, key, cancellationToken) is { } existing)
        {
            return (existing, false);
        }

        if (await CheckUploadAsync(key, cancellationToken) is { } refusal)
        {
            return refusal;
        }

        var now = clock.UtcNow;
        var item = new ClothingItem { Id = Guid.CreateVersion7(), UserId = userId, OriginalKey = key, CreatedAt = now };
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            // The counter and the row stand or fall together: a refused or duplicated garment costs nothing.
            if (!await usage.TryTakeAsync(userId, UsageKind.ItemAdded, cancellationToken))
            {
                return await usage.LimitReachedAsync(userId, UsageKind.ItemAdded, cancellationToken);
            }

            db.Clothes.Add(item);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same key arrived twice at once and the other request won.
                await transaction.RollbackAsync(cancellationToken);
                db.Entry(item).State = EntityState.Detached;
                var winner = await FindByKeyAsync(userId, key, cancellationToken);
                return winner is null ? ApiError.Conflict("key_in_use", "The photo is already being added.") : (winner, false);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        jobs.Enqueue<ClothingProcessor>(processor => processor.RunAsync(item.Id));
        return (item, true);
    }

    public async Task<IReadOnlyList<ClothingItem>> ListAsync(Guid userId, ClothingQuery query, CancellationToken cancellationToken)
    {
        var clothes = db.Clothes.AsNoTracking().Where(item => item.UserId == userId);
        if (query.Ids is { } ids)
        {
            clothes = clothes.Where(item => ids.Contains(item.Id));
        }
        else
        {
            clothes = clothes.Where(item => InWardrobe.Contains(item.Status));
        }

        if (query.Category is { } category)
        {
            clothes = clothes.Where(item => item.Category == category);
        }

        if (query.Groups is { } groups)
        {
            var types = groups.SelectMany(GarmentCatalog.TypesOf).Distinct().ToList();
            clothes = clothes.Where(item => item.Subcategory != null && types.Contains(item.Subcategory.Value));
        }

        if (query.Types is { } wantedTypes)
        {
            var typeList = wantedTypes.ToList();
            clothes = clothes.Where(item => item.Subcategory != null && typeList.Contains(item.Subcategory.Value));
        }

        if (query.Colors is { } wantedColors)
        {
            var colorCodes = wantedColors.Select(EnumCodes.ToCode).ToArray();
            clothes = clothes.Where(item => item.Colors.Any(code => colorCodes.Contains(code)));
        }

        if (query.Seasons is { } wantedSeasons)
        {
            var seasonCodes = wantedSeasons.Select(EnumCodes.ToCode).ToArray();
            clothes = clothes.Where(item => item.Seasons.Any(code => seasonCodes.Contains(code)));
        }

        if (query.Materials is { } wantedMaterials)
        {
            var materialList = wantedMaterials.ToList();
            clothes = clothes.Where(item => item.Material != null && materialList.Contains(item.Material.Value));
        }

        if (query.Usage is { } usageFilter)
        {
            // Only the person's own saved outfits count: an outfit belongs to one person and holds only their garments.
            var used = db.Outfits.Where(outfit => outfit.UserId == userId && outfit.IsSaved).SelectMany(outfit => outfit.Items).Select(part => part.ClothingItemId);
            clothes = usageFilter == WardrobeUsage.Used ? clothes.Where(item => used.Contains(item.Id)) : clothes.Where(item => !used.Contains(item.Id));
        }

        if (query.Search?.Trim() is { Length: > 0 } search)
        {
            var pattern = $"%{search.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal)}%";
            clothes = clothes.Where(item => item.Name != null && EF.Functions.ILike(item.Name, pattern, "\\"));
        }

        if (query.Forgotten)
        {
            clothes = clothes.Where(item => item.Status == ClothingStatus.Ready).Where(ForgottenOn(await calendar.OfAsync(userId, cancellationToken)));
        }

        return await clothes.OrderByDescending(item => item.CreatedAt).ThenBy(item => item.Id).Take(MaxListed).ToListAsync(cancellationToken);
    }

    public Task<ClothingItem?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Clothes.FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

    public async Task<Result<ClothingItem>> UpdateAsync(Guid userId, Guid id, ClothingPatch patch, CancellationToken cancellationToken)
    {
        var item = await FindAsync(userId, id, cancellationToken);
        if (item is null || item.Status == ClothingStatus.Rejected)
        {
            return ApiError.NotFound();
        }

        var now = clock.UtcNow;
        if (patch.ChangesTags)
        {
            if (item.Status == ClothingStatus.Processing)
            {
                return ApiError.Conflict("still_processing", "The garment is still being described. Its tags can be changed once that is done.");
            }

            var merged = Merge(item, patch);
            if (!merged.IsOk)
            {
                return merged.Error!;
            }

            item.Retag(merged.Value, now);
        }

        item.SetFlags(patch.InLaundry, patch.RarelyWorn, now);
        await db.SaveChangesAsync(cancellationToken);
        return item;
    }

    /// <summary>Removes the garment, both of its pictures, its extra photos, the outfits it was part of and the visualizations of those.</summary>
    public async Task<Result<Unit>> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        var item = await FindAsync(userId, id, cancellationToken);
        if (item is null)
        {
            return ApiError.NotFound();
        }

        IReadOnlyList<string> visualizationKeys;
        IReadOnlyList<string> photoKeys;
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            // The rows of its extra photos go with the garment; their files are named here, while the rows still say where they are.
            photoKeys = await db.ClothingPhotos.Where(photo => photo.ClothingItemId == id).Select(photo => photo.Key).ToListAsync(cancellationToken);
            // An outfit with a hole in it is no outfit: every outfit the garment was part of goes with it, and so do its visualizations.
            // Their pictures are files, so their keys are read before the rows are gone.
            var outfitIds = db.Outfits.Where(outfit => outfit.UserId == userId && outfit.Items.Any(part => part.ClothingItemId == id)).Select(outfit => outfit.Id);
            visualizationKeys = await visualizationFiles.KeysOfAsync(outfitIds, cancellationToken);
            await db.Outfits.Where(outfit => outfit.UserId == userId && outfit.Items.Any(part => part.ClothingItemId == id)).ExecuteDeleteAsync(cancellationToken);
            db.Clothes.Remove(item);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        await DeleteFilesAsync(item, photoKeys, cancellationToken);
        await visualizationFiles.DeleteAsync([.. visualizationKeys], cancellationToken);
        return Unit.Value;
    }

    /// <summary>Another try at describing the garment, on request.</summary>
    public async Task<Result<ClothingItem>> ReprocessAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        var item = await FindAsync(userId, id, cancellationToken);
        if (item is null || item.Status == ClothingStatus.Rejected)
        {
            return ApiError.NotFound();
        }

        if (!await HasConsentAsync(userId, cancellationToken))
        {
            return ConsentRequired;
        }

        if (item.Status != ClothingStatus.Processing)
        {
            item.Restart(clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            jobs.Enqueue<ClothingProcessor>(processor => processor.RunAsync(item.Id));
        }

        return item;
    }

    /// <summary>
    /// An address the phone can PUT one extra photo of this garment to. Not counted against the day's new clothes: nothing
    /// is done to the photo, so it costs nothing.
    /// </summary>
    public async Task<Result<UploadTicket>> CreatePhotoUploadAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        if (await FindOwnedAsync(userId, id, cancellationToken) is null)
        {
            return ApiError.NotFound();
        }

        // Asked here so that nobody uploads a photo that is certain to be refused a moment later. The real count is taken when the photo is added.
        if (await db.ClothingPhotos.CountAsync(photo => photo.ClothingItemId == id, cancellationToken) >= ClothingPhoto.MaxPerGarment)
        {
            return PhotoLimitReached;
        }

        return storage.CreateUpload(ObjectKeys.NewExtra(userId), PhotoContentType, UploadLifetime);
    }

    /// <summary>
    /// Attaches an uploaded photo to the garment as it is: no background removal, no AI service. Sending the same key again
    /// returns the same photo.
    /// </summary>
    public async Task<Result<(ClothingPhoto Photo, bool Created)>> AddPhotoAsync(Guid userId, Guid id, string key, CancellationToken cancellationToken)
    {
        // The garment first: somebody else's answers "not found" whatever else is wrong with the request.
        if (await FindOwnedAsync(userId, id, cancellationToken) is null)
        {
            return ApiError.NotFound();
        }

        if (!ObjectKeys.IsExtraOf(userId, key))
        {
            return ApiError.BadRequest("key_invalid", "The key is not one issued to this account by POST /api/clothes/{id}/photos/uploads.");
        }

        if (await db.ClothingPhotos.AsNoTracking().FirstOrDefaultAsync(photo => photo.Key == key, cancellationToken) is { } existing)
        {
            return existing.ClothingItemId == id ? (existing, false) : PhotoKeyInUse;
        }

        if (await CheckUploadAsync(key, cancellationToken) is { } refusal)
        {
            return refusal;
        }

        if (PhotoSize(await storage.ReadAsync(key, null, cancellationToken)) is not { } size)
        {
            await storage.DeleteAsync([key], cancellationToken);
            return ApiError.BadRequest("upload_not_jpeg", "The file is not a JPEG photo.");
        }

        var photo = new ClothingPhoto { Id = Guid.CreateVersion7(), ClothingItemId = id, Key = key, Width = size.Width, Height = size.Height, CreatedAt = clock.UtcNow };
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            // The garment's row is held for the count and the insert, so photos arriving at once cannot each see room for themselves.
            var held = await db.Database.ExecuteSqlAsync($"UPDATE clothing_items SET updated_at = updated_at WHERE id = {id} AND user_id = {userId}", cancellationToken);
            if (held == 0)
            {
                // Deleted since it was found. The file has no row; the nightly sweep removes it.
                return ApiError.NotFound();
            }

            if (await db.ClothingPhotos.CountAsync(found => found.ClothingItemId == id, cancellationToken) >= ClothingPhoto.MaxPerGarment)
            {
                await transaction.RollbackAsync(cancellationToken);
                await storage.DeleteAsync([key], cancellationToken);
                return PhotoLimitReached;
            }

            db.ClothingPhotos.Add(photo);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same key arrived twice at once and the other request won.
                await transaction.RollbackAsync(cancellationToken);
                db.Entry(photo).State = EntityState.Detached;
                var winner = await db.ClothingPhotos.AsNoTracking().FirstOrDefaultAsync(found => found.Key == key, cancellationToken);
                return winner is not null && winner.ClothingItemId == id ? (winner, false) : PhotoKeyInUse;
            }

            await transaction.CommitAsync(cancellationToken);
        }

        return (photo, true);
    }

    /// <summary>Removes one extra photo of a garment and its file. The garment's main picture is not one of these.</summary>
    public async Task<Result<Unit>> DeletePhotoAsync(Guid userId, Guid id, Guid photoId, CancellationToken cancellationToken)
    {
        var photo = await db.ClothingPhotos.FirstOrDefaultAsync(
            found => found.Id == photoId && found.ClothingItemId == id && db.Clothes.Any(item => item.Id == id && item.UserId == userId),
            cancellationToken);
        if (photo is null)
        {
            return ApiError.NotFound();
        }

        db.ClothingPhotos.Remove(photo);
        await db.SaveChangesAsync(cancellationToken);
        await DeletePhotoFilesAsync([photo.Key], id, cancellationToken);
        return Unit.Value;
    }

    /// <summary>The extra photos of these garments, each garment's in the order they were added.</summary>
    public async Task<ILookup<Guid, ClothingPhoto>> PhotosOfAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        var photos = ids.Count == 0
            ? []
            : await db.ClothingPhotos.AsNoTracking()
                .Where(photo => ids.Contains(photo.ClothingItemId))
                .OrderBy(photo => photo.CreatedAt).ThenBy(photo => photo.Id)
                .ToListAsync(cancellationToken);
        return photos.ToLookup(photo => photo.ClothingItemId);
    }

    /// <summary>The signed address of an extra photo, valid for an hour.</summary>
    public Uri ImageUrl(ClothingPhoto photo) => storage.SignRead(photo.Key, ReadLifetime);

    /// <summary>Removes the rows of a garment's extra photos and returns the keys of their files, for whoever deletes the files next.</summary>
    internal async Task<IReadOnlyList<string>> TakePhotosAsync(Guid id, CancellationToken cancellationToken)
    {
        var keys = await db.ClothingPhotos.Where(photo => photo.ClothingItemId == id).Select(photo => photo.Key).ToListAsync(cancellationToken);
        if (keys.Count > 0)
        {
            await db.ClothingPhotos.Where(photo => photo.ClothingItemId == id).ExecuteDeleteAsync(cancellationToken);
        }

        return keys;
    }

    public async Task<WardrobeStats> StatsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var today = await calendar.OfAsync(userId, cancellationToken);
        var recently = today.Today.AddDays(-ClothingItem.ForgottenAfterDays);
        var mine = db.Clothes.AsNoTracking().Where(item => item.UserId == userId);
        var ready = mine.Where(item => item.Status == ClothingStatus.Ready);
        return new WardrobeStats(
            await ready.CountAsync(cancellationToken),
            await ready.CountAsync(item => item.LastWornOn > recently, cancellationToken),
            await ready.Where(ForgottenOn(today)).CountAsync(cancellationToken),
            await mine.CountAsync(item => item.Status == ClothingStatus.Processing, cancellationToken),
            await mine.CountAsync(item => item.Status == ClothingStatus.Failed, cancellationToken));
    }

    /// <summary>The signed address of the picture to show, valid for an hour.</summary>
    public Uri ImageUrl(ClothingItem item) => storage.SignRead(item.ImageKey, ReadLifetime);

    /// <summary>The person's own day: what "forgotten" and wear dates are counted against.</summary>
    public Task<LocalDay> TodayOfAsync(Guid userId, CancellationToken cancellationToken) => calendar.OfAsync(userId, cancellationToken);

    public static bool IsForgotten(ClothingItem item, LocalDay today) => item.Status == ClothingStatus.Ready && item.IsForgotten(today.Today, today.Zone);

    /// <summary>Deletes the garment's own pictures and the given extra photos of it.</summary>
    internal async Task DeleteFilesAsync(ClothingItem item, IReadOnlyCollection<string> photoKeys, CancellationToken cancellationToken)
    {
        string[] keys = item.CutoutKey is { } cutout && cutout != item.OriginalKey ? [item.OriginalKey, cutout, .. photoKeys] : [item.OriginalKey, .. photoKeys];
        try
        {
            await storage.DeleteAsync(keys, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // The row is gone; the nightly sweep removes files that no row points to.
            logger.LogWarning(exception, "Could not delete the files of garment {ItemId}; the orphan sweep will", item.Id);
        }
    }

    /// <summary>The same rule as <see cref="ClothingItem.IsForgotten"/>, in a form the database can evaluate.</summary>
    private static System.Linq.Expressions.Expression<Func<ClothingItem, bool>> ForgottenOn(LocalDay today)
    {
        var lastDay = today.Today.AddDays(-ClothingItem.ForgottenAfterDays);
        var createdBefore = today.StartOf(lastDay.AddDays(1));
        return item => item.RarelyWorn || (item.LastWornOn != null ? item.LastWornOn <= lastDay : item.CreatedAt < createdBefore);
    }

    private static Result<GarmentTags> Merge(ClothingItem item, ClothingPatch patch)
    {
        var current = item.Tags;
        var category = patch.Category ?? current?.Category;
        var type = patch.Subcategory ?? current?.Subcategory;
        var name = patch.Name ?? current?.Name;
        var colors = patch.Colors ?? current?.Colors;
        var pattern = patch.Pattern ?? current?.Pattern;
        var material = patch.Material ?? current?.Material;
        var formality = patch.Formality ?? current?.Formality;
        var warmth = patch.Warmth ?? current?.Warmth;
        var rainOk = patch.RainOk ?? current?.RainOk;
        if (category is null || type is null || name is null || colors is null || pattern is null || material is null || formality is null || warmth is null || rainOk is null)
        {
            return ApiError.BadRequest("tags_incomplete", "A garment without tags needs all of them at once: category, type, name, colours, pattern, material, formality, warmth and rain.");
        }

        var tags = new GarmentTags(category.Value, type.Value, name, colors, pattern.Value, material.Value, formality.Value, warmth.Value, rainOk.Value, patch.Styles ?? current?.Styles ?? [], patch.Seasons ?? current?.Seasons);
        return tags.Check() is { } problem ? problem : tags;
    }

    /// <summary>The person's garment that can hold photos: a refused one has no pictures at all.</summary>
    private Task<ClothingItem?> FindOwnedAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Clothes.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId && item.Status != ClothingStatus.Rejected, cancellationToken);

    /// <summary>The size of a JPEG as it is shown (a camera may store it lying on its side), or null when it is not a readable JPEG.</summary>
    private static (int Width, int Height)? PhotoSize(byte[] content)
    {
        using var data = SKData.CreateCopy(content);
        using var codec = SKCodec.Create(data);
        if (codec is null || codec.EncodedFormat != SKEncodedImageFormat.Jpeg || codec.Info.Width <= 0 || codec.Info.Height <= 0)
        {
            return null;
        }

        var turned = codec.EncodedOrigin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        return turned ? (codec.Info.Height, codec.Info.Width) : (codec.Info.Width, codec.Info.Height);
    }

    private async Task DeletePhotoFilesAsync(IReadOnlyCollection<string> keys, Guid itemId, CancellationToken cancellationToken)
    {
        try
        {
            await storage.DeleteAsync(keys, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // The row is gone; the nightly sweep removes files that no row points to.
            logger.LogWarning(exception, "Could not delete a photo of garment {ItemId}; the orphan sweep will", itemId);
        }
    }

    private Task<ClothingItem?> FindByKeyAsync(Guid userId, string key, CancellationToken cancellationToken) =>
        db.Clothes.FirstOrDefaultAsync(item => item.UserId == userId && item.OriginalKey == key, cancellationToken);

    private async Task<bool> HasConsentAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.AnyAsync(user => user.Id == userId && user.AiConsentAt != null, cancellationToken);

    /// <summary>Looks at what was really uploaded: there, small enough, and a JPEG by its first bytes (not by what the sender claimed).</summary>
    private async Task<ApiError?> CheckUploadAsync(string key, CancellationToken cancellationToken)
    {
        var uploaded = await storage.FindAsync(key, cancellationToken);
        if (uploaded is null)
        {
            return ApiError.BadRequest("upload_missing", "No file was uploaded under this key. Ask for a new upload address and send the photo again.");
        }

        ApiError? refusal = null;
        if (uploaded.Size > MaxUploadBytes)
        {
            refusal = ApiError.BadRequest("upload_too_large", "The photo is larger than the limit.") with
            {
                Extensions = new Dictionary<string, object?>(StringComparer.Ordinal) { ["maxBytes"] = MaxUploadBytes },
            };
        }
        else
        {
            var head = await storage.ReadAsync(key, 3, cancellationToken);
            if (head is not [0xFF, 0xD8, 0xFF])
            {
                refusal = ApiError.BadRequest("upload_not_jpeg", "The file is not a JPEG photo.");
            }
        }

        if (refusal is not null)
        {
            await storage.DeleteAsync([key], cancellationToken);
        }

        return refusal;
    }
}
