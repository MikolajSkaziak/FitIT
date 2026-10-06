using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FitIt.Tests.Api;

[Collection(ApiTests.Name)]
public sealed class FoundationTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Health_answers_ok_when_the_database_is_reachable()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", (await response.ReadAsync<HealthResponse>()).Status);
    }

    [Fact]
    public async Task The_OpenAPI_document_is_served_and_describes_the_account_routes_with_enum_codes()
    {
        var document = await (await _client.GetAsync("/openapi/v1.json")).ReadAsync<JsonObject>();

        var paths = document["paths"]!.AsObject();
        Assert.Contains("/api/auth/register", paths.Select(p => p.Key));
        Assert.Contains("/api/me", paths.Select(p => p.Key));
        var thermal = document["components"]!["schemas"]!["ThermalPreference"]!["enum"]!.AsArray().Select(v => v!.GetValue<string>());
        Assert.Equal(["runs_cold", "normal", "runs_warm"], thermal);
    }

    [Fact]
    public async Task Numbers_in_the_contract_are_numbers_and_a_quoted_number_is_refused()
    {
        var document = await (await _client.GetAsync("/openapi/v1.json")).ReadAsync<JsonObject>();
        var schemas = document["components"]!["schemas"]!;
        Assert.Equal("integer", schemas["TokenResponse"]!["properties"]!["expiresIn"]!["type"]!.GetValue<string>());
        Assert.Equal("number", schemas["LocationResponse"]!["properties"]!["lat"]!["type"]!.GetValue<string>());

        var body = TestApi.RegistrationBody();
        body["location"]!["lat"] = "50.3";
        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("bad_request", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task A_malformed_body_is_a_problem_document_not_a_stack_trace()
    {
        var response = await _client.PostAsync("/api/auth/login", new StringContent("{ not json", System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("bad_request", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task An_unknown_route_is_a_problem_document_with_a_code()
    {
        var response = await _client.GetAsync("/api/nothing-here");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("not_found", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Sign_in_routes_are_limited_per_minute()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimits:AuthPerMinute", "3"));
        var client = limited.CreateClient(new WebApplicationFactoryClientOptions());
        var body = new JsonObject { ["email"] = TestApi.NewEmail(), ["password"] = "nie-to-haslo" };

        var statuses = new List<HttpStatusCode>();
        HttpResponseMessage? last = null;
        for (var i = 0; i < 4; i++)
        {
            last = await client.PostJsonAsync("/api/auth/login", body);
            statuses.Add(last.StatusCode);
        }

        Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], statuses);
        Assert.Equal("rate_limited", await last!.ProblemCodeAsync());
    }
}
