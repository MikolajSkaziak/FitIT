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

    /// <summary>Zero to four different seasons; none (an empty list) means the ones the warmth suggests.</summary>
    [MaxLength(GarmentTags.MaxSeasons)]
    public Season[]? Seasons { get; init; }

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
    GarmentGroup? Group,
    Subcategory? Subcategory,
    IReadOnlyList<Color> Colors,
    Pattern? Pattern,
    Material? Material,
    int? Formality,
    int? Warmth,
    bool? RainOk,
    IReadOnlyList<StyleTag> Styles,
    IReadOnlyList<Season> Seasons,
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

/// <summary>What a person picks a garment by: a shop-style group of types, which may play different roles in an outfit.</summary>
public sealed record GroupEntry(GarmentGroup Code, string Label, IReadOnlyList<TypeEntry> Types);

/// <summary><c>Hex</c> is the colour of a swatch for this garment colour (<c>#RRGGBB</c>).</summary>
public sealed record ColorEntry(Color Code, string Label, bool Neutral, string Hex);

public sealed record PatternEntry(Pattern Code, string Label);

public sealed record MaterialEntry(Material Code, string Label);

/// <summary><c>WomanImageUrl</c> and <c>ManImageUrl</c> are reference photos of the style (3:4, absolute links), one worn by a woman and one by a man.</summary>
public sealed record StyleEntry(StyleTag Code, string Label, string WomanImageUrl, string ManImageUrl);

public sealed record SeasonEntry(Season Code, string Label);

public sealed record ScaleEntry(int Value, string Label);

/// <summary>The closed lists a garment is described with, in display order, with the labels a person reads.</summary>
public sealed record DictionariesResponse(
    IReadOnlyList<CategoryEntry> Categories,
    IReadOnlyList<GroupEntry> Groups,
    IReadOnlyList<ColorEntry> Colors,
    IReadOnlyList<PatternEntry> Patterns,
    IReadOnlyList<MaterialEntry> Materials,
    IReadOnlyList<StyleEntry> Styles,
    IReadOnlyList<SeasonEntry> Seasons,
    IReadOnlyList<ScaleEntry> Formality,
    IReadOnlyList<ScaleEntry> Warmth);

/// <summary>One of the common pieces a person can add without a photo. <c>ImageUrl</c> is a public, square picture with a transparent background.</summary>
public sealed record StarterPieceResponse(string Code, string Name, Category Category, Subcategory Type, IReadOnlyList<Color> Colors, string ImageUrl);

/// <summary>A starter piece as the signed-in person sees it: <c>Added</c> is true while a garment made from it is in the wardrobe, and turns false again when that garment is deleted.</summary>
public sealed record MyStarterPieceResponse(string Code, string Name, Category Category, Subcategory Type, IReadOnlyList<Color> Colors, string ImageUrl, bool Added);

public sealed class AddStarterPiecesRequest
{
    /// <summary>Codes from <c>GET /api/starter-pieces</c>. Codes the wardrobe already has are skipped.</summary>
    [Required, MaxLength(40)]
    public string[] Codes { get; init; } = [];
}

/// <summary><c>Added</c> garments were created; <c>AlreadyThere</c> of the asked-for codes were in the wardrobe before.</summary>
public sealed record StarterAdditionResponse(int Added, int AlreadyThere);
