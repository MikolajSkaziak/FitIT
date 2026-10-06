using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;

namespace FitIt.Tests.Support;

/// <summary>Small helpers so that a test reads as the scenario, not as HTTP plumbing.</summary>
internal static class TestApi
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
    };

    public static readonly Guid FemaleAvatar = AvatarCatalog.All.First(a => a.Gender == Gender.Female).Id;
    public static readonly Guid MaleAvatar = AvatarCatalog.All.First(a => a.Gender == Gender.Male).Id;

    public const string Password = "tajnehaslo1";

    public static string NewEmail() => $"test-{Guid.NewGuid():N}@example.com";

    /// <summary>A valid registration body as loose JSON, so a test can remove or break one member.</summary>
    public static JsonObject RegistrationBody(string? email = null) => new()
    {
        ["email"] = email ?? NewEmail(),
        ["password"] = Password,
        ["displayName"] = "Ola",
        ["birthDate"] = "1999-03-14",
        ["gender"] = "female",
        ["avatarId"] = FemaleAvatar.ToString(),
        ["styles"] = new JsonArray("casual", "smart"),
        ["thermalPreference"] = "normal",
        ["location"] = new JsonObject { ["source"] = "device", ["name"] = "Gliwice", ["lat"] = 50.2945, ["lon"] = 18.6714 },
    };

    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, JsonNode body) =>
        client.PostAsync(url, JsonContent.Create(body));

    public static Task<HttpResponseMessage> PatchJsonAsync(this HttpClient client, string url, JsonNode body) =>
        client.PatchAsync(url, JsonContent.Create(body));

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        var value = await response.Content.ReadFromJsonAsync<T>(Json);
        return value ?? throw new InvalidOperationException("The response body was empty.");
    }

    /// <summary>Reads a ProblemDetails body and returns its machine code.</summary>
    public static async Task<string?> ProblemCodeAsync(this HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonObject>();
        return problem?["code"]?.GetValue<string>();
    }

    public static async Task<AuthResponse> RegisterAsync(this HttpClient client, string? email = null, Action<JsonObject>? change = null)
    {
        var body = RegistrationBody(email);
        change?.Invoke(body);
        var response = await client.PostJsonAsync("/api/auth/register", body);
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAsync<AuthResponse>();
    }

    /// <summary>A client that sends the given access token with every request.</summary>
    public static HttpClient Authorized(this ApiFactory factory, string accessToken)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    /// <summary>Registers a new person and returns a client signed in as them.</summary>
    public static async Task<(HttpClient Client, AuthResponse Auth)> SignedInAsync(this ApiFactory factory, Action<JsonObject>? change = null)
    {
        var auth = await factory.CreateClient().RegisterAsync(change: change);
        return (factory.Authorized(auth.AccessToken), auth);
    }
}
