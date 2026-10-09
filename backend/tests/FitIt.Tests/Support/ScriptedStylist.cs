using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Styling;

namespace FitIt.Tests.Support;

/// <summary>
/// A stylist whose behaviour a test writes in advance: each call takes the next step from the script and, when the
/// script is empty, answers with valid outfits the way the fake does. Every request is kept for inspection.
/// </summary>
public sealed class ScriptedStylist : IOutfitStylist
{
    public const string Model = "scripted-stylist";

    private readonly Queue<Func<StylistRequest, StylistAnswer>> _steps = new();
    private readonly Lock _gate = new();

    public string PromptVersion => StylistPrompt.Version;

    public List<StylistRequest> Requests { get; } = [];

    /// <summary>Forgets scripts and requests left by an earlier test. Returns itself so a script can follow in one line.</summary>
    public ScriptedStylist Reset()
    {
        lock (_gate)
        {
            _steps.Clear();
            Requests.Clear();
        }

        return this;
    }

    public ScriptedStylist Answers(Func<StylistRequest, IReadOnlyList<StylistOutfit>> outfits, decimal cost = 0m) =>
        Script(1, request => new StylistAnswer(outfits(request), false, new AiCost(Model, cost)));

    /// <summary>Valid outfits, as the fake would give, at a price.</summary>
    public ScriptedStylist AnswersWell(decimal cost) => Answers(request => FakeOutfitStylist.Compose(request.Case), cost);

    /// <summary>Outfits that name garments nobody offered and forget the shoes.</summary>
    public ScriptedStylist AnswersNonsense(int times = 1, decimal cost = 0m) => Script(times, _ => new StylistAnswer(
        [
            new StylistOutfit(OutfitKind.SureBet, "T99", null, "B1", null, null, "S1", [], "Bo tak.", null),
            new StylistOutfit(OutfitKind.Discovery, "T1", null, "B1", null, null, null, [], "Bo tak.", null),
        ],
        false,
        new AiCost(Model, cost)));

    public ScriptedStylist AnswersNothing() => Script(1, _ => new StylistAnswer([], false, new AiCost(Model, 0m)));

    public ScriptedStylist Refuses(decimal cost = 0m) => Script(1, _ => StylistAnswer.Refusal(new AiCost(Model, cost)));

    public ScriptedStylist Fails(decimal? cost = null) =>
        Script(1, _ => throw new ProviderException("The stylist model is down.") { Cost = cost is { } usd ? new AiCost(Model, usd) : null });

    /// <summary>What an HTTP client throws when the provider does not answer in time.</summary>
    public ScriptedStylist TimesOut() => Script(1, _ => throw new TaskCanceledException("The request to the stylist model timed out."));

    public Task<StylistAnswer> SuggestAsync(StylistRequest request, CancellationToken cancellationToken)
    {
        Func<StylistRequest, StylistAnswer>? step;
        lock (_gate)
        {
            Requests.Add(request);
            _steps.TryDequeue(out step);
        }

        return Task.FromResult(step?.Invoke(request) ?? new StylistAnswer(FakeOutfitStylist.Compose(request.Case), false, new AiCost(Model, 0m)));
    }

    private ScriptedStylist Script(int times, Func<StylistRequest, StylistAnswer> step)
    {
        lock (_gate)
        {
            for (var i = 0; i < times; i++)
            {
                _steps.Enqueue(step);
            }
        }

        return this;
    }
}
