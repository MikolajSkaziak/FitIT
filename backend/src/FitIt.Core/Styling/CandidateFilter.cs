using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>
/// Step two of the stylist (product spec 6.4): the hard rules of weather and occasion decide which garments the model
/// may choose from at all. A small wardrobe makes the rules give way, one role at a time and in a fixed order, and
/// every time they do it is written down.
/// </summary>
public static class CandidateFilter
{
    /// <summary>The most candidates sent per role: half from what is liked and worn often, half from what is forgotten.</summary>
    public const int MaxPerRole = 8;

    /// <summary>Strict, then formality wider by one, then no style rule as well, then warmth with a tolerance of one as well.</summary>
    private const int LastLevel = 3;

    private static readonly Category[] Roles = Enum.GetValues<Category>();

    /// <param name="styles">The styles the person likes; within a role, garments that fit them are the first to become candidates.</param>
    public static CandidateSet Select(
        IReadOnlyList<Garment> wardrobe, WeatherProfile weather, Occasion occasion, Guid? baseItemId = null, IReadOnlyList<StyleTag>? styles = null)
    {
        styles ??= [];
        var band = weather.Rule;
        var rule = OccasionRule.For(occasion);
        var baseItem = baseItemId is { } id ? wardrobe.FirstOrDefault(garment => garment.Id == id) : null;
        var usable = wardrobe.Where(garment => !garment.InLaundry && garment.Id != baseItem?.Id).ToList();

        var chosen = Roles.ToDictionary(role => role, role => usable.Where(garment => garment.Role == role && Passes(garment, band, rule, 0)).ToList());
        var levels = Roles.ToDictionary(role => role, _ => 0);

        // "Dobierz do tego": the garment is in every proposal whatever the rules say, so nothing else competes for its slot.
        if (baseItem is not null)
        {
            if (baseItem.Role == Category.Accessory)
            {
                chosen[Category.Accessory].Insert(0, baseItem);
            }
            else
            {
                chosen[baseItem.Role] = [baseItem];
            }

            if (baseItem.Role is Category.Top or Category.Bottom)
            {
                chosen[Category.OnePiece] = [];
            }
            else if (baseItem.Role == Category.OnePiece)
            {
                chosen[Category.Top] = [];
                chosen[Category.Bottom] = [];
            }
        }

        bool Has(Category role) => chosen[role].Count > 0;
        var separatesOnly = baseItem?.Role is Category.Top or Category.Bottom;
        bool Dressed() => Has(Category.OnePiece) || (Has(Category.Top) && Has(Category.Bottom));

        // The rules give way only for a role that is both required and empty, and only as far as it takes to fill it.
        void Relax(Func<bool> satisfied, params Category[] roles)
        {
            for (var level = 1; level <= LastLevel && !satisfied(); level++)
            {
                foreach (var role in roles.Where(role => !Has(role)))
                {
                    chosen[role] = [.. usable.Where(garment => garment.Role == role && Passes(garment, band, rule, level))];
                    levels[role] = Has(role) ? level : 0;
                }
            }
        }

        Relax(() => Has(Category.Shoes), Category.Shoes);
        if (baseItem?.Role != Category.OnePiece)
        {
            Relax(Dressed, separatesOnly ? [Category.Top, Category.Bottom] : [Category.Top, Category.Bottom, Category.OnePiece]);
        }

        if (band.NeedsOuterwear)
        {
            Relax(() => Has(Category.Outerwear), Category.Outerwear);
        }

        if (band.NeedsMidLayer)
        {
            Relax(() => Has(Category.MidLayer), Category.MidLayer);
        }

        if (band.NeedsLayer)
        {
            Relax(() => Has(Category.MidLayer) || Has(Category.Outerwear), Category.MidLayer, Category.Outerwear);
        }

        var missing = new List<Category>();
        if (!Dressed())
        {
            missing.AddRange(((Category[])[Category.Top, Category.Bottom]).Where(role => !Has(role)));
        }

        if (band.NeedsMidLayer && !Has(Category.MidLayer))
        {
            missing.Add(Category.MidLayer);
        }

        if (band.NeedsOuterwear && !Has(Category.Outerwear))
        {
            missing.Add(Category.Outerwear);
        }

        // "A mid layer or outerwear" is one requirement that either role meets, so the roles are named apart from those that are each required.
        // When one of them is required anyway, it settles the matter and the group needs no mention.
        var missingEither = new List<Category>();
        if (band.NeedsLayer && !Has(Category.MidLayer) && !Has(Category.Outerwear) && !missing.Contains(Category.MidLayer) && !missing.Contains(Category.Outerwear))
        {
            missingEither.AddRange([Category.MidLayer, Category.Outerwear]);
        }

        if (!Has(Category.Shoes))
        {
            missing.Add(Category.Shoes);
        }

        // Rain (spec 6.2): outerwear that stands it, if there is any; suede stays home, if there is anything else.
        var rainOuterwear = false;
        if (weather.Rain)
        {
            var proof = chosen[Category.Outerwear].Where(garment => garment.Tags.RainOk).ToList();
            if (proof.Count > 0 && (baseItem?.Role != Category.Outerwear || baseItem.Tags.RainOk))
            {
                chosen[Category.Outerwear] = proof;
                rainOuterwear = true;
            }

            var notSuede = chosen[Category.Shoes].Where(garment => garment.Tags.Material != Material.Suede).ToList();
            if (notSuede.Count > 0 && baseItem?.Role != Category.Shoes)
            {
                chosen[Category.Shoes] = notSuede;
            }
        }

        var relaxations = new List<Relaxation>();
        foreach (var role in Roles.Where(role => levels[role] > 0))
        {
            var relaxed = chosen[role].Where(garment => garment.Id != baseItem?.Id).ToList();
            if (relaxed.Any(garment => !rule.AllowsFormality(garment.Tags.Formality)))
            {
                relaxations.Add(new Relaxation(role, RelaxedRule.Formality));
            }

            if (relaxed.Any(garment => !rule.AllowsStyle(garment.Tags.Styles)))
            {
                relaxations.Add(new Relaxation(role, RelaxedRule.Style));
            }

            if (relaxed.Any(garment => !WeatherAllows(garment, band, 0)))
            {
                relaxations.Add(new Relaxation(role, RelaxedRule.Warmth));
            }
        }

        var items = new List<Candidate>();
        foreach (var role in Roles)
        {
            items.AddRange(Mix(chosen[role], baseItem, styles).Select((garment, index) => new Candidate($"{AliasPrefix(role)}{index + 1}", garment)));
        }

        var demands = new WeatherDemands(
            band.NeedsLayer,
            band.NeedsMidLayer,
            band.NeedsOuterwear || rainOuterwear,
            band.OuterwearMinWarmth,
            rainOuterwear,
            band.ClosedShoes);
        return new CandidateSet(items, demands, relaxations, missing, missingEither, weather.Rain && !rainOuterwear, baseItem);
    }

    /// <summary>The letter an alias starts with. <c>D</c> is the one-piece: most of them are dresses.</summary>
    public static char AliasPrefix(Category role) => role switch
    {
        Category.Top => 'T',
        Category.MidLayer => 'M',
        Category.Bottom => 'B',
        Category.OnePiece => 'D',
        Category.Outerwear => 'O',
        Category.Shoes => 'S',
        Category.Accessory => 'A',
        _ => throw new ArgumentOutOfRangeException(nameof(role)),
    };

    private static bool Passes(Garment garment, BandRule band, OccasionRule rule, int level) =>
        WeatherAllows(garment, band, level >= 3 ? 1 : 0)
        && rule.AllowsFormality(garment.Tags.Formality, level >= 1 ? 1 : 0)
        && (level >= 2 || rule.AllowsStyle(garment.Tags.Styles));

    /// <summary>Outerwear that is too light for a band that requires outerwear is of no use there, so it is not a candidate either.</summary>
    private static bool WeatherAllows(Garment garment, BandRule band, int tolerance) =>
        !band.Excludes(garment.Tags, tolerance)
        && (garment.Role != Category.Outerwear || band.OuterwearMinWarmth is not { } warmth || garment.Tags.Warmth >= warmth - tolerance);

    /// <summary>
    /// At most eight (or <paramref name="max"/>): four favourites and four forgotten ones, so the model can build both a sure bet and a discovery. A
    /// half that comes up short is filled from the other. Within each half the garments that fit the person's styles come
    /// first; then, among favourites, those liked most (an outfit the person disliked takes a like away from each of its
    /// garments, and never more than that: a disliked garment ranks lower, it does not disappear) and worn most, and among
    /// the forgotten those worn least.
    /// </summary>
    internal static List<Garment> Mix(IReadOnlyList<Garment> garments, Garment? baseItem, IReadOnlyList<StyleTag> styles, int max = MaxPerRole)
    {
        // A garment that cannot be judged stands between a fit and a miss.
        double Fit(Garment garment) => StyleFit.Of(garment, styles) ?? StyleFit.Compatible;

        var kept = garments.Where(garment => garment.Id == baseItem?.Id).ToList();
        var others = garments.Where(garment => garment.Id != baseItem?.Id).ToList();
        var favourites = others.Where(garment => !garment.Forgotten)
            .OrderByDescending(Fit).ThenByDescending(garment => garment.Likes - garment.Dislikes).ThenByDescending(garment => garment.WearCount).ThenBy(garment => garment.Id).ToList();
        var forgotten = others.Where(garment => garment.Forgotten)
            .OrderByDescending(Fit).ThenByDescending(garment => garment.Likes - garment.Dislikes).ThenBy(garment => garment.WearCount).ThenBy(garment => garment.Id).ToList();

        var room = max - kept.Count;
        var half = room / 2;
        var fromForgotten = Math.Min(forgotten.Count, Math.Max(half, room - favourites.Count));
        var fromFavourites = Math.Min(favourites.Count, room - fromForgotten);
        return [.. kept, .. favourites.Take(fromFavourites), .. forgotten.Take(fromForgotten)];
    }
}
