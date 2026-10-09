using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>
/// The fallback of product spec 6.7: outfits from the rules alone. It draws valid outfits at random from the
/// candidates, scores them with the same function the model's outfits get, and returns the best, the best with a
/// forgotten garment and the best that differs from both. It keeps the app working when the model does not, and it is
/// the yardstick the model is measured against.
/// </summary>
public static class RuleBasedStylist
{
    /// <summary>How many different valid outfits are drawn before the best are picked.</summary>
    public const int Drawn = 20;

    public const int Proposals = 3;

    /// <summary>Draws repeat in a small wardrobe; this many tries are enough to find every outfit it can make, or twenty of them.</summary>
    private const int MaxTries = 400;

    /// <summary>
    /// Up to three proposals, best first by the order of spec 6.7. Empty only when the candidates cannot make a single
    /// valid outfit, which a complete <see cref="CandidateSet"/> always can.
    /// </summary>
    public static IReadOnlyList<Proposal> Compose(CandidateSet candidates, WeatherProfile weather, IReadOnlySet<(Guid Top, Guid Bottom)> wornPairs, Random random)
    {
        var drawn = new List<OutfitDraft>();
        for (var tries = 0; tries < MaxTries && drawn.Count < Drawn; tries++)
        {
            if (Draw(candidates, random) is { } outfit && drawn.TrueForAll(earlier => earlier.DifferenceFrom(outfit) > 0)
                && OutfitValidator.Check(outfit, candidates).Count == 0)
            {
                drawn.Add(outfit);
            }
        }

        // A stable sort: among equals the earlier draw wins, so one seed always gives one answer.
        var ranked = drawn.Select(outfit => (Outfit: outfit, Score: CoherenceScore.Of(outfit, weather.Rule))).OrderByDescending(entry => entry.Score).ToList();
        var picked = new List<(OutfitDraft Outfit, int Score, OutfitKind Claimed)>();

        // What is wanted comes first, then as much difference from what is already picked as the wardrobe allows.
        // The same outfit is never offered twice.
        void Pick(OutfitKind claimed, Func<OutfitDraft, bool>? wanted = null)
        {
            foreach (var fits in wanted is null ? (Func<OutfitDraft, bool>[])[_ => true] : [wanted, _ => true])
            {
                for (var difference = Math.Max(1, candidates.MinDifference); difference >= 1; difference--)
                {
                    var found = ranked.Where(entry => fits(entry.Outfit) && picked.TrueForAll(earlier => earlier.Outfit.DifferenceFrom(entry.Outfit) >= difference)).Take(1).ToList();
                    if (found.Count == 1)
                    {
                        picked.Add((found[0].Outfit, found[0].Score, claimed));
                        return;
                    }
                }
            }
        }

        Pick(OutfitKind.SureBet);
        Pick(OutfitKind.Discovery, outfit => outfit.Items.Any(garment => garment.Forgotten));
        Pick(OutfitKind.NewPairing);

        return
        [
            .. picked.Take(Proposals).Select(entry =>
            {
                var kind = entry.Outfit.Confirm(entry.Claimed, wornPairs);
                return new Proposal(entry.Outfit, kind, entry.Score, Reasoning(kind, entry.Outfit), WeatherNote(entry.Outfit, weather));
            }),
        ];
    }

    /// <summary>One outfit that honours what the weather demands, or null when the candidates cannot dress anybody.</summary>
    private static OutfitDraft? Draw(CandidateSet candidates, Random random)
    {
        Garment? Any(Category role)
        {
            var garments = candidates.Of(role);
            return garments.Count == 0 ? null : garments[random.Next(garments.Count)];
        }

        bool Must(Category role) => candidates.BaseItem?.Role == role;

        var shoes = Any(Category.Shoes);
        var tops = candidates.Of(Category.Top).Count;
        var bottoms = candidates.Of(Category.Bottom).Count;
        var onePieces = candidates.Of(Category.OnePiece).Count;
        if (shoes is null || (onePieces == 0 && tops * bottoms == 0))
        {
            return null;
        }

        // Each way of dressing gets its share of the draws by how many outfits it can make.
        var asOnePiece = random.Next((tops * bottoms) + onePieces) < onePieces;
        var demands = candidates.Demands;
        var mid = demands.MidLayer || Must(Category.MidLayer) || random.Next(2) == 0 ? Any(Category.MidLayer) : null;
        var outerwear = demands.Outerwear || Must(Category.Outerwear) || random.Next(2) == 0 ? Any(Category.Outerwear) : null;
        if (demands.Layer && mid is null && outerwear is null)
        {
            mid = Any(Category.MidLayer);
            outerwear = mid is null ? Any(Category.Outerwear) : null;
        }

        var accessories = new List<Garment>();
        if (candidates.BaseItem is { Role: Category.Accessory } baseItem)
        {
            accessories.Add(baseItem);
        }

        if (random.Next(2) == 0 && Any(Category.Accessory) is { } accessory && accessories.TrueForAll(present => present.Id != accessory.Id))
        {
            accessories.Add(accessory);
        }

        return new OutfitDraft(
            asOnePiece ? null : Any(Category.Top),
            mid,
            asOnePiece ? null : Any(Category.Bottom),
            asOnePiece ? Any(Category.OnePiece) : null,
            outerwear,
            shoes,
            accessories);
    }

    // Template sentences shown as the stylist's reasoning: second person, plain English.
    private static string Reasoning(OutfitKind? kind, OutfitDraft outfit) => kind switch
    {
        OutfitKind.SureBet => "These are the pieces you reach for most. They suit the weather and the occasion.",
        OutfitKind.Discovery => $"There is something here you have not worn in a while: {outfit.Items.First(garment => garment.Forgotten).Tags.Name}. The rest of the outfit suits the weather and the occasion.",
        OutfitKind.NewPairing => "You have not worn this top and bottom together yet. It suits the weather and the occasion.",
        _ => "An outfit chosen for the weather and the occasion, with colors and style that go together.",
    };

    private static string? WeatherNote(OutfitDraft outfit, WeatherProfile weather)
    {
        if (weather.Rain && outfit.Outerwear is { Tags.RainOk: true })
        {
            return "Rain is expected, and this outerwear is made for it.";
        }

        return weather.NeedsLayers && (outfit.MidLayer ?? outfit.Outerwear) is not null
            ? "It will warm up during the day, so you can take off one layer."
            : null;
    }
}
