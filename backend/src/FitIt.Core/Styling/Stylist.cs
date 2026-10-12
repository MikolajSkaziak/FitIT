using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>Outfits the stylist can learn the person's taste from (product spec 6.8), each as the ids of its garments.</summary>
public sealed record StylingHistory(
    IReadOnlyList<IReadOnlyList<Guid>> Recent,
    IReadOnlyList<IReadOnlyList<Guid>> Liked,
    IReadOnlyList<IReadOnlyList<Guid>> Disliked,
    IReadOnlySet<(Guid Top, Guid Bottom)> WornPairs)
{
    /// <summary>How many liked and how many disliked outfits are shown to the stylist as examples.</summary>
    public const int Examples = 5;

    /// <summary>An outfit worn within this many days is "recent": its garments rank lower.</summary>
    public const int RecentDays = 2;

    /// <summary>How many of the newest outfits the person liked, saved or wore say which of their styles they act on most.</summary>
    public const int StyleEvidence = 30;

    public static readonly StylingHistory None = new([], [], [], new HashSet<(Guid, Guid)>());
}

/// <summary>
/// Everything one request for proposals comes down to once the rules have had their say: step one and two of spec 6.1.
/// <paramref name="Styles"/> are the styles the person likes, strongest first. <paramref name="FlatteringColors"/> are the
/// names of the best colours of their palette, and <paramref name="Palette"/> the wardrobe colours those stand for.
/// </summary>
public sealed record StylingCase(
    WeatherProfile Weather,
    Occasion Occasion,
    string? Note,
    IReadOnlyList<StyleTag> Styles,
    ThermalPreference Thermal,
    CandidateSet Candidates,
    StylingHistory History,
    IReadOnlyList<string>? FlatteringColors = null,
    IReadOnlyList<Color>? Palette = null)
{
    /// <summary>
    /// The styles an outfit of this request may be said to be in: those the person likes and those that go with all of
    /// them. A person who named none may be dressed in any.
    /// </summary>
    public IReadOnlyList<StyleTag> OutfitStyles => Styles.Count == 0 ? Enum.GetValues<StyleTag>() : [.. Styles.Distinct(), .. StyleAffinity.Nearby(Styles)];

    /// <summary>
    /// The variable part of the request to the model (product spec 6.5). Garments go by their aliases; an outfit from
    /// the history is left out when fewer than two of its garments are among today's candidates.
    /// </summary>
    public StylistBrief Brief()
    {
        var rule = OccasionRule.For(Occasion);
        var demands = Candidates.Demands;
        var requires = new List<string>();
        if (demands.OuterwearMinWarmth is { } warmth)
        {
            requires.Add($"outerwear with warmth >= {warmth}");
        }

        if (demands.MidLayer)
        {
            requires.Add("mid layer");
        }

        if (demands.Layer)
        {
            requires.Add("mid layer or outerwear");
        }

        if (demands.ClosedShoes)
        {
            requires.Add("closed shoes");
        }

        if (demands.RainOuterwear)
        {
            requires.Add("rain outerwear");
        }

        List<IReadOnlyList<string>> Aliases(IReadOnlyList<IReadOnlyList<Guid>> outfits) =>
        [
            .. outfits.Select(outfit => (IReadOnlyList<string>)[.. outfit.Select(Candidates.AliasOf).OfType<string>()]).Where(aliases => aliases.Count >= 2),
        ];

        // Styles go by their codes everywhere in the brief, the same words the answer names an outfit's style with.
        // Only the styles this request can be about are explained: the person's own and the one the occasion prefers.
        StyleTag[] explained = [.. Styles, .. rule.Prefers is { } preferred ? (StyleTag[])[preferred] : []];
        return new StylistBrief(
            new BriefWeather(Whole(Weather.FeelsMin), Whole(Weather.FeelsMax), Weather.Rain, Weather.NeedsLayers, requires),
            new BriefOccasion(rule.Label, [rule.FormalityMin, rule.FormalityMax], rule.Prefers is { } style ? EnumCodes.ToCode(style) : null, Note),
            new BriefProfile(
                [.. Styles.Select(EnumCodes.ToCode)],
                Thermal switch { ThermalPreference.RunsCold => "usually feels cold", ThermalPreference.RunsWarm => "usually feels warm", _ => "average" },
                FlatteringColors is { Count: > 0 } ? FlatteringColors : null,
                StyleAffinity.Nearby(Styles) is { Count: > 0 } nearby ? [.. nearby.Select(EnumCodes.ToCode)] : null,
                explained.Length > 0 ? StyleGuide.Notes(explained) : null),
            Candidates.BaseItem is { } baseItem ? Candidates.AliasOf(baseItem.Id) : null,
            [.. Candidates.Relaxations.Select(relaxation => $"{GarmentCatalog.Role(relaxation.Role).ToLowerInvariant()}: {Words(relaxation.Rule)}")],
            Aliases(History.Recent),
            Aliases(History.Liked),
            Aliases(History.Disliked),
            [
                .. Candidates.Items.Select(candidate => new BriefCandidate(
                    candidate.Alias,
                    GarmentCatalog.Role(candidate.Garment.Role).ToLowerInvariant(),
                    GarmentCatalog.Label(candidate.Garment.Tags.Subcategory).ToLowerInvariant(),
                    [.. candidate.Garment.Tags.Colors.Select(GarmentCatalog.Label)],
                    GarmentCatalog.Label(candidate.Garment.Tags.Pattern),
                    [.. candidate.Garment.Tags.Styles.Select(EnumCodes.ToCode)],
                    candidate.Garment.Tags.Formality,
                    candidate.Garment.Tags.Warmth,
                    candidate.Garment.Tags.RainOk,
                    candidate.Garment.WearCount,
                    candidate.Garment.Forgotten,
                    // The colour that covers most of the garment decides; a second colour in the palette does not make the garment flattering.
                    Palette is not null && candidate.Garment.Tags.Colors.Count > 0 && Palette.Contains(candidate.Garment.Tags.Colors[0]) ? true : null,
                    candidate.Garment.Description)),
            ]);
    }

    private static int Whole(double degrees) => (int)Math.Round(degrees, MidpointRounding.AwayFromZero);

    private static string Words(RelaxedRule rule) => rule switch
    {
        RelaxedRule.Formality => "formality range widened by 1",
        RelaxedRule.Style => "no style rule",
        RelaxedRule.Warmth => "warmth within a tolerance of 1",
        _ => throw new ArgumentOutOfRangeException(nameof(rule)),
    };
}

/// <summary>The JSON object of product spec 6.5. Member names are its snake case keys; the words are English, as the reasoning will be.</summary>
public sealed record StylistBrief(
    BriefWeather Weather,
    BriefOccasion Occasion,
    BriefProfile Profile,
    string? BaseItem,
    IReadOnlyList<string> Relaxations,
    IReadOnlyList<IReadOnlyList<string>> Recent,
    IReadOnlyList<IReadOnlyList<string>> Liked,
    IReadOnlyList<IReadOnlyList<string>> Disliked,
    IReadOnlyList<BriefCandidate> Candidates)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // The text goes into a prompt, not into HTML: letters outside ASCII stay as they are, which also costs fewer tokens.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public string ToJson() => JsonSerializer.Serialize(this, Json);
}

public sealed record BriefWeather(int FeelsMin, int FeelsMax, bool Rain, bool NeedsLayers, IReadOnlyList<string> Requires);

public sealed record BriefOccasion(string Name, IReadOnlyList<int> Formality, string? PreferredStyle, string? Note);

/// <summary>
/// <paramref name="FlatteringColors"/> are the best colours of the person's palette, English names, left out when no analysis was made. A soft preference.
/// <paramref name="NearbyStyles"/> are the styles that go with every style the person likes, left out when there are none. A soft preference.
/// <paramref name="StyleNotes"/> say what each of the person's styles, and the style the occasion prefers, looks like (<see cref="StyleGuide"/>), by style code.
/// </summary>
public sealed record BriefProfile(
    IReadOnlyList<string> Styles,
    string Thermal,
    IReadOnlyList<string>? FlatteringColors = null,
    IReadOnlyList<string>? NearbyStyles = null,
    IReadOnlyDictionary<string, string>? StyleNotes = null);

/// <summary>
/// <paramref name="Styles"/> are the garment's own style tags, by code. <paramref name="Flatters"/> is true when the garment's
/// main colour is in the person's palette and left out otherwise.
/// </summary>
public sealed record BriefCandidate(
    string Id,
    string Role,
    string Sub,
    IReadOnlyList<string> Colors,
    string Pattern,
    IReadOnlyList<string> Styles,
    int Formality,
    int Warmth,
    bool RainOk,
    int Worn,
    bool Forgotten,
    bool? Flatters,
    string Desc);

/// <summary>One question to the stylist. <see cref="Errors"/> is empty the first time; the retry carries what was wrong with the first answer.</summary>
public sealed record StylistRequest(StylingCase Case, IReadOnlyList<string> Errors);

/// <summary>What the stylist said: outfits by alias, or a refusal (the model's <c>stop_reason: "refusal"</c>).</summary>
public sealed record StylistAnswer(IReadOnlyList<StylistOutfit> Outfits, bool Refused, AiCost Cost)
{
    public static StylistAnswer Refusal(AiCost cost) => new([], true, cost);
}

/// <summary>Step three of the stylist (product spec 6.1): picks three outfits from the candidates and says why.</summary>
public interface IOutfitStylist
{
    /// <summary>The version of the instructions the adapter works from, stored with every outfit it proposes.</summary>
    string PromptVersion { get; }

    /// <exception cref="ProviderException">The provider failed or answered with something that is not the agreed JSON.</exception>
    /// <exception cref="OperationCanceledException">The provider did not answer in time.</exception>
    Task<StylistAnswer> SuggestAsync(StylistRequest request, CancellationToken cancellationToken);
}
