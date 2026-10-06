using System.ComponentModel.DataAnnotations;
using FitIt.Core.Wardrobe;

namespace FitIt.Api.Contracts;

/// <summary>Where the phone sends one photo: PUT the JPEG to <c>Url</c> with exactly these headers before it expires.</summary>
public sealed record UploadResponse(string Key, string Url, string Method, IReadOnlyDictionary<string, string> Headers, DateTimeOffset ExpiresAt, long MaxBytes);

public sealed class AddClothingRequest
{
    /// <summary>The key returned by <c>POST /api/uploads</c>, after the photo was uploaded.</summary>
    [Required, MaxLength(120)]
    public string Key { get; init; } = "";
}

/// <summary>Any subset of the tags and flags. A garment that has no tags yet needs all tags at once.</summary>
public sealed class UpdateClothingRequest
{
    public Category? Category { get; init; }

    public Subcategory? Subcategory { get; init; }

    [MinLength(1), MaxLength(GarmentTags.NameMaxLength)]
    public string? Name { get; init; }

    [MinLength(1), MaxLength(GarmentTags.MaxColors)]
    public Color[]? Colors { get; init; }

    public Pattern? Pattern { get; init; }

    public Material? Material { get; init; }

    [Range(GarmentCatalog.ScaleMin, GarmentCatalog.ScaleMax)]
    public int? Formality { get; init; }

    [Range(GarmentCatalog.ScaleMin, GarmentCatalog.ScaleMax)]
    public int? Warmth { get; init; }

    public bool? RainOk { get; init; }

    [MaxLength(5)]
    public StyleTag[]? Styles { get; init; }

    public bool? InLaundry { get; init; }

    public bool? RarelyWorn { get; init; }
}

/// <summary>
/// A garment. Tags are null while it is being processed or when tagging failed.
/// <c>ImageUrl</c> is signed and lasts an hour; cache the picture under <c>ImageKey</c>, which does not change.
/// </summary>
public sealed record ClothingResponse(
    Guid Id,
    ClothingStatus Status,
    string? Name,
    Category? Category,
    Subcategory? Subcategory,
    IReadOnlyList<Color> Colors,
    Pattern? Pattern,
    Material? Material,
    int? Formality,
    int? Warmth,
    bool? RainOk,
    IReadOnlyList<StyleTag> Styles,
    bool InLaundry,
    bool RarelyWorn,
    bool IsForgotten,
    int WearCount,
    DateOnly? LastWornOn,
    RejectReason? RejectReason,
    string? ImageUrl,
    string? ImageKey,
    DateTimeOffset CreatedAt);

public sealed record WardrobeStatsResponse(int Total, int WornLast30Days, int Forgotten, int Processing, int NeedsTags);

public sealed record UsageLineResponse(int Used, int Limit);

/// <summary>What has been used today out of the daily limits, and when the count starts again.</summary>
public sealed record UsageResponse(UsageLineResponse Items, UsageLineResponse Suggestions, UsageLineResponse Visualizations, DateTimeOffset ResetsAt);

public sealed record TypeEntry(Subcategory Code, string Label);

public sealed record CategoryEntry(Category Code, string Label, IReadOnlyList<TypeEntry> Types);

public sealed record ColorEntry(Color Code, string Label, bool Neutral);

public sealed record PatternEntry(Pattern Code, string Label);

public sealed record MaterialEntry(Material Code, string Label);

public sealed record StyleEntry(StyleTag Code, string Label);

public sealed record ScaleEntry(int Value, string Label);

/// <summary>The closed lists a garment is described with, in display order, with the labels a person reads.</summary>
public sealed record DictionariesResponse(
    IReadOnlyList<CategoryEntry> Categories,
    IReadOnlyList<ColorEntry> Colors,
    IReadOnlyList<PatternEntry> Patterns,
    IReadOnlyList<MaterialEntry> Materials,
    IReadOnlyList<StyleEntry> Styles,
    IReadOnlyList<ScaleEntry> Formality,
    IReadOnlyList<ScaleEntry> Warmth);
