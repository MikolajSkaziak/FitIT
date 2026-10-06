using FitIt.Core.Common;

namespace FitIt.Core.Wardrobe;

/// <summary>A garment in somebody's wardrobe: its photo, its tags once known, and how it has been used.</summary>
public sealed class ClothingItem
{
    public const int DescriptionMaxLength = 300;

    /// <summary>A garment counts as forgotten after this many days without being worn (product spec 6.1).</summary>
    public const int ForgottenAfterDays = 30;

    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public ClothingStatus Status { get; private set; } = ClothingStatus.Processing;

    /// <summary>Storage key of the photo as the phone sent it. Unique: sending the same key twice is the same garment.</summary>
    public required string OriginalKey { get; init; }

    /// <summary>Storage key of the picture without background. Equals <see cref="OriginalKey"/> when removal did not work.</summary>
    public string? CutoutKey { get; private set; }

    public Category? Category { get; private set; }

    public Subcategory? Subcategory { get; private set; }

    public string? Name { get; private set; }

    /// <summary>One English sentence for the models.</summary>
    public string? Description { get; private set; }

    /// <summary>Colour codes, the main one first.</summary>
    public string[] Colors { get; private set; } = [];

    public Pattern? Pattern { get; private set; }

    public Material? Material { get; private set; }

    public int? Formality { get; private set; }

    public int? Warmth { get; private set; }

    public bool? RainOk { get; private set; }

    /// <summary>Style codes.</summary>
    public string[] Styles { get; private set; } = [];

    /// <summary>Left out of proposals until switched off.</summary>
    public bool InLaundry { get; private set; }

    /// <summary>Set by the person: "I rarely wear this". Makes the garment a candidate for the "discovery" proposal.</summary>
    public bool RarelyWorn { get; private set; }

    public int WearCount { get; private set; }

    public DateOnly? LastWornOn { get; private set; }

    public RejectReason? RejectReason { get; private set; }

    /// <summary>Tries of the current processing step (background removal, then tagging).</summary>
    public int Attempts { get; private set; }

    /// <summary>Set while the day's AI budget is used up: processing continues after this moment.</summary>
    public DateTimeOffset? DeferredUntil { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>The picture to show: the cutout when there is one.</summary>
    public string ImageKey => CutoutKey ?? OriginalKey;

    public GarmentTags? Tags =>
        Category is { } category && Subcategory is { } type && Name is { } name && Pattern is { } pattern && Material is { } material
        && Formality is { } formality && Warmth is { } warmth && RainOk is { } rainOk && Colors.Length > 0
            ? new GarmentTags(category, type, name, [.. Colors.Select(EnumCodes.Parse<Color>)], pattern, material, formality, warmth, rainOk,
                [.. Styles.Select(EnumCodes.Parse<StyleTag>)])
            : null;

    /// <summary>Flagged as rarely worn, or not worn for thirty days (counted from the day it was added if never worn).</summary>
    public bool IsForgotten(DateOnly today, TimeZoneInfo zone)
    {
        var since = LastWornOn ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(CreatedAt, zone).DateTime);
        return RarelyWorn || since.AddDays(ForgottenAfterDays) <= today;
    }

    public void BeginAttempt(DateTimeOffset now)
    {
        Attempts++;
        DeferredUntil = null;
        UpdatedAt = now;
    }

    /// <summary>The picture step is settled (with a real cutout or with the original standing in); tagging starts counting afresh.</summary>
    public void AttachCutout(string key, DateTimeOffset now)
    {
        CutoutKey = key;
        Attempts = 0;
        UpdatedAt = now;
    }

    public void Defer(DateTimeOffset until, DateTimeOffset now)
    {
        DeferredUntil = until;
        UpdatedAt = now;
    }

    public void MarkReady(GarmentTags tags, string description, DateTimeOffset now)
    {
        Write(tags, description);
        Status = ClothingStatus.Ready;
        RejectReason = null;
        DeferredUntil = null;
        UpdatedAt = now;
    }

    public void MarkFailed(DateTimeOffset now)
    {
        Status = ClothingStatus.Failed;
        DeferredUntil = null;
        UpdatedAt = now;
    }

    public void MarkRejected(RejectReason reason, DateTimeOffset now)
    {
        Status = ClothingStatus.Rejected;
        RejectReason = reason;
        DeferredUntil = null;
        UpdatedAt = now;
    }

    /// <summary>Another try at tagging on request. The picture step is kept if it produced a real cutout.</summary>
    public void Restart(DateTimeOffset now)
    {
        Status = ClothingStatus.Processing;
        Attempts = 0;
        DeferredUntil = null;
        if (CutoutKey == OriginalKey)
        {
            CutoutKey = null;
        }

        UpdatedAt = now;
    }

    /// <summary>Tags given or corrected by the person. A garment that was waiting for tags becomes usable.</summary>
    public void Retag(GarmentTags tags, DateTimeOffset now)
    {
        Write(tags, tags.Describe());
        if (Status == ClothingStatus.Failed)
        {
            Status = ClothingStatus.Ready;
        }

        UpdatedAt = now;
    }

    public void SetFlags(bool? inLaundry, bool? rarelyWorn, DateTimeOffset now)
    {
        InLaundry = inLaundry ?? InLaundry;
        RarelyWorn = rarelyWorn ?? RarelyWorn;
        UpdatedAt = now;
    }

    /// <summary>"I am wearing this today". Counted once per day however often it is said.</summary>
    public void RecordWear(DateOnly day, DateTimeOffset now)
    {
        if (LastWornOn == day)
        {
            return;
        }

        WearCount++;
        LastWornOn = LastWornOn is { } last && last > day ? last : day;
        UpdatedAt = now;
    }

    private void Write(GarmentTags tags, string description)
    {
        Category = tags.Category;
        Subcategory = tags.Subcategory;
        Name = tags.Name.Trim();
        Description = description.Length > DescriptionMaxLength ? description[..DescriptionMaxLength] : description;
        Colors = [.. tags.Colors.Select(EnumCodes.ToCode)];
        Pattern = tags.Pattern;
        Material = tags.Material;
        Formality = tags.Formality;
        Warmth = tags.Warmth;
        RainOk = tags.RainOk;
        Styles = [.. tags.Styles.Select(EnumCodes.ToCode)];
    }
}
