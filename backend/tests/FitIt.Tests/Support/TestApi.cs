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

    /// <summary>
    /// Registers a new person who has agreed to their photos being processed by AI services (the app asks for that in context after
    /// sign-up, so the helper plays that step) and returns a client signed in as them.
    /// </summary>
    public static async Task<(HttpClient Client, AuthResponse Auth)> SignedInAsync(this ApiFactory factory, Action<JsonObject>? change = null)
    {
        var (client, auth) = await factory.SignedInWithoutConsentAsync(change);
        await client.GiveConsentAsync();
        return (client, auth);
    }

    /// <summary>The same as <see cref="SignedInAsync"/>, spelled out.</summary>
    public static Task<(HttpClient Client, AuthResponse Auth)> SignedInWithConsentAsync(this ApiFactory factory) => factory.SignedInAsync();

    /// <summary>A new person exactly as registration leaves them: no consent to AI processing yet.</summary>
    public static async Task<(HttpClient Client, AuthResponse Auth)> SignedInWithoutConsentAsync(this ApiFactory factory, Action<JsonObject>? change = null)
    {
        var auth = await factory.CreateClient().RegisterAsync(change: change);
        return (factory.Authorized(auth.AccessToken), auth);
    }

    public static async Task GiveConsentAsync(this HttpClient client, bool consent = true)
    {
        var response = await client.PatchJsonAsync("/api/me", new JsonObject { ["aiConsent"] = consent });
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>A fresh access token for somebody whose first one has aged out because a test moved the clock.</summary>
    public static async Task<HttpClient> SignInAgainAsync(this ApiFactory factory, AuthResponse auth)
    {
        var response = await factory.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = auth.User.Email, ["password"] = Password });
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return factory.Authorized((await response.ReadAsync<AuthResponse>()).AccessToken);
    }

    /// <summary>The smallest thing that passes for a JPEG: the three magic bytes and some padding.</summary>
    public static byte[] Jpeg(int size = 2048)
    {
        var bytes = new byte[size];
        bytes[0] = 0xFF;
        bytes[1] = 0xD8;
        bytes[2] = 0xFF;
        bytes[3] = 0xE0;
        return bytes;
    }

    /// <summary>Asks for an upload address and plays the phone: puts the photo into storage under the issued key.</summary>
    public static async Task<string> UploadPhotoAsync(this HttpClient client, FitIt.Infrastructure.Storage.InMemoryImageStorage storage, byte[]? content = null)
    {
        var response = await client.PostAsync("/api/uploads", null);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var ticket = await response.ReadAsync<UploadResponse>();
        storage.Put(ticket.Key, content ?? Jpeg());
        return ticket.Key;
    }

    /// <summary>Uploads a photo and turns it into a garment that waits for the processing job.</summary>
    public static async Task<ClothingResponse> AddGarmentAsync(this HttpClient client, FitIt.Infrastructure.Storage.InMemoryImageStorage storage)
    {
        var key = await client.UploadPhotoAsync(storage);
        var response = await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key });
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAsync<ClothingResponse>();
    }

    /// <summary>Asks for an address for one more photo of a garment and plays the phone: puts a real JPEG under the issued key.</summary>
    public static async Task<string> UploadExtraPhotoAsync(this HttpClient client, FitIt.Infrastructure.Storage.InMemoryImageStorage storage, Guid garmentId, byte[]? content = null)
    {
        var response = await client.PostAsync($"/api/clothes/{garmentId}/photos/uploads", null);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var ticket = await response.ReadAsync<UploadResponse>();
        storage.Put(ticket.Key, content ?? Pictures.Photo(60, 80));
        return ticket.Key;
    }

    /// <summary>Uploads one more photo of a garment and attaches it.</summary>
    public static async Task<ClothingPhotoResponse> AddExtraPhotoAsync(this HttpClient client, FitIt.Infrastructure.Storage.InMemoryImageStorage storage, Guid garmentId, byte[]? content = null)
    {
        var key = await client.UploadExtraPhotoAsync(storage, garmentId, content);
        var response = await client.PostJsonAsync($"/api/clothes/{garmentId}/photos", new JsonObject { ["key"] = key });
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAsync<ClothingPhotoResponse>();
    }

    /// <summary>Adds a garment and runs its processing job, so it is ready (unless the test scripted the AI otherwise).</summary>
    public static async Task<ClothingResponse> AddProcessedGarmentAsync(this ApiFactory factory, HttpClient client)
    {
        var added = await client.AddGarmentAsync(factory.Storage);
        await factory.ProcessAsync(added.Id);
        return await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>();
    }
}
