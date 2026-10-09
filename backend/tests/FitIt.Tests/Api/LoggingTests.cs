using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FitIt.Api.Contracts;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Api;

/// <summary>What the application writes to its log while people use it (plan 5.6, product spec 12): nothing that opens an account or a picture.</summary>
[Collection(ApiTests.Name)]
public sealed partial class LoggingTests(ApiFactory factory)
{
    private const string OldPassword = TestApi.Password;
    private const string NewPassword = "log-test-nowe-haslo-7";
    private const string GuessedPassword = "log-test-zle-haslo-9";

    [GeneratedRegex(@"(?<![0-9])[0-9]{6}(?![0-9])")]
    private static partial Regex SixDigits();

    [Fact]
    public async Task Passwords_tokens_codes_signed_addresses_and_addresses_of_people_never_reach_the_log()
    {
        var sink = new CapturingSink();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(sink)));
        var secrets = new List<string> { OldPassword, NewPassword, GuessedPassword };

        // Registration, login with a wrong and with the right password.
        var email = TestApi.NewEmail();
        var registered = await host.CreateClient().RegisterAsync(email);
        await host.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = email, ["password"] = GuessedPassword });
        var login = await (await host.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = email, ["password"] = OldPassword })).ReadAsync<AuthResponse>();
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", login.AccessToken);
        secrets.AddRange([registered.AccessToken, registered.RefreshToken, login.AccessToken, login.RefreshToken, email, registered.User.DisplayName]);

        // A wardrobe and an outfit with a picture: every response carries signed addresses.
        await client.GiveConsentAsync();
        factory.Ai.Reset();
        factory.Stylist.Reset();
        factory.Visualizer.Reset();
        var weather = factory.FreshWeather();
        (weather.Low, weather.High) = (Warm, Warm);
        var storage = host.Services.GetRequiredService<FitIt.Infrastructure.Storage.InMemoryImageStorage>();
        var addresses = new List<string>();
        foreach (var tags in Basics)
        {
            factory.Ai.TaggingReturns(tags);
            var added = await client.AddGarmentAsync(storage);
            await factory.ProcessAsync(added.Id, host.Services);
        }

        var clothes = await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();
        addresses.AddRange(clothes.Select(garment => garment.ImageUrl!));
        var upload = await (await client.PostAsync("/api/uploads", null)).ReadAsync<UploadResponse>();
        addresses.Add(upload.Url);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var order = await OrderAsync(client, outfit.Id);
        await factory.RunVisualizationAsync(order.Id, host.Services);
        var finished = await (await client.GetAsync($"/api/visualizations/{order.Id}")).ReadAsync<VisualizationResponse>();
        addresses.Add(finished.ImageUrl!);
        var seen = factory.Visualizer.Orders.Single();
        addresses.AddRange(seen.Garments.Select(garment => garment.Url.AbsoluteUri).Append(seen.Silhouette.Url.AbsoluteUri));

        // A provider that fails: what gets logged on the way must not carry the addresses it was given.
        factory.Visualizer.SubmitFails(3);
        foreach (var attempt in Enumerable.Range(0, 3))
        {
            var failing = await OrderAsync(client, outfit.Id);
            try
            {
                await factory.RunVisualizationAsync(failing.Id, host.Services);
            }
            catch (ProviderException)
            {
                // The worker would retry; this is the third and last.
            }

            _ = attempt;
        }

        // Forgetting the password: asking for a code, guessing, using the right one, then changing the password again.
        var mail = host.Services.GetRequiredService<FitIt.Infrastructure.Accounts.FakeEmailSender>();
        await host.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = email });
        var code = SixDigits().Match(mail.Sent.Last(message => message.To == email).Body).Value;
        secrets.Add(code);
        await host.CreateClient().PostJsonAsync("/api/auth/password-reset/confirm", new JsonObject { ["email"] = email, ["code"] = code == "111111" ? "222222" : "111111", ["newPassword"] = NewPassword });
        await host.CreateClient().PostJsonAsync("/api/auth/password-reset/confirm", new JsonObject { ["email"] = email, ["code"] = code, ["newPassword"] = NewPassword });
        var again = await (await host.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = email, ["password"] = NewPassword })).ReadAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new("Bearer", again.AccessToken);
        secrets.AddRange([again.AccessToken, again.RefreshToken]);
        await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = NewPassword, ["newPassword"] = OldPassword + "2", ["refreshToken"] = again.RefreshToken });
        secrets.Add(OldPassword + "2");

        // And the end of the account.
        await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = System.Net.Http.Json.JsonContent.Create(new { password = OldPassword + "2" }) });
        await host.Services.GetRequiredService<FitIt.Infrastructure.Jobs.RecordingBackgroundJobs>().RunPendingAsync();

        // What was written, with every property rendered the way a log viewer would show it.
        var written = sink.Lines;
        Assert.NotEmpty(written);
        Assert.Contains(written, line => line.Contains("responded", StringComparison.Ordinal));
        foreach (var secret in secrets.Where(secret => secret.Length > 0))
        {
            Assert.DoesNotContain(written, line => line.Contains(secret, StringComparison.Ordinal));
        }

        // A signed address is recognised by its host and by the key it names, and neither may be in the log.
        foreach (var address in addresses)
        {
            var uri = new Uri(address);
            Assert.DoesNotContain(written, line => line.Contains(address, StringComparison.Ordinal) || line.Contains(uri.PathAndQuery, StringComparison.Ordinal));
        }

        Assert.DoesNotContain(written, line => line.Contains("storage.test", StringComparison.Ordinal) || line.Contains("expires=", StringComparison.Ordinal));
        Assert.DoesNotContain(written, line => line.Contains("Bearer ", StringComparison.OrdinalIgnoreCase) || line.Contains("eyJ", StringComparison.Ordinal));
        // Where the person is does not belong in the log either.
        Assert.DoesNotContain(written, line => line.Contains("Gliwice", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task The_log_of_a_request_names_the_route_and_the_status_and_not_the_query_string()
    {
        var sink = new CapturingSink();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(sink)));
        var (client, _) = await SignedIn(host);
        var search = $"sekretna-fraza-{Guid.NewGuid():N}";

        await client.GetAsync($"/api/clothes?q={search}");
        await host.CreateClient().GetAsync($"/api/locations?query={search}");

        var requests = sink.Lines.Where(line => line.Contains("responded", StringComparison.Ordinal)).ToList();
        Assert.Contains(requests, line => line.Contains("/api/clothes", StringComparison.Ordinal));
        Assert.DoesNotContain(sink.Lines, line => line.Contains(search, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Nothing_is_logged_by_the_fake_mail_service_but_that_a_message_was_taken()
    {
        var sink = new CapturingSink();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(sink)));
        var (_, auth) = await SignedIn(host);

        await host.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = auth.User.Email });

        // The host is one of its own, with a mail service of its own.
        var message = Assert.Single(host.Services.GetRequiredService<FitIt.Infrastructure.Accounts.FakeEmailSender>().Sent);
        var mine = sink.Lines.Where(line => line.Contains("fake e-mail sender", StringComparison.Ordinal)).ToList();
        Assert.Single(mine);
        Assert.DoesNotContain(mine, line => line.Contains(auth.User.Email, StringComparison.Ordinal));
        Assert.DoesNotContain(sink.Lines, line => line.Contains(SixDigits().Match(message.Body).Value, StringComparison.Ordinal));
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private static async Task<(HttpClient Client, AuthResponse Auth)> SignedIn(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> host)
    {
        var auth = await host.CreateClient().RegisterAsync();
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private static async Task<VisualizationResponse> OrderAsync(HttpClient client, Guid outfit)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfit}/visualizations");
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        var response = await client.SendAsync(request);
        Assert.True(response.StatusCode is HttpStatusCode.Accepted or HttpStatusCode.OK, response.StatusCode.ToString());
        return await response.ReadAsync<VisualizationResponse>();
    }

    /// <summary>Keeps every event the application's logger writes, as the text a log viewer would show: the message, every property, the exception.</summary>
    private sealed class CapturingSink : ILogEventSink
    {
        private readonly List<string> _lines = [];
        private readonly Lock _gate = new();

        public IReadOnlyList<string> Lines
        {
            get
            {
                lock (_gate)
                {
                    return [.. _lines];
                }
            }
        }

        public void Emit(LogEvent logEvent)
        {
            var line = new StringBuilder(logEvent.RenderMessage(System.Globalization.CultureInfo.InvariantCulture));
            foreach (var (name, value) in logEvent.Properties)
            {
                line.Append(' ').Append(name).Append('=').Append(value);
            }

            if (logEvent.Exception is { } exception)
            {
                line.Append(' ').Append(exception);
            }

            lock (_gate)
            {
                _lines.Add(line.ToString());
            }
        }
    }
}
