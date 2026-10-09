using System.Diagnostics;
using System.Globalization;
using System.Text;
using FitIt.Core.Accounts;
using FitIt.Core.Styling;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Visualizations;

namespace FitIt.Eval;

/// <summary>One row of the matrix of product spec 6.9: a wardrobe, a kind of weather and an occasion.</summary>
public sealed record Scenario(int WardrobeSize, TemperatureBand Band, double Feels, Occasion Occasion);

/// <summary>What the matrix is made of. The default is the one of the spec: 3 wardrobes, 5 weathers, 6 occasions.</summary>
public sealed record EvalMatrix(IReadOnlyList<int> Wardrobes, IReadOnlyList<TemperatureBand> Bands, IReadOnlyList<Occasion> Occasions)
{
    public static readonly EvalMatrix Full = new(SampleWardrobes.Sizes, Enum.GetValues<TemperatureBand>(), Enum.GetValues<Occasion>());

    /// <summary>A temperature that sits squarely in each band, as the tests of the rules take it.</summary>
    public static double FeelsIn(TemperatureBand band) => band switch
    {
        TemperatureBand.Hot => 28,
        TemperatureBand.Warm => 20,
        TemperatureBand.Mild => 14,
        TemperatureBand.Cold => 6,
        _ => -5,
    };

    public IEnumerable<Scenario> Scenarios() =>
        from wardrobe in Wardrobes from band in Bands from occasion in Occasions select new Scenario(wardrobe, band, FeelsIn(band), occasion);
}

/// <summary>What one stylist did with one scenario.</summary>
public sealed record Outcome(
    Scenario Scenario,
    IReadOnlyList<Category> Missing,
    IReadOnlyList<Category> MissingEither,
    bool Fallback,
    IReadOnlyList<Proposal> Proposals,
    IReadOnlyList<string> Violations,
    bool ForgottenAmongCandidates,
    bool HasDiscovery,
    decimal CostUsd,
    TimeSpan Elapsed)
{
    public bool WasAnswered => Missing.Count == 0 && MissingEither.Count == 0;
}

/// <summary>The results of one stylist over the whole matrix.</summary>
public sealed record StylistResults(string Name, IReadOnlyList<Outcome> Outcomes)
{
    public IEnumerable<Outcome> Answered => Outcomes.Where(outcome => outcome.WasAnswered);

    public int Violations => Outcomes.Sum(outcome => outcome.Violations.Count);
}

/// <summary>What the image provider did with the sample outfits: how long each took, what it cost, how many were blocked or failed.</summary>
public sealed record VisualizationResults(string Model, int Orders, int Completed, int Blocked, int Failed, IReadOnlyList<TimeSpan> Elapsed, decimal CostUsd);

public sealed record EvalReport(EvalMatrix Matrix, IReadOnlyList<StylistResults> Stylists, VisualizationResults? Visualizations, string StylistName, string PromptVersion)
{
    public int HardRuleViolations => Stylists.Sum(results => results.Violations);

    /// <summary>Non-zero when any hard rule was broken: the evaluation is a gate, and a build that runs it can stop on this.</summary>
    public int ExitCode => HardRuleViolations == 0 ? 0 : 1;
}

/// <summary>
/// Runs the stylist pipeline of product spec 6.1 in this process over the matrix of spec 6.9, for the configured stylist and
/// for the rule-based generator, and counts what the spec asks for. The pipeline is the one the API runs
/// (<see cref="StylistPipeline"/>): nothing here needs the database, the clock or the network.
/// </summary>
public static class EvalRunner
{
    /// <summary>Visualizations in the report of plan 4.5.</summary>
    public const int DefaultVisualizations = 10;

    public static async Task<EvalReport> RunAsync(
        IOutfitStylist stylist,
        string stylistName,
        EvalMatrix matrix,
        IOutfitVisualizer? visualizer = null,
        int visualizations = DefaultVisualizations,
        CancellationToken cancellationToken = default)
    {
        var rules = new WeatherRules();
        var configured = await RunStylistAsync(stylistName, stylist, matrix, rules, cancellationToken);
        var baseline = await RunStylistAsync("Rule-based generator", null, matrix, rules, cancellationToken);
        var pictures = visualizer is null || visualizations <= 0 ? null : await VisualizeAsync(visualizer, configured, visualizations, cancellationToken);
        return new EvalReport(matrix, [configured, baseline], pictures, stylistName, stylist.PromptVersion);
    }

    private static async Task<StylistResults> RunStylistAsync(string name, IOutfitStylist? stylist, EvalMatrix matrix, WeatherRules rules, CancellationToken cancellationToken)
    {
        var wardrobes = matrix.Wardrobes.ToDictionary(size => size, SampleWardrobes.Build);
        var outcomes = new List<Outcome>();
        foreach (var scenario in matrix.Scenarios())
        {
            var weather = Weather(scenario, rules);
            var wardrobe = wardrobes[scenario.WardrobeSize];
            var candidates = CandidateFilter.Select(wardrobe, weather, scenario.Occasion);
            var forgotten = candidates.Items.Any(candidate => candidate.Garment.Forgotten);
            if (!candidates.IsComplete)
            {
                outcomes.Add(new Outcome(scenario, candidates.Missing, candidates.MissingEither, false, [], [], forgotten, false, 0m, TimeSpan.Zero));
                continue;
            }

            var styling = new StylingCase(weather, scenario.Occasion, null, [StyleTag.Casual, StyleTag.Smart], ThermalPreference.Normal, candidates, StylingHistory.None);
            var watch = Stopwatch.StartNew();
            var run = await StylistPipeline.RunAsync(stylist, styling, new Random(Seed(scenario)), cancellationToken);
            watch.Stop();

            var violations = Check(run.Proposals, candidates, scenario);
            outcomes.Add(new Outcome(
                scenario, [], [], run.Fallback, run.Proposals, violations, forgotten,
                run.Proposals.Any(proposal => proposal.Kind == OutfitKind.Discovery), run.Calls.Sum(call => call.Cost.Usd), watch.Elapsed));
        }

        return new StylistResults(name, outcomes);
    }

    /// <summary>
    /// The hard rules, checked afresh and apart from the pipeline that was supposed to keep them. An answer from a
    /// complete set of candidates must hold one to three outfits, each of which the validator accepts, made only of
    /// candidates, and free of what the weather forbids and the occasion excludes wherever no rule had to give way.
    /// </summary>
    public static IReadOnlyList<string> Check(IReadOnlyList<Proposal> proposals, CandidateSet candidates, Scenario scenario)
    {
        var violations = new List<string>();
        if (proposals.Count is < 1 or > RuleBasedStylist.Proposals)
        {
            violations.Add($"{Describe(scenario)}: {proposals.Count} outfits instead of one to {RuleBasedStylist.Proposals}.");
        }

        var band = BandRule.For(scenario.Band);
        var occasion = OccasionRule.For(scenario.Occasion);
        foreach (var (proposal, index) in proposals.Select((proposal, index) => (proposal, index + 1)))
        {
            violations.AddRange(OutfitValidator.Check(proposal.Outfit, candidates).Select(violation => $"{Describe(scenario)}, outfit {index}: {violation.Describe()}"));
            foreach (var garment in proposal.Outfit.Items)
            {
                if (candidates.AliasOf(garment.Id) is null)
                {
                    violations.Add($"{Describe(scenario)}, outfit {index}: {garment.Tags.Name} is not among the candidates.");
                    continue;
                }

                // Where a rule gave way for this role, the garment may be as far outside it as the filter allows; elsewhere it may not be outside it at all.
                var relaxed = candidates.Relaxations.Any(relaxation => relaxation.Role == garment.Role) ? 1 : 0;
                if (band.Excludes(garment.Tags, relaxed))
                {
                    violations.Add($"{Describe(scenario)}, outfit {index}: {garment.Tags.Name} is excluded by the weather.");
                }

                if (!occasion.AllowsFormality(garment.Tags.Formality, relaxed))
                {
                    violations.Add($"{Describe(scenario)}, outfit {index}: {garment.Tags.Name} is outside the formality of the occasion.");
                }

                if (relaxed == 0 && !occasion.AllowsStyle(garment.Tags.Styles))
                {
                    violations.Add($"{Describe(scenario)}, outfit {index}: {garment.Tags.Name} breaks the style rule of the occasion.");
                }
            }
        }

        return violations;
    }

    private static async Task<VisualizationResults> VisualizeAsync(IOutfitVisualizer visualizer, StylistResults results, int count, CancellationToken cancellationToken)
    {
        // Ten different outfits: the first proposal of the first ten scenarios that were answered.
        var outfits = results.Answered.Where(outcome => outcome.Proposals.Count > 0).Select(outcome => outcome.Proposals[0].Outfit).Take(count).ToList();
        var silhouette = new ImageSource("eval/silhouette.jpg", new Uri("https://eval.invalid/silhouette.jpg"));
        var (completed, blocked, failed, cost) = (0, 0, 0, 0m);
        var times = new List<TimeSpan>();
        foreach (var outfit in outfits)
        {
            var watch = Stopwatch.StartNew();
            var garments = outfit.Items.Select(garment => new PromptGarment(garment.Description, garment.Role)).ToList();
            var input = new VisualizationInput(
                VisualizationPrompt.Build(garments),
                silhouette,
                [.. outfit.Items.Select(garment => new ImageSource($"eval/{garment.Id:N}.png", new Uri($"https://eval.invalid/{garment.Id:N}.png")))]);
            try
            {
                var id = await visualizer.SubmitAsync(input, cancellationToken);
                ProviderJobStatus status;
                do
                {
                    status = await visualizer.GetStatusAsync(id, cancellationToken);
                }
                while (status.State is ProviderJobState.Queued or ProviderJobState.Running);

                switch (status.State)
                {
                    case ProviderJobState.Completed:
                        var image = await visualizer.GetResultAsync(id, cancellationToken);
                        (completed, cost) = (completed + 1, cost + image.Cost.Usd);
                        break;
                    case ProviderJobState.Blocked:
                        (blocked, cost) = (blocked + 1, cost + (status.Cost?.Usd ?? 0m));
                        break;
                    default:
                        (failed, cost) = (failed + 1, cost + (status.Cost?.Usd ?? 0m));
                        break;
                }
            }
            catch (ProviderException)
            {
                failed++;
            }

            times.Add(watch.Elapsed);
        }

        return new VisualizationResults(visualizer.Model, outfits.Count, completed, blocked, failed, times, cost);
    }

    private static WeatherProfile Weather(Scenario scenario, WeatherRules rules)
    {
        var from = new DateTimeOffset(2026, 10, 6, 10, 0, 0, TimeSpan.Zero);
        return new WeatherProfile(
            from, from.AddHours(12), false, scenario.Feels, scenario.Feels + 2, from, from.AddHours(5), 10, 0, null,
            scenario.Feels, rules.BandOf(scenario.Feels), false, false, Sky.CloudSun);
    }

    /// <summary>The same scenario always draws the same outfits. (Not <see cref="HashCode"/>: it is seeded differently in every process.)</summary>
    private static int Seed(Scenario scenario) => (scenario.WardrobeSize * 1009) + ((int)scenario.Band * 31) + (int)scenario.Occasion;

    private static string Describe(Scenario scenario) =>
        string.Create(CultureInfo.InvariantCulture, $"{scenario.WardrobeSize} garments, {Label(scenario.Band)}, {scenario.Occasion}");

    internal static string Label(TemperatureBand band) => $"{band.ToString().ToLowerInvariant()} ({EvalMatrix.FeelsIn(band).ToString(CultureInfo.InvariantCulture)} °C)";

    public static string ToMarkdown(EvalReport report) => EvalMarkdown.Write(report);
}
