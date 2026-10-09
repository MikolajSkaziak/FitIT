using System.Diagnostics;
using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>One question put to the stylist model: what it cost, how long it took, and whether it brought at least one valid outfit.</summary>
public sealed record ModelCall(AiCost Cost, TimeSpan Duration, bool Success);

/// <summary>Why the rules composed the outfits instead of the model.</summary>
public enum FallbackReason
{
    /// <summary>The model was not asked at all: no model is configured, or the day's AI budget is used up.</summary>
    NotAsked,

    /// <summary>The model failed or did not answer in time.</summary>
    Failed,

    /// <summary>The model refused.</summary>
    Refused,

    /// <summary>The model's answers held no outfit that passed the validator, on every try.</summary>
    NoValidOutfit,
}

/// <summary>
/// What came of one request for proposals. <see cref="Model"/> is null when the rules composed the outfits;
/// <see cref="Reason"/> then says why. <see cref="Calls"/> lists every question put to the model, for the usage log.
/// </summary>
public sealed record StylistRun(
    IReadOnlyList<Proposal> Proposals,
    string? Model,
    FallbackReason? Reason,
    IReadOnlyList<ModelCall> Calls,
    IReadOnlyList<string> Errors,
    Exception? Failure)
{
    public bool Fallback => Model is null;
}

/// <summary>
/// Steps three and four of the stylist (product spec 6.1): the model's choice, the validator and the score, one retry
/// with the list of errors, and the rule-based fallback (6.7). It touches neither the database nor the clock, so the
/// service that serves the app and the evaluation project run exactly the same code.
/// </summary>
public static class StylistPipeline
{
    /// <summary>The first answer and one retry.</summary>
    public const int ModelAttempts = 2;

    /// <param name="stylist">The model, or null to let the rules compose the outfits.</param>
    public static async Task<StylistRun> RunAsync(IOutfitStylist? stylist, StylingCase styling, Random random, CancellationToken cancellationToken)
    {
        var calls = new List<ModelCall>();
        var (reason, errors, failure) = (FallbackReason.NotAsked, (IReadOnlyList<string>)[], (Exception?)null);

        if (stylist is not null)
        {
            for (var attempt = 1; attempt <= ModelAttempts; attempt++)
            {
                var watch = Stopwatch.StartNew();
                StylistAnswer answer;
                try
                {
                    answer = await stylist.SuggestAsync(new StylistRequest(styling, errors), cancellationToken);
                }
                catch (Exception exception) when (exception is ProviderException || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
                {
                    calls.Add(new ModelCall((exception as ProviderException)?.Cost ?? AiCost.None("unknown"), watch.Elapsed, Success: false));
                    (reason, failure) = (FallbackReason.Failed, exception);
                    break;
                }

                var results = OutfitValidator.Check(answer.Outfits, styling.Candidates);
                var valid = results.Where(result => result.IsValid).Take(RuleBasedStylist.Proposals).ToList();
                calls.Add(new ModelCall(answer.Cost, watch.Elapsed, Success: valid.Count > 0));
                if (answer.Refused)
                {
                    reason = FallbackReason.Refused;
                    break;
                }

                if (valid.Count > 0)
                {
                    var band = styling.Weather.Rule;
                    return new StylistRun(
                        [
                            .. valid.Select(result => new Proposal(
                                result.Draft!,
                                result.Draft!.Confirm(result.Source.Kind, styling.History.WornPairs),
                                CoherenceScore.Of(result.Draft!, band),
                                Short(result.Source.Reasoning, Outfit.ReasoningMaxLength) ?? "",
                                Short(result.Source.WeatherNote, Outfit.WeatherNoteMaxLength))),
                        ],
                        answer.Cost.Model,
                        null,
                        calls,
                        [],
                        null);
                }

                reason = FallbackReason.NoValidOutfit;
                errors = results.Count == 0
                    ? ["No outfits were returned."]
                    : [.. results.SelectMany((result, index) => result.Violations.Select(violation => $"Outfit {index + 1}: {violation.Describe()}"))];
            }
        }

        var proposals = RuleBasedStylist.Compose(styling.Candidates, styling.Weather, styling.History.WornPairs, random);
        return new StylistRun(proposals, null, reason, calls, errors, failure);
    }

    private static string? Short(string? text, int length)
    {
        var trimmed = text?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed.Length > length ? trimmed[..length] : trimmed;
    }
}
