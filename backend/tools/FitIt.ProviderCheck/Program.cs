using System.Diagnostics;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Eval;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Gemini;
using FitIt.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

// A live check of the Gemini adapters, run by hand: it spends real calls (one for the tagger, one or two for the stylist).
//
//   dotnet run --project tools/FitIt.ProviderCheck -- <picture of a garment> [tagger|stylist|all]
//
// The key is read the way the API reads it: user-secrets of the API project (Gemini:ApiKey) or the environment
// (Gemini__ApiKey). It is never printed. Exit code 0: every check passed; 1: one failed; 2: no key or wrong arguments.

if (args.Length == 0 || !File.Exists(args[0]))
{
    Console.Error.WriteLine("Usage: FitIt.ProviderCheck <picture of a garment> [tagger|stylist|all]");
    return 2;
}

System.Globalization.CultureInfo.DefaultThreadCurrentCulture = System.Globalization.CultureInfo.InvariantCulture;
System.Globalization.CultureInfo.CurrentCulture = System.Globalization.CultureInfo.InvariantCulture;
var what = args.Length > 1 ? args[1] : "all";
var configuration = new ConfigurationBuilder().AddUserSecrets("fitit-api-dev").AddEnvironmentVariables().Build();
var settings = configuration.GetSection(GeminiOptions.Section).Get<GeminiOptions>() ?? new GeminiOptions();
if (string.IsNullOrWhiteSpace(settings.ApiKey))
{
    Console.Error.WriteLine("Gemini:ApiKey is not set. Set it with `dotnet user-secrets set Gemini:ApiKey <key> --project src/FitIt.Api`.");
    return 2;
}

Console.WriteLine($"Model: {settings.Model}, fallback: {settings.FallbackModel}");
using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
var gemini = new GeminiClient(http, Options.Create(settings), TimeProvider.System, NullLogger<GeminiClient>.Instance);
var failed = false;

if (what is "tagger" or "all")
{
    var storage = new InMemoryImageStorage(TimeProvider.System);
    storage.Put("check/garment", await File.ReadAllBytesAsync(args[0]));
    var watch = Stopwatch.StartNew();
    try
    {
        var outcome = await new GeminiGarmentTagger(gemini, storage).TagAsync(new ImageSource("check/garment", new Uri("https://storage.invalid/check/garment")), CancellationToken.None);
        Console.WriteLine($"Tagger ({watch.ElapsedMilliseconds} ms, {outcome.Cost.Model}, ${outcome.Cost.Usd}):");
        Console.WriteLine(outcome.Rejected is { } reason
            ? $"  rejected: {reason}"
            : $"  {outcome.Tags!.Category}/{outcome.Tags.Subcategory} \"{outcome.Tags.Name}\" colors=[{string.Join(',', outcome.Tags.Colors)}] pattern={outcome.Tags.Pattern} material={outcome.Tags.Material} formality={outcome.Tags.Formality} warmth={outcome.Tags.Warmth} rain_ok={outcome.Tags.RainOk} styles=[{string.Join(',', outcome.Tags.Styles)}] seasons=[{string.Join(',', outcome.Tags.Seasons ?? [])}]\n  description: {outcome.Description}");
    }
    catch (ProviderException exception)
    {
        failed = true;
        Console.WriteLine($"Tagger failed after {watch.ElapsedMilliseconds} ms: {exception.Message}");
    }
}

if (what is "stylist" or "all")
{
    // One scenario of the evaluation: the sample wardrobe of 12 garments, a mild day, an everyday occasion, through the real pipeline.
    var report = await EvalRunner.RunAsync(new GeminiOutfitStylist(gemini), settings.Model, new EvalMatrix([12], [TemperatureBand.Mild], [Occasion.Everyday], [StyleProfile.CasualSmart]));
    var results = report.Stylists[0];
    foreach (var outcome in results.Outcomes)
    {
        Console.WriteLine($"Stylist ({outcome.Elapsed.TotalMilliseconds:0} ms, ${outcome.CostUsd}): fallback to rules={outcome.Fallback}, hard-rule violations={outcome.Violations.Count}");
        failed |= outcome.Fallback || outcome.Violations.Count > 0;
        foreach (var proposal in outcome.Proposals)
        {
            Console.WriteLine($"  {proposal.Kind?.ToString() ?? "(no kind)"} score={proposal.Score}: {string.Join(" + ", proposal.Outfit.Items.Select(garment => garment.Tags.Name))}\n    {proposal.Reasoning}{(proposal.WeatherNote is null ? "" : $"\n    weather: {proposal.WeatherNote}")}");
        }

        foreach (var violation in outcome.Violations)
        {
            Console.WriteLine($"  violation: {violation}");
        }
    }
}

return failed ? 1 : 0;
