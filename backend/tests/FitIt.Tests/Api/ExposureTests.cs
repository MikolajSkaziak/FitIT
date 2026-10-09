using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Api;

/// <summary>What the API shows to the outside world: who a request comes from behind the reverse proxy, and what is documented in public.</summary>
[Collection(ApiTests.Name)]
public sealed class ExposureTests(ApiFactory factory)
{
    private const int PerMinute = 3;

    private const string PrivatePeer = "10.1.2.3";
    private const string PublicPeer = "203.0.113.99";

    // ---- behind the reverse proxy ----------------------------------------------------------------------------------

    [Fact]
    public async Task Behind_a_trusted_proxy_every_client_has_a_rate_limit_of_its_own()
    {
        using var host = Limited();
        var proxy = host.CreateClient();

        var first = await StatusesAsync(proxy, PrivatePeer, forwardedFor: _ => "198.51.100.1", count: PerMinute + 1);
        var second = await StatusesAsync(proxy, PrivatePeer, forwardedFor: _ => "198.51.100.2", count: PerMinute + 1);

        // The proxy sits at one address. Each of the people behind it gets their own bucket, and each runs out of it.
        Assert.Equal([.. Enumerable.Repeat(HttpStatusCode.OK, PerMinute), HttpStatusCode.TooManyRequests], first);
        Assert.Equal([.. Enumerable.Repeat(HttpStatusCode.OK, PerMinute), HttpStatusCode.TooManyRequests], second);
    }

    [Fact]
    public async Task Without_a_trusted_proxy_the_forwarded_address_is_not_believed_and_changing_it_does_not_escape_the_limit()
    {
        using var host = Limited();
        var attacker = host.CreateClient();

        // Every request claims to be somebody else. A peer that is no proxy of ours gets one bucket whatever it says.
        var statuses = await StatusesAsync(attacker, PublicPeer, forwardedFor: index => $"198.51.100.{index + 1}", count: PerMinute + 2);

        Assert.Equal([.. Enumerable.Repeat(HttpStatusCode.OK, PerMinute), HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests], statuses);
        // And a quiet, honest neighbour at another address is not affected.
        Assert.Equal(HttpStatusCode.OK, (await StatusesAsync(attacker, "203.0.113.7", forwardedFor: _ => null, count: 1))[0]);
    }

    [Fact]
    public async Task The_trusted_networks_come_from_configuration_and_replace_the_defaults()
    {
        using var host = Limited(builder => builder.UseSetting("Proxy:TrustedNetworks:0", "198.51.100.0/24"));
        var client = host.CreateClient();

        // The private address is no longer a proxy: its claims are ignored and everything lands in one bucket.
        var untrusted = await StatusesAsync(client, PrivatePeer, forwardedFor: index => $"192.0.2.{index + 1}", count: PerMinute + 1);
        Assert.Equal(HttpStatusCode.TooManyRequests, untrusted[^1]);

        // The configured network is: its clients are told apart.
        var trusted = await StatusesAsync(client, "198.51.100.7", forwardedFor: _ => "192.0.2.200", count: PerMinute + 1);
        Assert.Equal(HttpStatusCode.TooManyRequests, trusted[^1]);
        Assert.Equal(HttpStatusCode.OK, (await StatusesAsync(client, "198.51.100.7", forwardedFor: _ => "192.0.2.201", count: 1))[0]);
    }

    [Fact]
    public async Task The_scheme_the_proxy_reports_is_used_in_the_links_the_api_builds_but_only_from_a_trusted_proxy()
    {
        using var host = Limited();
        var client = host.CreateClient();

        async Task<string> LinkFromAsync(string peer)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/avatars");
            request.Headers.Add("X-Test-Peer", peer);
            request.Headers.Add("X-Forwarded-For", "198.51.100.1");
            request.Headers.Add("X-Forwarded-Proto", "https");
            var avatars = await (await client.SendAsync(request)).ReadAsync<List<AvatarResponse>>();
            return avatars[0].ImageUrl;
        }

        Assert.StartsWith("https://", await LinkFromAsync(PrivatePeer), StringComparison.Ordinal);
        Assert.StartsWith("http://", await LinkFromAsync(PublicPeer), StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_address_that_is_not_a_network_stops_the_application_from_starting()
    {
        using var host = factory.WithWebHostBuilder(builder => builder.UseSetting("Proxy:TrustedNetworks:0", "not-a-network"));

        await Task.Yield();
        Assert.Throws<FormatException>(() => host.CreateClient());
    }

    // ---- the description of the API --------------------------------------------------------------------------------

    [Theory]
    [InlineData("Testing", HttpStatusCode.OK)]
    [InlineData("Development", HttpStatusCode.OK)]
    [InlineData("Production", HttpStatusCode.NotFound)]
    public async Task The_openapi_document_and_the_test_page_are_not_served_in_production(string environment, HttpStatusCode expected)
    {
        using var host = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            // A real Production host refuses fakes; this one only checks what it serves.
            builder.UseSetting("Providers:AllowFakesInProduction", "true");
        });
        var client = host.CreateClient();

        Assert.Equal(expected, (await client.GetAsync("/openapi/v1.json")).StatusCode);
        Assert.Equal(expected, (await client.GetAsync("/scalar/v1")).StatusCode);
        // The rest of the API is there whatever the environment.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    /// <summary>A host with a small limit, in which a test says which address a request comes from with <c>X-Test-Peer</c>.</summary>
    private WebApplicationFactory<Program> Limited(Action<IWebHostBuilder>? more = null) => factory.WithWebHostBuilder(builder =>
    {
        builder.UseSetting("RateLimits:AuthPerMinute", PerMinute.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter, PeerAddressFilter>());
        more?.Invoke(builder);
    });

    private static async Task<List<HttpStatusCode>> StatusesAsync(HttpClient client, string peer, Func<int, string?> forwardedFor, int count)
    {
        var statuses = new List<HttpStatusCode>();
        for (var index = 0; index < count; index++)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/email-check") { Content = JsonContent.Create(new JsonObject { ["email"] = "ktos@example.com" }) };
            request.Headers.Add("X-Test-Peer", peer);
            if (forwardedFor(index) is { } address)
            {
                request.Headers.Add("X-Forwarded-For", address);
            }

            statuses.Add((await client.SendAsync(request)).StatusCode);
        }

        return statuses;
    }
}

/// <summary>The test server has no network connection to take the caller's address from; this says it, per request, before anything else looks at it.</summary>
internal sealed class PeerAddressFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (context, following) =>
        {
            if (context.Request.Headers.TryGetValue("X-Test-Peer", out var peer) && IPAddress.TryParse(peer, out var address))
            {
                context.Connection.RemoteIpAddress = address;
            }

            await following();
        });
        next(app);
    };
}
