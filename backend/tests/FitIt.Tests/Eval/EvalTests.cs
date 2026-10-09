using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Eval;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Styling;
using FitIt.Infrastructure.Visualizations;
using FitIt.Tests.Support;
using Microsoft.Extensions.Options;
using static FitIt.Tests.Styling.Looks;

namespace FitIt.Tests.Eval;

/// <summary>The evaluation of the stylist (product spec 6.9, plan 3.10 and 4.5): its matrix, its counts and its gate.</summary>
public sealed class EvalTests
{
    private static readonly EvalMatrix Reduced = new([12], [TemperatureBand.Hot, TemperatureBand.Cold], [Occasion.Everyday, Occasion.Work]);

    [Fact]
    public void The_matrix_of_the_spec_is_three_wardrobes_by_five_weathers_by_six_occasions()
    {
        var scenarios = EvalMatrix.Full.Scenarios().ToList();

        Assert.Equal([12, 30, 60], EvalMatrix.Full.Wardrobes);
        Assert.Equal(3 * 5 * 6, scenarios.Count);
        Assert.Equal(scenarios.Count, scenarios.Distinct().Count());
        Assert.All(scenarios, scenario => Assert.Equal(scenario.Band, new WeatherRules().BandOf(scenario.Feels)));
    }

    [Theory]
    [InlineData(12)]
    [InlineData(30)]
    [InlineData(60)]
    public void The_sample_wardrobes_have_the_size_asked_for_and_are_the_same_every_time(int size)
    {
        var wardrobe = SampleWardrobes.Build(size);

        Assert.Equal(size, wardrobe.Count);
        Assert.Equal(size, wardrobe.Select(garment => garment.Id).Distinct().Count());
        Assert.Equal(wardrobe.Select(garment => (garment.Id, garment.Tags.Name, garment.Description, garment.WearCount, garment.Forgotten, garment.Likes)), SampleWardrobes.Build(size).Select(garment => (garment.Id, garment.Tags.Name, garment.Description, garment.WearCount, garment.Forgotten, garment.Likes)));
        // Something to wear on every part of the body, some of it forgotten and some worn lately.
        Assert.All((Category[])[Category.Top, Category.Bottom, Category.Shoes, Category.Outerwear], role => Assert.Contains(wardrobe, garment => garment.Role == role));
        Assert.Contains(wardrobe, garment => garment.Forgotten);
        Assert.Contains(wardrobe, garment => !garment.Forgotten && garment.WearCount > 0);
        Assert.All(wardrobe, garment => Assert.Equal(garment.Forgotten, garment.WearCount == 0));
    }

    [Fact]
    public async Task A_reduced_matrix_runs_both_stylists_without_breaking_a_hard_rule()
    {
        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake-outfit-stylist", Reduced, visualizer: null);

        Assert.Equal(0, report.HardRuleViolations);
        Assert.Equal(0, report.ExitCode);
        Assert.Equal(["fake-outfit-stylist", "Rule-based generator"], report.Stylists.Select(results => results.Name));
        Assert.All(report.Stylists, results => Assert.Equal(4, results.Outcomes.Count));
        Assert.All(report.Stylists, results => Assert.NotEmpty(results.Answered));
        Assert.All(report.Stylists.SelectMany(results => results.Answered), outcome => Assert.InRange(outcome.Proposals.Count, 1, 3));
        // The configured stylist is the fake, which composes valid outfits itself, so it never needs the fallback; the baseline is the fallback.
        Assert.All(report.Stylists[0].Answered, outcome => Assert.False(outcome.Fallback));
        Assert.All(report.Stylists[1].Answered, outcome => Assert.True(outcome.Fallback));
        Assert.Null(report.Visualizations);
    }

    [Fact]
    public async Task The_same_scenarios_give_the_same_outfits_on_every_run()
    {
        var first = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", Reduced, null);
        var second = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", Reduced, null);

        static IEnumerable<string> Outfits(EvalReport report) =>
            report.Stylists.SelectMany(results => results.Outcomes).SelectMany(outcome => outcome.Proposals.Select(proposal => string.Join(',', proposal.Outfit.Items.Select(garment => garment.Id))));
        Assert.Equal(Outfits(first), Outfits(second));
    }

    [Fact]
    public async Task The_report_says_what_the_spec_asks_to_know()
    {
        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake-outfit-stylist", Reduced, Fake(), visualizations: 3);

        var markdown = EvalRunner.ToMarkdown(report);

        string[] headings = ["# FitIt.Eval: report", "## Result", "## By wardrobe", "## By weather", "## Quality of the outfits", "## Where the wardrobe cannot dress the person", "## Violations of the hard rules", "## Visualizations"];
        Assert.All(headings, heading => Assert.Contains(heading, markdown, StringComparison.Ordinal));
        Assert.Contains("**Hard-rule violations: 0.** The gate is passed.", markdown, StringComparison.Ordinal);
        Assert.Contains("| Stylist | Scenarios | Answered | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms | Cost USD |", markdown, StringComparison.Ordinal);
        Assert.Contains("1 wardrobes (12 garments) x 2 weather bands x 2 occasions = 4 scenarios", markdown, StringComparison.Ordinal);
        Assert.Contains("Rule-based generator", markdown, StringComparison.Ordinal);
        Assert.Contains("stylist-v3", markdown, StringComparison.Ordinal);
        // Nothing is formatted by the machine's locale.
        Assert.DoesNotContain(',', Between(markdown, "| fake-outfit-stylist | 4 |", "\n"));
    }

    [Fact]
    public async Task The_report_counts_what_the_wardrobe_cannot_dress_and_names_the_roles_it_lacks()
    {
        // The smallest wardrobe at the lowest temperature has nothing warm enough for every part of the body.
        var matrix = new EvalMatrix([12], [TemperatureBand.Freezing], [Occasion.Everyday, Occasion.Workout]);

        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", matrix, null);

        var lacking = report.Stylists[0].Outcomes.Where(outcome => !outcome.WasAnswered).ToList();
        Assert.NotEmpty(lacking);
        Assert.All(lacking, outcome => Assert.Empty(outcome.Proposals));
        Assert.Equal(0, report.HardRuleViolations);
        var markdown = EvalRunner.ToMarkdown(report);
        Assert.Contains("| Wardrobe | Weather | Occasion | Lacks (each required) | Lacks (any one of) |", markdown, StringComparison.Ordinal);
        Assert.Contains("mid_layer", markdown, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_visualizations_are_ordered_and_waited_for_and_counted()
    {
        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", EvalMatrix.Full, Fake(), visualizations: 10);

        var pictures = report.Visualizations!;
        Assert.Equal((10, 10, 0, 0, 0m), (pictures.Orders, pictures.Completed, pictures.Blocked, pictures.Failed, pictures.CostUsd));
        Assert.Equal(10, pictures.Elapsed.Count);
        Assert.Equal(FakeOutfitVisualizer.FakeModel, pictures.Model);
        Assert.Contains("| 10 | 10 | 0 | 0 |", EvalRunner.ToMarkdown(report), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Blocked_and_failed_pictures_and_their_costs_are_reported()
    {
        var provider = new ScriptedVisualizer().Completes(0.08m).Blocks(0.01m).ReportsFailure().Completes(0.08m);

        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", Reduced, provider, visualizations: 4);

        var pictures = report.Visualizations!;
        Assert.Equal((4, 2, 1, 1), (pictures.Orders, pictures.Completed, pictures.Blocked, pictures.Failed));
        Assert.Equal(0.17m, pictures.CostUsd);
        Assert.Equal(4, provider.SubmitCalls);
    }

    [Fact]
    public async Task A_provider_that_cannot_take_an_order_counts_as_a_failure_and_does_not_stop_the_run()
    {
        var provider = new ScriptedVisualizer().SubmitFails(2);

        var report = await EvalRunner.RunAsync(new FakeOutfitStylist(), "fake", Reduced, provider, visualizations: 3);

        Assert.Equal((3, 1, 2), (report.Visualizations!.Orders, report.Visualizations.Completed, report.Visualizations.Failed));
    }

    // ---- the checker is a check of its own --------------------------------------------------------------------------

    [Fact]
    public void An_outfit_that_breaks_a_hard_rule_is_found_whatever_produced_it()
    {
        var scenario = new Scenario(12, TemperatureBand.Freezing, -5, Occasion.Business);
        var weather = Day(-5);
        var shirt = Garment(Subcategory.Shirt, formality: 4, warmth: 2);
        var trousers = Garment(Subcategory.Trousers, formality: 4, warmth: 3);
        var shoes = Garment(Subcategory.Boots, formality: 4, warmth: 4);
        var coat = Garment(Subcategory.Coat, formality: 4, warmth: 5);
        var sweater = Garment(Subcategory.Sweater, formality: 4, warmth: 3);
        var shorts = Garment(Subcategory.Shorts, formality: 4, warmth: 1);
        var sandals = Garment(Subcategory.Sandals, formality: 4, warmth: 1);
        var hoodie = Garment(Subcategory.Hoodie, formality: 1, warmth: 3);
        var candidates = CandidateFilter.Select([shirt, trousers, shoes, coat, sweater, shorts, sandals, hoodie], weather, Occasion.Business);
        Assert.True(candidates.IsComplete);

        Proposal Proposed(OutfitDraft draft) => new(draft, null, 50, "x", null);
        var good = new OutfitDraft(shirt, sweater, trousers, null, coat, shoes, []);

        Assert.Empty(EvalRunner.Check([Proposed(good)], candidates, scenario));

        // No shoes in the sense of the rules is not constructible; what is: shorts in the freezing cold, no coat, a garment nobody offered.
        var bareLegs = EvalRunner.Check([Proposed(good with { Bottom = shorts })], candidates, scenario);
        Assert.Contains(bareLegs, violation => violation.Contains("not among the candidates", StringComparison.Ordinal) || violation.Contains("excluded by the weather", StringComparison.Ordinal));
        Assert.NotEmpty(EvalRunner.Check([Proposed(good with { Outerwear = null })], candidates, scenario));
        Assert.NotEmpty(EvalRunner.Check([Proposed(good with { Shoes = sandals })], candidates, scenario));
        Assert.NotEmpty(EvalRunner.Check([Proposed(good with { Top = hoodie.Tags.Category == Category.Top ? hoodie : shirt, MidLayer = hoodie })], candidates, scenario));

        // Nothing at all, or four outfits, are not an answer either.
        Assert.NotEmpty(EvalRunner.Check([], candidates, scenario));
        Assert.NotEmpty(EvalRunner.Check([Proposed(good), Proposed(good), Proposed(good), Proposed(good)], candidates, scenario));
    }

    [Fact]
    public void A_report_with_a_violation_fails_the_gate_and_says_so()
    {
        var scenario = new Scenario(12, TemperatureBand.Hot, 28, Occasion.Everyday);
        var outcome = new Outcome(scenario, [], [], false, [], ["12 garments, hot (28 °C), Everyday: 0 outfits instead of one to 3."], false, false, 0m, TimeSpan.Zero);
        var report = new EvalReport(Reduced, [new StylistResults("fake", [outcome]), new StylistResults("Rule-based generator", [])], null, "fake", "stylist-v3");

        var markdown = EvalRunner.ToMarkdown(report);

        Assert.Equal((1, 1), (report.HardRuleViolations, report.ExitCode));
        Assert.Contains("The gate is NOT passed.", markdown, StringComparison.Ordinal);
        Assert.Contains("- fake: 12 garments, hot (28 °C), Everyday: 0 outfits instead of one to 3.", markdown, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_program_writes_the_report_and_exits_with_zero_when_the_rules_held()
    {
        var path = Path.Combine(Path.GetTempPath(), $"fitit-eval-{Guid.NewGuid():N}.md");
        try
        {
            var exit = await EvalProgram.Main([path, "--visualizations", "2"]);

            Assert.Equal(0, exit);
            var markdown = await File.ReadAllTextAsync(path);
            Assert.Contains("= 90 scenarios per stylist", markdown, StringComparison.Ordinal);
            Assert.Contains("| 2 | 2 | 0 | 0 |", markdown, StringComparison.Ordinal);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Theory]
    [InlineData]
    [InlineData("--stylist", "Fake")]
    [InlineData("report.md", "--stylist", "Claude")]
    public async Task The_program_refuses_arguments_that_make_no_sense_with_a_code_of_its_own(params string[] args)
    {
        var exit = await EvalProgram.Main(args);

        Assert.Equal(2, exit);
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private static FakeOutfitVisualizer Fake()
    {
        var storage = new InMemoryImageStorage(TimeProvider.System);
        storage.Put("eval/silhouette.jpg", TestApi.Jpeg(64));
        return new FakeOutfitVisualizer(storage, Options.Create(new VisualizationOptions { FakePollsBeforeDone = 1 }));
    }

    private static string Between(string text, string start, string end)
    {
        var from = text.IndexOf(start, StringComparison.Ordinal);
        Assert.True(from >= 0, start);
        var to = text.IndexOf(end, from, StringComparison.Ordinal);
        return text[from..to];
    }
}
