using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>An outfit a person liked, saved or wore, as the styles of each of its garments, and how much it says about their taste.</summary>
public sealed record StyleEvidence(IReadOnlyList<IReadOnlyList<StyleTag>> Garments, int Weight = 1);

/// <summary>
/// How well a garment, or a whole outfit, keeps to the styles a person likes. It builds on <see cref="StyleAffinity"/>:
/// a garment that carries a liked style fits fully, one whose style goes with a liked one fits half, anything else does
/// not fit. A garment without style tags is neutral: it is neither rewarded nor punished, and so is everything when the
/// person named no style.
/// </summary>
public static class StyleFit
{
    public const double Direct = 1;
    public const double Compatible = 0.5;
    public const double None = 0;

    /// <summary>What an outfit loses when every pair of its garments clashes; a share of the pairs loses that share of it.</summary>
    public const double ClashPenalty = 0.5;

    /// <summary>A style names an outfit only when its garments fit that style at least this well on average.</summary>
    public const double NamedFrom = 0.5;

    /// <summary>Null when there is nothing to judge by: the garment has no style tags, or the person named no style.</summary>
    public static double? Of(IReadOnlyList<StyleTag> garment, IReadOnlyList<StyleTag> liked)
    {
        if (garment.Count == 0 || liked.Count == 0)
        {
            return null;
        }

        return garment.Any(liked.Contains) ? Direct
            : garment.Any(style => liked.Any(like => StyleAffinity.AreCompatible(style, like))) ? Compatible
            : None;
    }

    public static double? Of(Garment garment, IReadOnlyList<StyleTag> liked) => Of(garment.Tags.Styles, liked);

    /// <summary>Two garments clash when both carry styles and no style of one goes with any style of the other.</summary>
    public static bool Clash(IReadOnlyList<StyleTag> first, IReadOnlyList<StyleTag> second) =>
        first.Count > 0 && second.Count > 0 && !first.Any(one => second.Any(other => StyleAffinity.AreCompatible(one, other)));

    /// <summary>
    /// From 0 to 1: the mean fit of the garments that can be judged (1 when none can), less the share of garment pairs
    /// that clash times <see cref="ClashPenalty"/>. The clash counts also for a person who named no style: an outfit
    /// should read as one look whoever wears it.
    /// </summary>
    public static double Of(OutfitDraft outfit, IReadOnlyList<StyleTag> liked)
    {
        var garments = outfit.Items.Select(garment => garment.Tags.Styles).ToList();
        var fits = garments.Select(styles => Of(styles, liked)).OfType<double>().ToList();
        var mean = fits.Count == 0 ? Direct : fits.Average();

        var (pairs, clashes) = (0, 0);
        for (var first = 0; first < garments.Count; first++)
        {
            for (var second = first + 1; second < garments.Count; second++)
            {
                pairs++;
                clashes += Clash(garments[first], garments[second]) ? 1 : 0;
            }
        }

        return Math.Clamp(mean - (pairs == 0 ? 0 : ClashPenalty * clashes / pairs), 0, 1);
    }

    /// <summary>
    /// The one of the liked styles the outfit reads as: the style its garments fit best, provided at least one garment
    /// carries it and the garments fit it by <see cref="NamedFrom"/> or more on average. Among equals the style named
    /// first wins. Null when no liked style describes the outfit.
    /// </summary>
    public static StyleTag? Named(OutfitDraft outfit, IReadOnlyList<StyleTag> liked)
    {
        var garments = outfit.Items.Select(garment => garment.Tags.Styles).Where(styles => styles.Count > 0).ToList();
        if (garments.Count == 0)
        {
            return null;
        }

        StyleTag? best = null;
        var bestFit = 0d;
        foreach (var style in liked.Distinct())
        {
            StyleTag[] one = [style];
            var fit = garments.Average(styles => Of(styles, one) ?? None);
            if (fit >= NamedFrom && fit > bestFit && garments.Any(styles => styles.Contains(style)))
            {
                (best, bestFit) = (style, fit);
            }
        }

        return best;
    }

    /// <summary>
    /// The liked styles, strongest first, by what the person did: each outfit of the evidence adds, to every liked style,
    /// its weight times the share of its tagged garments that carry that style. Styles with equal support keep the order
    /// they have in the profile, so a person who has done nothing yet gets their profile back unchanged.
    /// </summary>
    public static IReadOnlyList<StyleTag> Rank(IReadOnlyList<StyleTag> liked, IEnumerable<StyleEvidence> evidence)
    {
        var support = liked.Distinct().ToDictionary(style => style, _ => 0d);
        foreach (var outfit in evidence)
        {
            var tagged = outfit.Garments.Where(styles => styles.Count > 0).ToList();
            if (tagged.Count == 0)
            {
                continue;
            }

            foreach (var style in support.Keys)
            {
                support[style] += outfit.Weight * (double)tagged.Count(styles => styles.Contains(style)) / tagged.Count;
            }
        }

        // OrderBy is stable: equal support leaves the profile's order.
        return [.. liked.Distinct().OrderByDescending(style => support[style])];
    }
}
