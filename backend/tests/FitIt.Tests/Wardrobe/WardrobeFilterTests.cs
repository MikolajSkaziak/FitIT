using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Weather;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;

namespace FitIt.Tests.Wardrobe;

/// <summary>The query parameters of <c>GET /api/clothes</c> that the filter sheet of the app sends.</summary>
[Collection(ApiTests.Name)]
public sealed class WardrobeFilterTests(ApiFactory factory)
{
    private static readonly GarmentTags Tee = new(
        Category.Top, Subcategory.TShirt, "White tee", [Color.White], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual], [Season.Summer]);

    private static readonly GarmentTags Jeans = new(
        Category.Bottom, Subcategory.Jeans, "Blue jeans", [Color.Blue, Color.Black], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual], [Season.Spring, Season.Fall]);

    private static readonly GarmentTags Chinos = new(
        Category.Bottom, Subcategory.Chinos, "Beige chinos", [Color.Beige], Pattern.Plain, Material.Cotton, 3, 2, false, [StyleTag.Smart], [Season.Spring, Season.Summer]);

    private static readonly GarmentTags Coat = new(
        Category.Outerwear, Subcategory.Coat, "Wool coat", [Color.Navy], Pattern.Plain, Material.Wool, 4, 5, false, [StyleTag.Elegant], [Season.Winter]);

    [Fact]
    public async Task Types_colors_seasons_and_materials_each_take_a_list_and_match_any_of_it()
    {
        var (client, _, garments) = await WardrobeAsync();

        Assert.Equal(Ids(garments, "tee"), await Find(client, "?types=t_shirt"));
        Assert.Equal(Ids(garments, "jeans", "chinos"), await Find(client, "?types=jeans,chinos"));
        Assert.Empty(await Find(client, "?types=sandals"));

        Assert.Equal(Ids(garments, "jeans"), await Find(client, "?colors=black"));
        Assert.Equal(Ids(garments, "tee", "jeans"), await Find(client, "?colors=white,blue"));
        Assert.Empty(await Find(client, "?colors=red"));

        Assert.Equal(Ids(garments, "chinos", "tee"), await Find(client, "?seasons=summer"));
        Assert.Equal(Ids(garments, "chinos", "coat", "jeans"), await Find(client, "?seasons=winter,spring"));
        Assert.Empty(await Find(client, "?seasons=fall&types=t_shirt"));

        Assert.Equal(Ids(garments, "chinos", "tee"), await Find(client, "?materials=cotton"));
        Assert.Equal(Ids(garments, "coat", "jeans"), await Find(client, "?materials=wool,denim"));
        Assert.Empty(await Find(client, "?materials=silk"));
    }

    [Fact]
    public async Task Filters_combine_with_and_while_the_values_of_one_filter_combine_with_or()
    {
        var (client, _, garments) = await WardrobeAsync();

        Assert.Equal(Ids(garments, "chinos", "tee"), await Find(client, "?materials=cotton&seasons=summer"));
        Assert.Equal(Ids(garments, "chinos"), await Find(client, "?materials=cotton&seasons=summer&group=pants"));
        Assert.Equal(Ids(garments, "chinos"), await Find(client, "?types=chinos,jeans&colors=beige,navy"));
        Assert.Empty(await Find(client, "?types=chinos&colors=blue"));
        Assert.Equal(Ids(garments, "jeans"), await Find(client, "?colors=blue&seasons=fall&q=jeans&category=bottom"));
        Assert.Empty(await Find(client, "?colors=blue&q=chinos"));
    }

    [Fact]
    public async Task Usage_means_being_part_of_one_of_my_saved_outfits()
    {
        var (client, auth, garments) = await WardrobeAsync();
        await SaveOutfitAsync(auth.User.Id, saved: true, garments["tee"], garments["jeans"]);
        await SaveOutfitAsync(auth.User.Id, saved: false, garments["chinos"]);

        Assert.Equal(Ids(garments, "jeans", "tee"), await Find(client, "?usage=used"));
        Assert.Equal(Ids(garments, "chinos", "coat"), await Find(client, "?usage=unused"));
        Assert.Equal(Ids(garments, "tee"), await Find(client, "?usage=used&types=t_shirt"));
        Assert.Empty(await Find(client, "?usage=unused&types=jeans"));
        Assert.Equal(4, (await Find(client, string.Empty)).Count);
    }

    [Fact]
    public async Task Somebody_elses_saved_outfits_never_make_my_garment_used()
    {
        var (client, _, garments) = await WardrobeAsync();
        var (_, stranger) = await factory.SignedInWithConsentAsync();
        // Not something the API allows, which is the point: even a stored outfit of another person that holds my garment must not count.
        await SaveOutfitAsync(stranger.User.Id, saved: true, garments["tee"]);

        Assert.Empty(await Find(client, "?usage=used"));
        Assert.Equal(4, (await Find(client, "?usage=unused")).Count);
    }

    [Theory]
    [InlineData("types=hats", "types_invalid")]
    [InlineData("colors=red,mauve", "colors_invalid")]
    [InlineData("seasons=autumn", "seasons_invalid")]
    [InlineData("materials=paper", "materials_invalid")]
    [InlineData("usage=sometimes", "usage_invalid")]
    [InlineData("group=hats", "group_invalid")]
    public async Task An_unknown_code_is_refused_with_a_code_of_its_own(string query, string code)
    {
        var (client, _) = await factory.SignedInWithConsentAsync();

        var response = await client.GetAsync("/api/clothes?" + query);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Empty_filter_values_and_the_old_parameters_keep_working()
    {
        var (client, _, garments) = await WardrobeAsync();

        Assert.Equal(4, (await Find(client, "?types=&colors=&seasons=&materials=")).Count);
        Assert.Equal(Ids(garments, "chinos", "jeans"), await Find(client, "?group=pants,jeans"));
        Assert.Equal(Ids(garments, "coat"), await Find(client, $"?ids={garments["coat"]}"));
    }

    [Fact]
    public async Task Seasons_are_given_by_the_tagger_or_the_person_and_follow_the_warmth_when_nobody_says()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        factory.Ai.TaggingReturns(Tee with { Seasons = null });
        var derived = await factory.AddProcessedGarmentAsync(client);
        factory.Ai.TaggingReturns(Coat);
        var given = await factory.AddProcessedGarmentAsync(client);

        Assert.Equal([Season.Spring, Season.Summer], derived.Seasons);
        Assert.Equal([Season.Winter], given.Seasons);

        var changed = await client.PatchJsonAsync($"/api/clothes/{derived.Id}", new JsonObject { ["seasons"] = new JsonArray("winter", "fall") });
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        Assert.Equal([Season.Fall, Season.Winter], (await changed.ReadAsync<ClothingResponse>()).Seasons);

        // Saying none goes back to what the warmth suggests; a warmth change alone leaves the seasons as they are.
        var cleared = await client.PatchJsonAsync($"/api/clothes/{derived.Id}", new JsonObject { ["seasons"] = new JsonArray() });
        Assert.Equal([Season.Spring, Season.Summer], (await cleared.ReadAsync<ClothingResponse>()).Seasons);
        var warmer = await client.PatchJsonAsync($"/api/clothes/{derived.Id}", new JsonObject { ["warmth"] = 5 });
        Assert.Equal([Season.Spring, Season.Summer], (await warmer.ReadAsync<ClothingResponse>()).Seasons);

        var twice = await client.PatchJsonAsync($"/api/clothes/{derived.Id}", new JsonObject { ["seasons"] = new JsonArray("fall", "fall") });
        Assert.Equal(HttpStatusCode.BadRequest, twice.StatusCode);
        Assert.Equal("seasons_invalid", await twice.ProblemCodeAsync());
        var unknown = await client.PatchJsonAsync($"/api/clothes/{derived.Id}", new JsonObject { ["seasons"] = new JsonArray("monsoon") });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    private static async Task<List<Guid>> Find(HttpClient client, string query)
    {
        var response = await client.GetAsync("/api/clothes" + query);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await response.ReadAsync<List<ClothingResponse>>()).Select(item => item.Id).Order()];
    }

    private static List<Guid> Ids(Dictionary<string, Guid> garments, params string[] names) => [.. names.Select(name => garments[name]).Order()];

    private async Task<(HttpClient Client, AuthResponse Auth, Dictionary<string, Guid> Garments)> WardrobeAsync()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var garments = new Dictionary<string, Guid>();
        foreach (var (name, tags) in new[] { ("tee", Tee), ("jeans", Jeans), ("chinos", Chinos), ("coat", Coat) })
        {
            factory.Ai.TaggingReturns(tags);
            garments[name] = (await factory.AddProcessedGarmentAsync(client)).Id;
        }

        return (client, auth, garments);
    }

    /// <summary>Stores an outfit straight into the database: the API only ever builds outfits from the owner's own garments.</summary>
    private Task<int> SaveOutfitAsync(Guid userId, bool saved, params Guid[] garmentIds) =>
        factory.WithDatabaseAsync(async db =>
        {
            var id = Guid.CreateVersion7();
            var outfit = new Outfit
            {
                Id = id,
                UserId = userId,
                RequestId = Guid.NewGuid(),
                Occasion = Occasion.Everyday,
                Weather = new WeatherSnapshot("Test", false, DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch, 10, 15, 0, 0, false, false, 12, TemperatureBand.Mild, Sky.Sun),
                Reasoning = "Test outfit.",
                CreatedAt = DateTimeOffset.UnixEpoch,
                Items = [.. garmentIds.Select(garment => new OutfitItem { OutfitId = id, ClothingItemId = garment, Slot = Category.Top })],
            };
            outfit.Save(saved);
            db.Outfits.Add(outfit);
            await db.SaveChangesAsync();
            return 0;
        });
}
