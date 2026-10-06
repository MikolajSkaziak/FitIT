using FitIt.Core.Common;

namespace FitIt.Core.Wardrobe;

/// <summary>The full description of a garment: everything the stylist's rules and the models need (product spec 5.2).</summary>
public sealed record GarmentTags(
    Category Category,
    Subcategory Subcategory,
    string Name,
    IReadOnlyList<Color> Colors,
    Pattern Pattern,
    Material Material,
    int Formality,
    int Warmth,
    bool RainOk,
    IReadOnlyList<StyleTag> Styles)
{
    public const int NameMaxLength = 60;
    public const int MaxColors = 2;

    /// <summary>The first thing wrong with the tags, or null when they can be stored.</summary>
    public ApiError? Check()
    {
        if (GarmentCatalog.CategoryOf(Subcategory) != Category)
        {
            return ApiError.BadRequest("subcategory_mismatch", "The type does not belong to the category.");
        }

        if (Name.Trim().Length is 0 or > NameMaxLength)
        {
            return ApiError.BadRequest("name_invalid", $"The name must have between 1 and {NameMaxLength} characters.");
        }

        if (Colors.Count is 0 or > MaxColors || Colors.Distinct().Count() != Colors.Count)
        {
            return ApiError.BadRequest("colors_invalid", "Give one or two different colours.");
        }

        if (!GarmentCatalog.IsOnScale(Formality))
        {
            return ApiError.BadRequest("formality_invalid", "Formality is a number from 1 to 5.");
        }

        if (!GarmentCatalog.IsOnScale(Warmth))
        {
            return ApiError.BadRequest("warmth_invalid", "Warmth is a number from 1 to 5.");
        }

        return Styles.Distinct().Count() != Styles.Count ? ApiError.BadRequest("styles_invalid", "A style may be listed once.") : null;
    }

    /// <summary>
    /// One English sentence for the image and language models, built from the tags. Used when a person tagged or edited
    /// the garment, so the models never work from a description that no longer matches.
    /// </summary>
    public string Describe()
    {
        var words = new List<string>
        {
            string.Join(" and ", Colors.Select(GarmentCatalog.English)),
        };
        if (Pattern != Pattern.Plain)
        {
            words.Add(GarmentCatalog.English(Pattern));
        }

        if (GarmentCatalog.English(Material) is { Length: > 0 } material && !GarmentCatalog.English(Subcategory).Contains(material, StringComparison.Ordinal))
        {
            words.Add(material);
        }

        words.Add(GarmentCatalog.English(Subcategory));
        return string.Join(' ', words);
    }
}
