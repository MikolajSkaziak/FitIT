using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>The three kinds of proposal (product spec 6.1). Each request should bring one of each.</summary>
public enum OutfitKind
{
    /// <summary>"Sure bet": liked and often worn garments, the safest choice for today.</summary>
    SureBet,

    /// <summary>"Discovery": contains at least one forgotten garment.</summary>
    Discovery,

    /// <summary>"New pairing": a top and a bottom the person has not worn together yet.</summary>
    NewPairing,
}

/// <summary>
/// An outfit that passed the hard rules: one garment per slot, shoes always, and either a top with a bottom or a one-piece.
/// </summary>
public sealed record OutfitDraft(
    Garment? Top,
    Garment? MidLayer,
    Garment? Bottom,
    Garment? OnePiece,
    Garment? Outerwear,
    Garment Shoes,
    IReadOnlyList<Garment> Accessories)
{
    /// <summary>Every garment of the outfit, in the order of the slots.</summary>
    public IEnumerable<Garment> Items =>
        ((Garment?[])[Top, MidLayer, Bottom, OnePiece, Outerwear, Shoes]).OfType<Garment>().Concat(Accessories);

    /// <summary>In how many slots the two outfits differ; the accessories count as one slot.</summary>
    public int DifferenceFrom(OutfitDraft other)
    {
        static int Differs(Garment? one, Garment? two) => one?.Id == two?.Id ? 0 : 1;
        var accessories = Accessories.Select(garment => garment.Id).ToHashSet().SetEquals(other.Accessories.Select(garment => garment.Id)) ? 0 : 1;
        return Differs(Top, other.Top) + Differs(MidLayer, other.MidLayer) + Differs(Bottom, other.Bottom) + Differs(OnePiece, other.OnePiece)
            + Differs(Outerwear, other.Outerwear) + Differs(Shoes, other.Shoes) + accessories;
    }

    /// <summary>
    /// The kind an outfit may carry, given the kind it claims: a label stays only when the outfit really meets it
    /// (product spec 6.6). An outfit that does not keeps its place and loses the label.
    /// </summary>
    public OutfitKind? Confirm(OutfitKind? claimed, IReadOnlySet<(Guid Top, Guid Bottom)> wornPairs) => claimed switch
    {
        OutfitKind.SureBet when !Items.Any(garment => garment.Forgotten) => claimed,
        OutfitKind.Discovery when Items.Any(garment => garment.Forgotten) => claimed,
        OutfitKind.NewPairing when Top is not null && Bottom is not null && !wornPairs.Contains((Top.Id, Bottom.Id)) => claimed,
        _ => null,
    };
}

/// <summary>
/// An outfit ready to be shown: checked, labelled, scored and explained. <paramref name="Style"/> is the style the outfit
/// reads as, when it reads as one the person likes or one near those.
/// </summary>
public sealed record Proposal(OutfitDraft Outfit, OutfitKind? Kind, int Score, string Reasoning, string? WeatherNote, StyleTag? Style = null);

/// <summary>
/// An outfit as the stylist names it: aliases of candidates by slot, and the code of the style it says the outfit is in
/// (null when it names none). Nothing in it is trusted until the validator has seen it.
/// </summary>
public sealed record StylistOutfit(
    OutfitKind? Kind,
    string? Top,
    string? Mid,
    string? Bottom,
    string? OnePiece,
    string? Outerwear,
    string? Shoes,
    IReadOnlyList<string> Accessories,
    string Reasoning,
    string? WeatherNote,
    string? Style = null)
{
    /// <summary>Names a checked outfit the way the stylist would, for adapters that compose outfits in code.</summary>
    public static StylistOutfit From(OutfitDraft outfit, CandidateSet candidates, OutfitKind? kind, string reasoning, string? weatherNote, StyleTag? style = null)
    {
        string? Alias(Garment? garment) => garment is null ? null : candidates.AliasOf(garment.Id);
        return new StylistOutfit(
            kind,
            Alias(outfit.Top),
            Alias(outfit.MidLayer),
            Alias(outfit.Bottom),
            Alias(outfit.OnePiece),
            Alias(outfit.Outerwear),
            Alias(outfit.Shoes),
            [.. outfit.Accessories.Select(garment => Alias(garment)!)],
            reasoning,
            weatherNote,
            style is { } named ? Common.EnumCodes.ToCode(named) : null);
    }
}
