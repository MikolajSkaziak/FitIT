using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>The hard rules of product spec 6.6. An outfit that breaks any of them is never shown.</summary>
public enum ViolationCode
{
    /// <summary>The alias is not among the candidates.</summary>
    UnknownAlias,

    /// <summary>The garment exists but sits in a slot of another category (a sweater as the top).</summary>
    WrongRole,

    /// <summary>Neither a top with a bottom nor a one-piece.</summary>
    NoBody,

    /// <summary>A one-piece together with a top or a bottom.</summary>
    MixedBody,

    NoShoes,

    /// <summary>The same garment twice in one outfit.</summary>
    Repeated,

    MissingOuterwear,

    MissingMidLayer,

    /// <summary>Neither a mid layer nor outerwear on a day that needs one of them.</summary>
    MissingLayer,

    /// <summary>Rain, a rain-proof coat among the candidates, and another one chosen.</summary>
    NoRainOuterwear,

    /// <summary>The garment the person asked to build around is not in the outfit.</summary>
    MissingBaseItem,

    /// <summary>Differs from an earlier proposal of the same answer in too few places.</summary>
    TooSimilar,
}

public sealed record Violation(ViolationCode Code, string? Alias = null)
{
    /// <summary>One sentence for the model, sent back with the retry.</summary>
    public string Describe() => Code switch
    {
        ViolationCode.UnknownAlias => $"{Alias} is not among the candidates.",
        ViolationCode.WrongRole => $"{Alias} is used in a slot of another role.",
        ViolationCode.NoBody => "Needs a top and a bottom, or a one-piece.",
        ViolationCode.MixedBody => "A one-piece cannot be combined with a top or a bottom.",
        ViolationCode.NoShoes => "Shoes are missing.",
        ViolationCode.Repeated => $"{Alias} is used more than once.",
        ViolationCode.MissingOuterwear => "The weather requires outerwear.",
        ViolationCode.MissingMidLayer => "The weather requires a mid layer.",
        ViolationCode.MissingLayer => "The weather requires a mid layer or outerwear.",
        ViolationCode.NoRainOuterwear => $"{Alias} does not stand rain; rain-proof outerwear is required.",
        ViolationCode.MissingBaseItem => $"The base item {Alias} must be part of every outfit.",
        ViolationCode.TooSimilar => "Differs from an earlier outfit in fewer than two items.",
        _ => throw new InvalidOperationException($"No sentence for {Code}."),
    };
}

/// <summary>One outfit of the stylist's answer after the check: usable as <see cref="Draft"/>, or the list of what is wrong with it.</summary>
public sealed record CheckedOutfit(StylistOutfit Source, OutfitDraft? Draft, IReadOnlyList<Violation> Violations)
{
    public bool IsValid => Draft is not null;
}

/// <summary>
/// Step four of the stylist: nothing the model says reaches a person unchecked. The list of violations goes back to
/// the model once, with the retry.
/// </summary>
public static class OutfitValidator
{
    /// <summary>
    /// Checks the outfits in the order given; one that is too close to an earlier valid one is the one that goes. The same
    /// outfit twice is too close however small the wardrobe.
    /// </summary>
    public static IReadOnlyList<CheckedOutfit> Check(IReadOnlyList<StylistOutfit> outfits, CandidateSet candidates)
    {
        var results = new List<CheckedOutfit>(outfits.Count);
        var accepted = new List<OutfitDraft>();
        foreach (var outfit in outfits)
        {
            var violations = new List<Violation>();
            Garment? Resolve(string? alias, Category role)
            {
                if (alias is null)
                {
                    return null;
                }

                if (candidates.Find(alias) is not { } candidate)
                {
                    violations.Add(new Violation(ViolationCode.UnknownAlias, alias));
                    return null;
                }

                if (candidate.Garment.Role != role)
                {
                    violations.Add(new Violation(ViolationCode.WrongRole, alias));
                    return null;
                }

                return candidate.Garment;
            }

            var top = Resolve(outfit.Top, Category.Top);
            var mid = Resolve(outfit.Mid, Category.MidLayer);
            var bottom = Resolve(outfit.Bottom, Category.Bottom);
            var onePiece = Resolve(outfit.OnePiece, Category.OnePiece);
            var outerwear = Resolve(outfit.Outerwear, Category.Outerwear);
            var shoes = Resolve(outfit.Shoes, Category.Shoes);
            var accessories = outfit.Accessories.Select(alias => Resolve(alias, Category.Accessory)).OfType<Garment>().ToList();

            string?[] named = [outfit.Top, outfit.Mid, outfit.Bottom, outfit.OnePiece, outfit.Outerwear, outfit.Shoes, .. outfit.Accessories];
            violations.AddRange(named.OfType<string>().GroupBy(alias => alias).Where(group => group.Count() > 1).Select(group => new Violation(ViolationCode.Repeated, group.Key)));

            // What follows is judged only on an outfit whose every name was understood: a wrong alias would otherwise be reported twice, once as itself and once as the gap it leaves.
            if (violations.Count == 0)
            {
                if (shoes is null)
                {
                    violations.Add(new Violation(ViolationCode.NoShoes));
                }
                else
                {
                    var draft = new OutfitDraft(top, mid, bottom, onePiece, outerwear, shoes, accessories);
                    violations.AddRange(Check(draft, candidates));
                    if (violations.Count == 0 && accepted.Any(earlier => earlier.DifferenceFrom(draft) < Math.Max(1, candidates.MinDifference)))
                    {
                        violations.Add(new Violation(ViolationCode.TooSimilar));
                    }

                    if (violations.Count == 0)
                    {
                        accepted.Add(draft);
                        results.Add(new CheckedOutfit(outfit, draft, []));
                        continue;
                    }
                }
            }

            results.Add(new CheckedOutfit(outfit, null, violations));
        }

        return results;
    }

    /// <summary>The rules about one outfit as a whole: complete, dressed for the weather, built around the base garment.</summary>
    public static IReadOnlyList<Violation> Check(OutfitDraft outfit, CandidateSet candidates)
    {
        var violations = new List<Violation>();
        if (outfit.OnePiece is null && (outfit.Top is null || outfit.Bottom is null))
        {
            violations.Add(new Violation(ViolationCode.NoBody));
        }
        else if (outfit.OnePiece is not null && (outfit.Top is not null || outfit.Bottom is not null))
        {
            violations.Add(new Violation(ViolationCode.MixedBody));
        }

        violations.AddRange(outfit.Items.GroupBy(garment => garment.Id).Where(group => group.Count() > 1)
            .Select(group => new Violation(ViolationCode.Repeated, candidates.AliasOf(group.Key))));

        var demands = candidates.Demands;
        if (demands.Outerwear && outfit.Outerwear is null)
        {
            violations.Add(new Violation(ViolationCode.MissingOuterwear));
        }

        if (demands.MidLayer && outfit.MidLayer is null)
        {
            violations.Add(new Violation(ViolationCode.MissingMidLayer));
        }

        if (demands.Layer && outfit.MidLayer is null && outfit.Outerwear is null)
        {
            violations.Add(new Violation(ViolationCode.MissingLayer));
        }

        if (demands.RainOuterwear && outfit.Outerwear is { Tags.RainOk: false } notProof)
        {
            violations.Add(new Violation(ViolationCode.NoRainOuterwear, candidates.AliasOf(notProof.Id)));
        }

        if (candidates.BaseItem is { } baseItem && !outfit.Items.Any(garment => garment.Id == baseItem.Id))
        {
            violations.Add(new Violation(ViolationCode.MissingBaseItem, candidates.AliasOf(baseItem.Id)));
        }

        return violations;
    }
}
