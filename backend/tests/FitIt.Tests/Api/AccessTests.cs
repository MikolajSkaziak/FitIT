using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Api;

/// <summary>
/// Who may do what (plan 5.6). The tests read the list of routes from the OpenAPI document, not from a list of their own, so a
/// route added tomorrow is in the net as soon as it exists: it either takes a person's id and answers a stranger with "not
/// found", or it is on the short list of public routes, or these tests fail until somebody says which.
/// </summary>
[Collection(ApiTests.Name)]
public sealed class AccessTests(ApiFactory factory)
{
    /// <summary>Routes that need no signed in person. Everything else must refuse a request without a token.</summary>
    private static readonly HashSet<string> Public =
    [
        "GET /health",
        "GET /api/avatars",
        "GET /api/dictionaries",
        "GET /api/starter-pieces",
        "GET /api/locations",
        "POST /api/auth/email-check",
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/refresh",
        "POST /api/auth/password-reset/request",
        "POST /api/auth/password-reset/confirm",
    ];

    [Fact]
    public async Task Every_route_but_the_public_ones_turns_away_a_request_without_a_token_and_one_with_a_forged_token()
    {
        var routes = await RoutesAsync();
        var client = factory.CreateClient();
        var forged = factory.CreateClient();
        forged.DefaultRequestHeaders.Authorization = new("Bearer", "eyJhbGciOiJub25lIn0.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.");
        var (_, auth) = await factory.SignedInAsync();
        var wrongKey = factory.CreateClient();
        wrongKey.DefaultRequestHeaders.Authorization = new("Bearer", ForgedToken(auth.User.Id));

        var closed = routes.Where(route => !Public.Contains($"{route.Method} {route.Path}")).ToList();

        Assert.NotEmpty(closed);
        Assert.Contains(closed, route => route.Path == "/api/me");
        foreach (var route in closed)
        {
            foreach (var caller in new[] { client, forged, wrongKey })
            {
                var response = await caller.SendAsync(Request(route, Guid.NewGuid()));
                Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{route.Method} {route.Path} answered {(int)response.StatusCode} to a caller without a valid token.");
            }
        }

        // The public list holds only routes that exist: a route that was renamed must not stay public by its old name.
        Assert.All(Public, entry => Assert.Contains(routes, route => $"{route.Method} {route.Path}" == entry || entry == "GET /health"));
    }

    [Fact]
    public async Task Every_route_that_takes_an_id_answers_a_stranger_with_not_found_and_changes_nothing()
    {
        var (owner, ownerAuth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        factory.Visualizer.Reset();
        var outfit = (await owner.SuggestedAsync()).Outfits[0];
        var visualization = await OrderAsync(owner, outfit.Id);
        var photo = await owner.AddExtraPhotoAsync(factory.Storage, wardrobe[0].Id);
        var planned = await owner.PlannedAsync(factory.DayIn(), outfit.Id);
        var (stranger, strangerAuth) = await factory.SignedInWithConsentAsync();
        var theirs = new Dictionary<string, Guid>
        {
            ["/api/clothes/{id}"] = wardrobe[0].Id,
            ["/api/clothes/{id}/reprocess"] = wardrobe[0].Id,
            ["/api/clothes/{id}/photos/uploads"] = wardrobe[0].Id,
            ["/api/clothes/{id}/photos"] = wardrobe[0].Id,
            ["/api/clothes/{id}/photos/{photoId}"] = wardrobe[0].Id,
            ["/api/outfits/{id}"] = outfit.Id,
            ["/api/outfits/{id}/visualizations"] = outfit.Id,
            ["/api/outfits/{id}/days"] = outfit.Id,
            ["/api/calendar/{id}"] = planned.Id,
            ["/api/visualizations/{id}"] = visualization.Id,
            ["/api/visualizations/{id}/reports"] = visualization.Id,
        };

        var withIds = (await RoutesAsync()).Where(route => route.Path.Contains('{', StringComparison.Ordinal)).ToList();

        // Every route with an id in it is one of those this test knows how to aim at somebody else's resource.
        Assert.All(withIds, route => Assert.True(theirs.ContainsKey(route.Path), $"{route.Method} {route.Path} takes an id and has no test that a stranger gets 'not found'. Add it to AccessTests."));
        Assert.Equal(theirs.Keys.Order(), withIds.Select(route => route.Path).Distinct().Order());

        // Deletions last: if one worked, the others would have nothing to find.
        foreach (var route in withIds.OrderBy(route => route.Method == "DELETE"))
        {
            var response = await stranger.SendAsync(Request(route, theirs[route.Path], photo.Id));
            Assert.True(response.StatusCode == HttpStatusCode.NotFound, $"{route.Method} {route.Path} answered a stranger {(int)response.StatusCode}.");
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        // ...and the same for ids that do not exist at all: nothing tells the two apart.
        foreach (var route in withIds)
        {
            var response = await stranger.SendAsync(Request(route, Guid.NewGuid()));
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        // The owner has everything exactly as it was: not deleted, not changed, not re-queued, nothing ordered or counted for the stranger.
        var garment = await (await owner.GetAsync($"/api/clothes/{wardrobe[0].Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal((wardrobe[0].Status, wardrobe[0].InLaundry, wardrobe[0].RarelyWorn), (garment.Status, garment.InLaundry, garment.RarelyWorn));
        Assert.Equal([photo.Id], garment.Photos.Select(found => found.Id));
        Assert.True(factory.Storage.Contains(photo.ImageKey));
        var kept = await (await owner.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>();
        Assert.Equal((outfit.Rating, outfit.IsSaved, outfit.WornOn), (kept.Rating, kept.IsSaved, kept.WornOn));
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/visualizations/{visualization.Id}")).StatusCode);
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.OutfitId == outfit.Id)));
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.UserId == strangerAuth.User.Id)));
        Assert.Equal(0, (await (await stranger.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Visualizations.Used);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.VisualizationReports.CountAsync(report => report.VisualizationId == visualization.Id)));
        Assert.Equal([(planned.Id, false)], (await (await owner.GetAsync($"/api/outfits/{outfit.Id}/days")).ReadAsync<List<OutfitDayResponse>>()).Select(day => (day.Id, day.Worn)));
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(entry => entry.UserId == strangerAuth.User.Id)));
        Assert.Equal(ownerAuth.User.Id, (await (await owner.GetAsync("/api/me")).ReadAsync<UserResponse>()).Id);
    }

    [Fact]
    public async Task Lists_show_a_person_only_what_is_theirs()
    {
        var (owner, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await owner.SuggestedAsync()).Outfits[0];
        var (stranger, _) = await factory.SignedInWithConsentAsync();

        Assert.Empty(await (await stranger.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>());
        Assert.Empty(await (await stranger.GetAsync($"/api/clothes?ids={string.Join(',', wardrobe.Select(garment => garment.Id))}")).ReadAsync<List<ClothingResponse>>());
        Assert.Empty(await (await stranger.GetAsync("/api/clothes?forgotten=true")).ReadAsync<List<ClothingResponse>>());
        Assert.Empty(await (await stranger.GetAsync("/api/outfits")).ReadAsync<List<OutfitResponse>>());
        Assert.Empty(await (await stranger.GetAsync("/api/outfits?saved=true")).ReadAsync<List<OutfitResponse>>());
        await owner.PlannedAsync(factory.DayIn().AddDays(1), outfit.Id);
        Assert.Empty((await stranger.CalendarAsync(factory.DayIn().AddDays(-30), factory.DayIn().AddDays(31))).Days);
        // Another person's outfit cannot be put on one's own calendar.
        var borrowed = await stranger.PlanAsync(factory.DayIn(), outfit.Id);
        Assert.Equal(HttpStatusCode.NotFound, borrowed.StatusCode);
        Assert.Equal("not_found", await borrowed.ProblemCodeAsync());
        Assert.Equal(new WardrobeStatsResponse(0, 0, 0, 0, 0), await (await stranger.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>());
        Assert.Equal(0, (await (await stranger.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.NotNull(outfit);
    }

    [Fact]
    public async Task A_garment_or_a_photo_of_somebody_else_cannot_be_used_in_ones_own_requests()
    {
        var (owner, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var photo = await owner.UploadPhotoAsync(factory.Storage);
        var (stranger, _) = await factory.SignedInWithConsentAsync();

        // Another person's garment as the base of proposals, and another person's upload key as one's own garment.
        var proposals = await stranger.SuggestAsync(baseItemId: wardrobe[0].Id);
        var adding = await stranger.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = photo });

        Assert.Equal(HttpStatusCode.BadRequest, proposals.StatusCode);
        Assert.Equal("base_item_invalid", await proposals.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.BadRequest, adding.StatusCode);
        Assert.Equal("key_invalid", await adding.ProblemCodeAsync());
    }

    [Fact]
    public async Task A_visualization_cannot_be_started_through_the_wrong_header_or_a_wrong_method()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        // Only POST orders a picture; the others are refused by the router before anything is looked up.
        foreach (var method in new[] { HttpMethod.Get, HttpMethod.Put, HttpMethod.Delete, HttpMethod.Patch })
        {
            var response = await client.SendAsync(new HttpRequestMessage(method, $"/api/outfits/{outfit.Id}/visualizations"));
            Assert.True(response.StatusCode is HttpStatusCode.MethodNotAllowed or HttpStatusCode.NotFound, $"{method} answered {(int)response.StatusCode}.");
        }

        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.OutfitId == outfit.Id)));
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private sealed record Route(string Method, string Path);

    private async Task<List<Route>> RoutesAsync()
    {
        var document = await factory.CreateClient().GetFromJsonAsync<JsonObject>("/openapi/v1.json");
        return
        [
            .. document!["paths"]!.AsObject().SelectMany(path => path.Value!.AsObject().Select(operation => new Route(operation.Key.ToUpperInvariant(), path.Key))),
        ];
    }

    private static HttpRequestMessage Request(Route route, Guid id, Guid? photoId = null)
    {
        var path = route.Path.Replace("{id}", id.ToString(), StringComparison.Ordinal).Replace("{photoId}", (photoId ?? Guid.NewGuid()).ToString(), StringComparison.Ordinal);
        var request = new HttpRequestMessage(new HttpMethod(route.Method), path);
        if (route.Method is "POST" or "PATCH" or "PUT" or "DELETE")
        {
            // Bodies that would be valid if the resource were the caller's, so that "not found" is the answer to the id and not to the body.
            request.Content = JsonContent.Create(route.Path switch
            {
                "/api/clothes/{id}" when route.Method == "PATCH" => new JsonObject { ["inLaundry"] = true },
                "/api/outfits/{id}" when route.Method == "PATCH" => new JsonObject { ["saved"] = true, ["rating"] = "dislike", ["worn"] = true },
                "/api/clothes/{id}/photos" => new JsonObject { ["key"] = $"u/{Guid.NewGuid():N}/extra/{Guid.NewGuid():N}.jpg" },
                "/api/calendar/{id}" => new JsonObject { ["worn"] = true },
                "/api/me" => new JsonObject { ["password"] = TestApi.Password },
                "/api/visualizations/{id}/reports" => new JsonObject { ["reason"] = "inappropriate" },
                _ => new JsonObject(),
            });
        }

        if (route.Path.EndsWith("/visualizations", StringComparison.Ordinal))
        {
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        }

        return request;
    }

    private static async Task<VisualizationResponse> OrderAsync(HttpClient client, Guid outfit)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfit}/visualizations");
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        return await response.ReadAsync<VisualizationResponse>();
    }

    /// <summary>A token that looks right (the claims, the issuer, the audience, the algorithm) and is signed with a key that is not ours.</summary>
    private static string ForgedToken(Guid userId)
    {
        var handler = new Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler();
        return handler.CreateToken(new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Issuer = "fitit",
            Audience = "fitit-app",
            Subject = new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim("sub", userId.ToString())]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes("a-different-signing-key-0123456789-0123456789")),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256),
        });
    }
}
