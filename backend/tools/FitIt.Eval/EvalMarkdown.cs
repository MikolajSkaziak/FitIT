using System.Globalization;
using System.Text;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;

namespace FitIt.Eval;

/// <summary>The report in Markdown: what product spec 6.9 asks to be counted, the details behind each count, and what is not measured here.</summary>
internal static class EvalMarkdown
{
    private static readonly CultureInfo C = CultureInfo.InvariantCulture;

    public static string Write(EvalReport report)
    {
        var text = new StringBuilder();
        var scenarios = report.Matrix.Scenarios().Count();
        text.AppendLine("# FitIt.Eval: report");
        text.AppendLine();
        text.AppendLine(C, $"Matrix of product spec 6.9: {report.Matrix.Wardrobes.Count} wardrobes ({string.Join(", ", report.Matrix.Wardrobes)} garments) x {report.Matrix.Bands.Count} weather bands x {report.Matrix.Occasions.Count} occasions = {scenarios} scenarios per stylist.");
        text.AppendLine(C, $"Configured stylist: `{report.StylistName}` (the one `Providers:OutfitStylist` selects; prompt `{report.PromptVersion}`). Baseline: the rule-based generator of spec 6.7, on the same scenarios.");
        text.AppendLine();
        text.AppendLine("The pipeline is the one the API runs (`StylistPipeline`), without the database, the clock or the network. Every answer is checked again here, apart from the pipeline.");
        text.AppendLine();

        text.AppendLine("## Result");
        text.AppendLine();
        text.AppendLine(report.HardRuleViolations == 0
            ? "**Hard-rule violations: 0.** The gate is passed."
            : $"**Hard-rule violations: {report.HardRuleViolations.ToString(C)}. The gate is NOT passed.**");
        text.AppendLine();
        text.AppendLine("| Stylist | Scenarios | Answered | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms | Cost USD |");
        text.AppendLine("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
        foreach (var results in report.Stylists)
        {
            text.AppendLine(SummaryRow(results.Name, [.. results.Outcomes]));
        }

        text.AppendLine();
        text.AppendLine("- **Valid discovery:** of the answers whose candidates included a forgotten garment, the share with at least one outfit that really contains one and is labelled a discovery.");
        text.AppendLine("- **Served by fallback:** of the answers, the share the rules composed because the model could not be used. The rule-based generator is the fallback itself, so its share is 100% by definition.");
        text.AppendLine("- **`missing_garments`:** the share of scenarios where the wardrobe cannot dress the person; the stylist is not asked and nothing is counted against the day's limit.");
        text.AppendLine("- **Time** is the pipeline alone: the filter's work is not in it, a real provider's network time is (and is not measured by the fake).");
        text.AppendLine();

        text.AppendLine("## By wardrobe");
        text.AppendLine();
        text.AppendLine("| Stylist | Wardrobe | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |");
        text.AppendLine("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
        foreach (var results in report.Stylists)
        {
            foreach (var size in report.Matrix.Wardrobes)
            {
                text.AppendLine(GroupRow(results.Name, size.ToString(C), [.. results.Outcomes.Where(outcome => outcome.Scenario.WardrobeSize == size)]));
            }
        }

        text.AppendLine();
        text.AppendLine("## By weather");
        text.AppendLine();
        text.AppendLine("| Stylist | Weather | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |");
        text.AppendLine("|---|---|---:|---:|---:|---:|---:|---:|---:|");
        foreach (var results in report.Stylists)
        {
            foreach (var band in report.Matrix.Bands)
            {
                text.AppendLine(GroupRow(results.Name, EvalRunner.Label(band), [.. results.Outcomes.Where(outcome => outcome.Scenario.Band == band)]));
            }
        }

        text.AppendLine();
        text.AppendLine("## Quality of the outfits");
        text.AppendLine();
        text.AppendLine("| Stylist | Outfits | Mean score | Labelled (sure bet, discovery, new pairing) | Three outfits in an answer |");
        text.AppendLine("|---|---:|---:|---:|---:|");
        foreach (var results in report.Stylists)
        {
            var proposals = results.Answered.SelectMany(outcome => outcome.Proposals).ToList();
            var answered = results.Answered.ToList();
            text.AppendLine(C, $"| {results.Name} | {proposals.Count} | {(proposals.Count == 0 ? "n/a" : proposals.Average(proposal => proposal.Score).ToString("F1", C))} | {Percent(proposals.Count(proposal => proposal.Kind is not null), proposals.Count)} | {Percent(answered.Count(outcome => outcome.Proposals.Count == RuleBasedStylist.Proposals), answered.Count)} |");
        }

        text.AppendLine();
        text.AppendLine("The mean score is the coherence score of spec 6.6 (0 to 100). Whether an outfit is fit to wear is judged by a person, on a sample (goal: at least 70%); that is not measured here.");
        text.AppendLine();

        text.AppendLine("## Where the wardrobe cannot dress the person (`missing_garments`)");
        text.AppendLine();
        var missing = report.Stylists[0].Outcomes.Where(outcome => !outcome.WasAnswered).ToList();
        if (missing.Count == 0)
        {
            text.AppendLine("None.");
        }
        else
        {
            text.AppendLine("The filter is the same for both stylists, so the list is the same.");
            text.AppendLine();
            text.AppendLine("| Wardrobe | Weather | Occasion | Lacks (each required) | Lacks (any one of) |");
            text.AppendLine("|---:|---|---|---|---|");
            foreach (var outcome in missing)
            {
                text.AppendLine(C, $"| {outcome.Scenario.WardrobeSize} | {EvalRunner.Label(outcome.Scenario.Band)} | {outcome.Scenario.Occasion} | {Roles(outcome.Missing)} | {Roles(outcome.MissingEither)} |");
            }
        }

        text.AppendLine();
        text.AppendLine("## Violations of the hard rules");
        text.AppendLine();
        var violations = report.Stylists.SelectMany(results => results.Outcomes.SelectMany(outcome => outcome.Violations.Select(violation => (results.Name, violation)))).ToList();
        if (violations.Count == 0)
        {
            text.AppendLine("None.");
        }
        else
        {
            foreach (var (name, violation) in violations)
            {
                text.AppendLine(C, $"- {name}: {violation}");
            }
        }

        text.AppendLine();
        text.AppendLine("## Visualizations");
        text.AppendLine();
        if (report.Visualizations is not { } pictures)
        {
            text.AppendLine("Not run.");
        }
        else
        {
            text.AppendLine(C, $"{pictures.Orders} different outfits (the first proposal of the first scenarios that were answered) ordered from the image provider `{pictures.Model}`, each waited for through the same three calls the job uses.");
            text.AppendLine();
            text.AppendLine("| Orders | Completed | Blocked by the filter | Failed | Median s | p95 s | Cost USD |");
            text.AppendLine("|---:|---:|---:|---:|---:|---:|---:|");
            var seconds = pictures.Elapsed.Select(time => time.TotalSeconds).Order().ToList();
            text.AppendLine(C, $"| {pictures.Orders} | {pictures.Completed} | {pictures.Blocked} | {pictures.Failed} | {Seconds(seconds, 0.5)} | {Seconds(seconds, 0.95)} | {pictures.CostUsd.ToString("F4", C)} |");
            text.AppendLine();
            text.AppendLine("With the fake provider the time is that of the code alone and the cost is zero; the first real numbers appear when the real provider is plugged in behind the same port.");
        }

        return text.ToString();
    }

    /// <summary>A row of the summary: the stylist, how many scenarios and how many were answered, then the counts of spec 6.9 and the cost.</summary>
    private static string SummaryRow(string name, List<Outcome> all)
    {
        var m = Measure(all);
        return $"| {name} | {all.Count.ToString(C)} | {m.Answered} | {m.Missing} | {m.Violations} | {m.Discovery} | {m.Fallback} | {m.Median} | {m.P95} | {all.Sum(outcome => outcome.CostUsd).ToString("F4", C)} |";
    }

    /// <summary>A row of a breakdown: the stylist, what the rows are grouped by, then the same counts.</summary>
    private static string GroupRow(string name, string group, List<Outcome> all)
    {
        var m = Measure(all);
        return $"| {name} | {group} | {all.Count.ToString(C)} | {m.Missing} | {m.Violations} | {m.Discovery} | {m.Fallback} | {m.Median} | {m.P95} |";
    }

    private static (string Answered, string Missing, string Violations, string Discovery, string Fallback, string Median, string P95) Measure(List<Outcome> all)
    {
        var answered = all.Where(outcome => outcome.WasAnswered).ToList();
        var withForgotten = answered.Where(outcome => outcome.ForgottenAmongCandidates).ToList();
        var millis = answered.Select(outcome => outcome.Elapsed.TotalMilliseconds).Order().ToList();
        return (
            answered.Count.ToString(C),
            Percent(all.Count - answered.Count, all.Count),
            all.Sum(outcome => outcome.Violations.Count).ToString(C),
            withForgotten.Count == 0 ? "n/a" : Percent(withForgotten.Count(outcome => outcome.HasDiscovery), withForgotten.Count),
            Percent(answered.Count(outcome => outcome.Fallback), answered.Count),
            Millis(millis, 0.5),
            Millis(millis, 0.95));
    }

    private static string Percent(int part, int whole) => whole == 0 ? "n/a" : string.Create(C, $"{100.0 * part / whole:F0}% ({part}/{whole})");

    private static string Millis(List<double> sorted, double quantile) => sorted.Count == 0 ? "n/a" : Quantile(sorted, quantile).ToString("F2", C);

    private static string Seconds(List<double> sorted, double quantile) => sorted.Count == 0 ? "n/a" : Quantile(sorted, quantile).ToString("F3", C);

    /// <summary>The value below which the given share of the sorted values lies (nearest rank).</summary>
    private static double Quantile(List<double> sorted, double quantile) => sorted[Math.Clamp((int)Math.Ceiling(quantile * sorted.Count) - 1, 0, sorted.Count - 1)];

    private static string Roles(IReadOnlyList<Category> roles) => roles.Count == 0 ? "" : string.Join(", ", roles.Select(role => FitIt.Core.Common.EnumCodes.ToCode(role)));
}
