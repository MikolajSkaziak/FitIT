using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Styling;

/// <summary>
/// Stands in for the stylist model until there is a provider key. It has no taste: it composes valid outfits from the
/// candidates the way the rule-based fallback does and claims the three kinds in order. The same candidates always
/// get the same answer, so the screens and the rest of the pipeline can be built and tested against it.
/// </summary>
public sealed class FakeOutfitStylist : IOutfitStylist
{
    public const string Model = "fake-outfit-stylist";

    private static readonly OutfitKind[] Kinds = [OutfitKind.SureBet, OutfitKind.Discovery, OutfitKind.NewPairing];

    public string PromptVersion => StylistPrompt.Version;

    public Task<StylistAnswer> SuggestAsync(StylistRequest request, CancellationToken cancellationToken) =>
        Task.FromResult(new StylistAnswer(Compose(request.Case), false, AiCost.None(Model)));

    public static IReadOnlyList<StylistOutfit> Compose(StylingCase styling)
    {
        var candidates = styling.Candidates;
        // Guid hashes do not change from process to process, unlike those of strings.
        var seed = candidates.Items.Aggregate(17, (hash, candidate) => unchecked((hash * 31) + candidate.Garment.Id.GetHashCode()));
        var proposals = RuleBasedStylist.Compose(candidates, styling.Weather, styling.History.WornPairs, new Random(seed), styling.Styles);
        return [.. proposals.Select((proposal, index) => StylistOutfit.From(proposal.Outfit, candidates, Kinds[index], proposal.Reasoning, proposal.WeatherNote, proposal.Style))];
    }
}
