using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;
using FitIt.Core.Styling;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Fal;
using FitIt.Infrastructure.Gemini;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FitIt.Tests.Providers;

/// <summary>Where the provider keys come from, what happens without them, and the places they must never turn up in.</summary>
public sealed partial class ProviderSecretsTests
{
    // ---- configuration ----------------------------------------------------------------------------------------------

    [Fact]
    public void The_settings_in_the_repository_keep_every_ai_provider_on_its_fake_and_hold_no_key()
    {
        var root = RepositoryRoot();
        foreach (var file in new[] { "appsettings.json", "appsettings.Development.json" })
        {
            var configuration = new ConfigurationBuilder().AddJsonFile(Path.Combine(root, "backend", "src", "FitIt.Api", file)).Build();
            Assert.True(string.IsNullOrEmpty(configuration["Gemini:ApiKey"]), file);
            Assert.True(string.IsNullOrEmpty(configuration["Fal:ApiKey"]), file);
            foreach (var port in new[] { "BackgroundRemover", "GarmentTagger", "OutfitStylist", "OutfitCritic", "OutfitVisualizer", "ColorAnalyst" })
            {
                Assert.Contains(configuration[$"Providers:{port}"], new[] { null, ProviderOptions.Fake });
            }
        }
    }

    [Theory]
    [InlineData("GarmentTagger", "Gemini", "Gemini:ApiKey", "Gemini__ApiKey")]
    [InlineData("OutfitStylist", "Gemini", "Gemini:ApiKey", "Gemini__ApiKey")]
    [InlineData("OutfitCritic", "Gemini", "Gemini:ApiKey", "Gemini__ApiKey")]
    [InlineData("ColorAnalyst", "Gemini", "Gemini:ApiKey", "Gemini__ApiKey")]
    [InlineData("BackgroundRemover", "Fal", "Fal:ApiKey", "Fal__ApiKey")]
    [InlineData("OutfitVisualizer", "Fal", "Fal:ApiKey", "Fal__ApiKey")]
    public void A_real_provider_without_its_key_stops_the_application_at_startup_and_says_which_key(string port, string provider, string key, string variable)
    {
        using var host = Host(new() { [$"Providers:{port}"] = provider });

        // What the host does when it starts: every options class registered with ValidateOnStart is validated.
        var failure = Assert.Throws<OptionsValidationException>(() => host.Services.GetRequiredService<IStartupValidator>().Validate());

        Assert.Contains(failure.Failures, message => message.Contains(key, StringComparison.Ordinal) && message.Contains(variable, StringComparison.Ordinal) && message.Contains("user-secrets", StringComparison.Ordinal));
    }

    [Fact]
    public async Task With_the_keys_configured_the_real_adapters_stand_behind_the_ports()
    {
        using var host = Host(new()
        {
            ["Providers:GarmentTagger"] = "Gemini",
            ["Providers:OutfitStylist"] = "gemini",
            ["Providers:OutfitCritic"] = "Gemini",
            ["Providers:ColorAnalyst"] = "Gemini",
            ["Providers:BackgroundRemover"] = "Fal",
            ["Providers:OutfitVisualizer"] = "Fal",
            ["Gemini:ApiKey"] = StubHttp.Key,
            ["Fal:ApiKey"] = StubHttp.Key,
        });

        host.Services.GetRequiredService<IStartupValidator>().Validate();

        await using var scope = host.Services.CreateAsyncScope();
        Assert.IsType<GeminiGarmentTagger>(scope.ServiceProvider.GetRequiredService<IGarmentTagger>());
        Assert.IsType<GeminiOutfitStylist>(scope.ServiceProvider.GetRequiredService<IOutfitStylist>());
        Assert.IsType<GeminiOutfitCritic>(scope.ServiceProvider.GetRequiredService<IOutfitCritic>());
        Assert.IsType<GeminiColorAnalyst>(scope.ServiceProvider.GetRequiredService<FitIt.Core.Accounts.IColorAnalyst>());
        Assert.IsType<FalBackgroundRemover>(scope.ServiceProvider.GetRequiredService<IBackgroundRemover>());
        Assert.IsType<FalOutfitVisualizer>(scope.ServiceProvider.GetRequiredService<IOutfitVisualizer>());
    }

    [Fact]
    public void With_every_provider_on_its_fake_no_key_is_asked_for()
    {
        using var host = Host([]);

        host.Services.GetRequiredService<IStartupValidator>().Validate();
    }

    [Fact]
    public void A_provider_name_nobody_knows_is_refused_by_name()
    {
        var failure = Assert.Throws<InvalidOperationException>(() => Host(new() { ["Providers:GarmentTagger"] = "Claude" }));

        Assert.Contains("Providers:GarmentTagger", failure.Message, StringComparison.Ordinal);
    }

    // ---- logging ----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Nothing_the_http_clients_log_at_any_level_carries_a_key_a_header_or_an_address_of_a_picture()
    {
        var log = new CapturingLogs();
        var http = new StubHttp()
            .Json(HttpStatusCode.ServiceUnavailable, """{"error":{"status":"UNAVAILABLE"}}""")
            .Json(HttpStatusCode.OK, """{"candidates":[{"content":{"parts":[{"text":"{}"}]}}]}""")
            .Json(HttpStatusCode.OK, """{"images":[{"url":"https://v3.fal.media/files/zebra/secret-picture.jpg"}]}""")
            .Bytes([0xFF, 0xD8, 0xFF, 0xE0], "image/jpeg")
            .Json(HttpStatusCode.InternalServerError, "{}");
        using var host = Host(
            new() { ["Providers:GarmentTagger"] = "Gemini", ["Providers:OutfitVisualizer"] = "Fal", ["Gemini:ApiKey"] = StubHttp.Key, ["Fal:ApiKey"] = StubHttp.Key, ["Gemini:MaxRetries"] = "0" },
            services =>
            {
                services.AddLogging(logging => logging.ClearProviders().SetMinimumLevel(LogLevel.Trace).AddProvider(log));
                services.ConfigureHttpClientDefaults(client => client.ConfigurePrimaryHttpMessageHandler(() => http));
            });
        await using var scope = host.Services.CreateAsyncScope();

        await scope.ServiceProvider.GetRequiredService<GeminiClient>().AskAsync("system", [GeminiPart.Of("data")], [], CancellationToken.None);
        var visualizer = scope.ServiceProvider.GetRequiredService<IOutfitVisualizer>();
        await visualizer.GetResultAsync("fal-ai/nano-banana-2/requests/764cabcf-b745-4b3e-ae38-1200304cf45b", CancellationToken.None);
        await Assert.ThrowsAsync<ProviderException>(() => visualizer.GetStatusAsync("fal-ai/nano-banana-2/requests/764cabcf-b745-4b3e-ae38-1200304cf45b", CancellationToken.None));

        Assert.Equal(5, http.Requests.Count);
        Assert.Contains(http.Requests, request => request.Headers.Values.Any(value => value.Contains(StubHttp.Key, StringComparison.Ordinal)));
        Assert.DoesNotContain(log.Lines, line => line.Contains(StubHttp.Key, StringComparison.Ordinal));
        Assert.DoesNotContain(log.Lines, line => line.Contains("x-goog-api-key", StringComparison.OrdinalIgnoreCase) || line.Contains("Authorization", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(log.Lines, line => line.Contains("fal.media", StringComparison.Ordinal) || line.Contains("secret-picture", StringComparison.Ordinal));
        // The warning about a model that does not answer is the adapters' own and is meant to be there.
        Assert.Contains(log.Lines, line => line.Contains("gemini-3.8-flash", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(nameof(GeminiClient))]
    [InlineData(nameof(FalClient))]
    public void Should_logging_of_requests_ever_be_switched_back_on_the_headers_with_keys_stay_redacted(string client)
    {
        using var host = Host([]);

        var options = host.Services.GetRequiredService<IOptionsMonitor<HttpClientFactoryOptions>>().Get(client);

        Assert.True(options.ShouldRedactHeaderValue("Authorization"));
        Assert.True(options.ShouldRedactHeaderValue("x-goog-api-key"));
        Assert.True(options.ShouldRedactHeaderValue("X-Goog-Api-Key"));
    }

    // ---- the repository ---------------------------------------------------------------------------------------------

    // The shapes of real keys: Google API keys (old and new format), fal keys (id:secret), and the usual others, so that a
    // key pasted anywhere in the repository fails the build instead of reaching a commit.
    [GeneratedRegex(@"AIza[0-9A-Za-z_\-]{35}")]
    private static partial Regex GoogleKey();

    [GeneratedRegex(@"(?<![A-Za-z0-9_.\-])AQ\.[A-Za-z0-9_\-]{30,}")]
    private static partial Regex GoogleNewKey();

    [GeneratedRegex(@"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}")]
    private static partial Regex FalKey();

    [GeneratedRegex(@"sk-(ant-|proj-)?[A-Za-z0-9_\-]{32,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----")]
    private static partial Regex OtherSecret();

    [Fact]
    public void No_file_of_the_repository_tracked_or_new_holds_anything_shaped_like_a_provider_key()
    {
        var root = RepositoryRoot();
        var files = Files(root);
        Assert.True(files.Count > 100, $"Only {files.Count} files were found under {root}.");
        Assert.Contains(files, file => file.EndsWith("appsettings.json", StringComparison.Ordinal));
        Assert.Contains(files, file => file.EndsWith(".env.example", StringComparison.Ordinal));

        var found = new List<string>();
        foreach (var file in files)
        {
            var path = Path.Combine(root, file);
            var info = new FileInfo(path);
            if (!info.Exists || info.Length > 5_000_000)
            {
                continue;
            }

            var text = File.ReadAllText(path);
            foreach (var (name, pattern) in new[] { ("a Google API key", GoogleKey()), ("a Google API key", GoogleNewKey()), ("a fal.ai key", FalKey()), ("a secret", OtherSecret()) })
            {
                if (pattern.IsMatch(text))
                {
                    // The file is named; what was found in it is not repeated.
                    found.Add($"{file}: looks like {name}");
                }
            }
        }

        Assert.True(found.Count == 0, "Remove these and revoke the keys:\n" + string.Join('\n', found));
    }

    [Fact]
    public void The_shapes_looked_for_are_those_of_real_keys()
    {
        static bool IsKey(string text) => GoogleKey().IsMatch(text) || GoogleNewKey().IsMatch(text) || FalKey().IsMatch(text) || OtherSecret().IsMatch(text);

        // Put together here, so that this file holds nothing of the shapes it looks for.
        var filler = string.Concat(Enumerable.Repeat("0123456789abcdef", 4));
        Assert.True(IsKey("AIza" + "SyA-" + filler[..31]));
        Assert.True(IsKey("\"ApiKey\": \"AQ" + ".Ab8-" + filler + "\""));
        Assert.True(IsKey("Authorization: Key 0a1b2c3d-1111-2222-3333-444455556666" + ":" + filler[..32]));
        Assert.False(IsKey("Gemini__ApiKey="));
        Assert.False(IsKey(StubHttp.Key));
        Assert.False(IsKey("request 764cabcf-b745-4b3e-ae38-1200304cf45b"));
        Assert.False(IsKey("FAQ.Questions_and_answers_about_the_application_and_its_wardrobe"));
    }

    // ---- helpers ----------------------------------------------------------------------------------------------------

    private static IHost Host(Dictionary<string, string?> settings, Action<IServiceCollection>? more = null)
    {
        var builder = Microsoft.Extensions.Hosting.Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = "Testing" });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "test-only-signing-key-0123456789-0123456789",
            ["Providers:ImageStorage"] = "Fake",
            ["Providers:Weather"] = "Fake",
            ["Providers:LocationSearch"] = "Fake",
        });
        builder.Configuration.AddInMemoryCollection(settings);
        builder.Services.AddFitItInfrastructure(builder.Configuration, builder.Environment);
        more?.Invoke(builder.Services);
        return builder.Build();
    }

    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "backend")) && Directory.Exists(Path.Combine(directory.FullName, "mobile")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException("The repository root was not found above the test assembly.");
    }

    /// <summary>Every file git tracks or would add (ignored files are left out); without git, every file outside build and dependency folders.</summary>
    private static List<string> Files(string root)
    {
        try
        {
            using var git = Process.Start(new ProcessStartInfo("git", "ls-files -z --cached --others --exclude-standard")
            {
                WorkingDirectory = root,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            })!;
            var output = git.StandardOutput.ReadToEnd();
            git.WaitForExit();
            if (git.ExitCode == 0)
            {
                return [.. output.Split('\0', StringSplitOptions.RemoveEmptyEntries)];
            }
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // No git on this machine: the folders are walked instead.
        }

        string[] skipped = [".git", "bin", "obj", "node_modules", ".expo", ".omc", "TestResults", "Pods"];
        return [.. Directory.EnumerateFiles(root, "*", new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint })
            .Select(file => Path.GetRelativePath(root, file))
            .Where(file => !file.Split(Path.DirectorySeparatorChar).Any(part => skipped.Contains(part)))];
    }

    private sealed class CapturingLogs : ILoggerProvider
    {
        private readonly List<string> _lines = [];

        public IReadOnlyList<string> Lines
        {
            get
            {
                lock (_lines)
                {
                    return [.. _lines];
                }
            }
        }

        public ILogger CreateLogger(string categoryName) => new Writer(this, categoryName);

        public void Dispose()
        {
        }

        private sealed class Writer(CapturingLogs owner, string category) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                var line = $"{category} {formatter(state, exception)} {state} {exception}";
                if (state is IEnumerable<KeyValuePair<string, object?>> values)
                {
                    line += " " + string.Join(' ', values.Select(pair => $"{pair.Key}={pair.Value}"));
                }

                lock (owner._lines)
                {
                    owner._lines.Add(line);
                }
            }
        }
    }
}
