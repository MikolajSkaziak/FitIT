using FitIt.Core.Styling;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Styling;
using FitIt.Infrastructure.Visualizations;
using Microsoft.Extensions.Options;

namespace FitIt.Eval;

/// <summary>
/// <c>dotnet run --project tools/FitIt.Eval -- report.md [--stylist Fake] [--visualizations 10]</c>. Writes the report to the
/// path and exits with 1 when any hard rule was broken, 2 when the arguments make no sense.
/// </summary>
public static class EvalProgram
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args[0].StartsWith('-'))
        {
            await Console.Error.WriteLineAsync("Usage: FitIt.Eval <report.md> [--stylist Fake] [--visualizations <count>]");
            return 2;
        }

        var path = args[0];
        var stylistName = Option(args, "--stylist") ?? "Fake";
        var visualizations = int.TryParse(Option(args, "--visualizations"), out var count) ? count : EvalRunner.DefaultVisualizations;

        // The same rule as at the API's startup: until a real adapter exists, only the fake can be evaluated.
        if (!string.Equals(stylistName, ProviderOptions.Fake, StringComparison.OrdinalIgnoreCase))
        {
            await Console.Error.WriteLineAsync($"The stylist '{stylistName}' does not exist yet; only 'Fake' does.");
            return 2;
        }

        var storage = new InMemoryImageStorage(TimeProvider.System);
        storage.Put("eval/silhouette.jpg", [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
        var report = await EvalRunner.RunAsync(
            new FakeOutfitStylist(),
            FakeOutfitStylist.Model,
            EvalMatrix.Full,
            new FakeOutfitVisualizer(storage, Options.Create(new VisualizationOptions { FakePollsBeforeDone = 2 })),
            visualizations);

        var markdown = EvalRunner.ToMarkdown(report);
        await File.WriteAllTextAsync(path, markdown);
        Console.WriteLine($"Hard-rule violations: {report.HardRuleViolations}. Report: {path}");
        return report.ExitCode;
    }

    private static string? Option(string[] args, string name)
    {
        var index = Array.IndexOf(args, name);
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}
