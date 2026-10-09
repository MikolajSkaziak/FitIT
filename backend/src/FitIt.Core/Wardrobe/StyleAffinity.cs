namespace FitIt.Core.Wardrobe;

/// <summary>
/// Which styles go together in one outfit. Two styles are compatible when they share a family (or a pair) below; a style is always
/// compatible with itself, and the relation is symmetric because it is built from the families. Minimalist is the quiet
/// one that goes with nearly everything: only the loudest styles (Y2K, grunge) are outside it.
/// </summary>
public static class StyleAffinity
{
    private static readonly StyleTag[][] Families =
    [
        [StyleTag.Smart, StyleTag.Elegant, StyleTag.OldMoney, StyleTag.Preppy, StyleTag.Business],
        [StyleTag.Streetwear, StyleTag.Y2k, StyleTag.Grunge, StyleTag.Edgy, StyleTag.Sporty],
        [StyleTag.Boho, StyleTag.Romantic, StyleTag.Vintage],
        [StyleTag.Gorpcore, StyleTag.Sporty, StyleTag.Casual],
        [StyleTag.Casual, StyleTag.Smart],
        [StyleTag.Casual, StyleTag.Preppy],
        [StyleTag.Casual, StyleTag.Streetwear],
        [StyleTag.Casual, StyleTag.Vintage],
        [StyleTag.Casual, StyleTag.Boho],
        [StyleTag.Elegant, StyleTag.Romantic],
        [StyleTag.Vintage, StyleTag.OldMoney],
    ];

    private static readonly StyleTag[] NotQuiet = [StyleTag.Y2k, StyleTag.Grunge];

    public static bool AreCompatible(StyleTag first, StyleTag second) =>
        first == second
        || (first == StyleTag.Minimalist && !NotQuiet.Contains(second))
        || (second == StyleTag.Minimalist && !NotQuiet.Contains(first))
        || Families.Any(family => family.Contains(first) && family.Contains(second));

    /// <summary>The styles that are not liked but go with every liked one; empty when nothing is liked or the tastes pull apart.</summary>
    public static IReadOnlyList<StyleTag> Nearby(IReadOnlyList<StyleTag> liked) =>
        liked.Count == 0
            ? []
            : [.. Enum.GetValues<StyleTag>().Where(style => !liked.Contains(style) && liked.All(like => AreCompatible(style, like)))];
}
