using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Styling;

/// <summary>
/// Stands in for the critic model until there is a provider key. It has no taste of its own: it words the rules of the
/// stylist, the coherence penalties and the weather table (<see cref="RuleBasedCritique"/>), so the same garments always get
/// the same sentences. It costs nothing.
/// </summary>
public sealed class FakeOutfitCritic : IOutfitCritic
{
    public const string Model = "fake-outfit-critic";

    public Task<Critique> CritiqueAsync(CritiqueRequest request, CancellationToken cancellationToken) =>
        Task.FromResult(RuleBasedCritique.Of(request, AiCost.None(Model)));
}
