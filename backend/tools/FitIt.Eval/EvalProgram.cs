using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Gemini;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Styling;
using FitIt.Infrastructure.Visualizations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace FitIt.Eval;

/// <summary>
/// <c>dotnet run --project tools/FitIt.Eval -- report.md [--stylist Fake|Gemini] [--limit 30] [--max-requests 40] [--visualizations 10]</c>.
/// Writes the report to the path and exits with 1 when any hard rule was broken, 2 when the arguments make no sense.
/// <c>--stylist Gemini</c> spends real calls: the key is read the way the API reads it, from the user-secrets of the API
/// project (<c>Gemini:ApiKey</c>) or the environment (<c>Gemini__ApiKey</c>), and is never printed. <c>--limit</c> runs a fixed
/// sample of the matrix instead of all of it, and <c>--max-requests</c> is the most questions the model is asked in the run.
/// </summary>
public static class EvalProgram
{
    /// <summary>The most questions a run puts to a paid model unless told otherwise.</summary>
    public const int DefaultMaxRequests = 40;

    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args[0].StartsWith('-'))
        {
            await Console.Error.WriteLineAsync("Usage: FitIt.Eval <report.md> [--stylist Fake|Gemini] [--limit <scenarios>] [--max-requests <count>] [--visualizations <count>]");
            return 2;
        }

        var path = args[0];
        var stylistName = Option(args, "--stylist") ?? ProviderOptions.Fake;
        var visualizations = int.TryParse(Option(args, "--visualizations"), out var count) ? count : EvalRunner.DefaultVisualizations;
        int? limit = int.TryParse(Option(args, "--limit"), out var cases) && cases > 0 ? cases : null;
        var maxRequests = int.TryParse(Option(args, "--max-requests"), out var requests) && requests > 0 ? requests : DefaultMaxRequests;

        using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
        IOutfitStylist stylist;
        string name;
        CappedStylist? capped = null;
        if (string.Equals(stylistName, ProviderOptions.Fake, StringComparison.OrdinalIgnoreCase))
        {
            (stylist, name) = (new FakeOutfitStylist(), FakeOutfitStylist.Model);
        }
        else if (string.Equals(stylistName, ProviderOptions.Gemini, StringComparison.OrdinalIgnoreCase))
        {
            var configuration = new ConfigurationBuilder().AddUserSecrets("fitit-api-dev").AddEnvironmentVariables().Build();
            var settings = configuration.GetSection(GeminiOptions.Section).Get<GeminiOptions>() ?? new GeminiOptions();
            if (string.IsNullOrWhiteSpace(settings.ApiKey))
            {
                await Console.Error.WriteLineAsync("Gemini:ApiKey is not set. Set it with `dotnet user-secrets set Gemini:ApiKey <key> --project src/FitIt.Api`.");
                return 2;
            }

            if (limit is null)
            {
                await Console.Error.WriteLineAsync("A paid stylist is evaluated on a sample: give --limit <scenarios>.");
                return 2;
            }

            var gemini = new GeminiClient(http, Options.Create(settings), TimeProvider.System, NullLogger<GeminiClient>.Instance);
            capped = new CappedStylist(new GeminiOutfitStylist(gemini), maxRequests);
            (stylist, name) = (capped, settings.Model);
        }
        else
        {
            await Console.Error.WriteLineAsync($"The stylist '{stylistName}' does not exist; only 'Fake' and 'Gemini' do.");
            return 2;
        }

        var storage = new InMemoryImageStorage(TimeProvider.System);
        storage.Put("eval/silhouette.jpg", [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
        var report = await EvalRunner.RunAsync(
            stylist,
            name,
            EvalMatrix.Full,
            new FakeOutfitVisualizer(storage, Options.Create(new VisualizationOptions { FakePollsBeforeDone = 2 })),
            visualizations,
            limit: limit);

        var markdown = EvalRunner.ToMarkdown(report);
        if (capped is { Refused: > 0 })
        {
            markdown += $"\n**The run reached its cap of {maxRequests} requests: {capped.Refused} further questions were not put to the model, and those answers came from the rules.**\n";
        }

        await File.WriteAllTextAsync(path, markdown);
        Console.WriteLine($"Hard-rule violations: {report.HardRuleViolations}. Report: {path}");
        if (capped is not null)
        {
            Console.WriteLine($"Requests put to the model: {capped.Asked} of at most {maxRequests}.");
        }

        return report.ExitCode;
    }

    private static string? Option(string[] args, string name)
    {
        var index = Array.IndexOf(args, name);
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }

    /// <summary>Lets a paid stylist be asked only so many times in one run; past that it fails like a provider that is down, and the rules answer.</summary>
    private sealed class CappedStylist(IOutfitStylist inner, int max) : IOutfitStylist
    {
        public int Asked { get; private set; }

        public int Refused { get; private set; }

        public string PromptVersion => inner.PromptVersion;

        public Task<StylistAnswer> SuggestAsync(StylistRequest request, CancellationToken cancellationToken)
        {
            if (Asked >= max)
            {
                Refused++;
                throw new ProviderException("The evaluation's cap on requests is reached.");
            }

            Asked++;
            return inner.SuggestAsync(request, cancellationToken);
        }
    }
}
