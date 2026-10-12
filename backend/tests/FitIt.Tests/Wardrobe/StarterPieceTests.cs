using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;
using FitIt.Tests.Styling;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Wardrobe;

public sealed class StarterCatalogTests
{
    [Fact]
    public void Every_piece_has_valid_unique_tags_an_audience_and_neutral_names()
    {
        Assert.InRange(StarterCatalog.All.Count, 30, 40);
        Assert.Equal(StarterCatalog.All.Count, StarterCatalog.All.Select(piece => piece.Code).Distinct().Count());
        Assert.All(StarterCatalog.All, piece =>
        {
            Assert.Matches("^[a-z_]+$", piece.Code);
            Assert.Null(piece.Tags.Check());
            Assert.NotEmpty(piece.Tags.Styles);
            Assert.NotEmpty(piece.Tags.Seasons!);
            Assert.Equal($"/starter/{piece.Code}.png", piece.ImagePath);
            Assert.DoesNotContain("women", piece.Tags.Name, StringComparison.OrdinalIgnoreCase);
            Assert.True(Enum.IsDefined(piece.Audience));
        });
    }

    [Fact]
    public void Every_audience_has_pieces_and_the_women_get_a_proper_range_of_their_own()
    {
        Assert.All(Enum.GetValues<StarterAudience>(), audience => Assert.Contains(StarterCatalog.All, piece => piece.Audience == audience));
        var women = StarterCatalog.All.Where(piece => piece.Audience == StarterAudience.Women).Select(piece => piece.Tags.Subcategory).ToHashSet();

        Assert.Contains(Subcategory.Dress, women);
        Assert.Contains(Subcategory.Skirt, women);
        Assert.Contains(Subcategory.Blouse, women);
        Assert.Contains(Subcategory.Flats, women);
        Assert.Contains(Subcategory.Bag, women);
        Assert.InRange(StarterCatalog.All.Count(piece => piece.Audience == StarterAudience.Women), 12, 20);
    }

    [Theory]
    [InlineData(StarterAudience.Women)]
    [InlineData(StarterAudience.Men)]
    public void What_the_phone_shows_one_audience_still_dresses_a_person_in_every_temperature_band(StarterAudience audience)
    {
        // The phone's rule: a woman sees women's and everyone's pieces, a man sees men's and everyone's.
        var shown = StarterCatalog.All.Where(piece => piece.Audience == audience || piece.Audience == StarterAudience.Everyone).ToList();
        var wardrobe = shown.Select((piece, index) => new Garment(new Guid(index + 1, 0, 0, new byte[8]), piece.Tags)).ToList();

        foreach (var feels in new[] { Looks.Hot, Looks.Warm, Looks.Mild, Looks.Cold, Looks.Freezing })
        {
            var candidates = CandidateFilter.Select(wardrobe, Looks.Day(feels), Occasion.Everyday);
            Assert.True(candidates.IsComplete, $"{audience} at {feels}: missing {string.Join(", ", candidates.Missing.Concat(candidates.MissingEither))}");
            Assert.NotEmpty(RuleBasedStylist.Compose(candidates, Looks.Day(feels), new HashSet<(Guid, Guid)>(), new Random(1)));
        }
    }

    [Theory]
    [InlineData(Looks.Hot)]
    [InlineData(Looks.Warm)]
    [InlineData(Looks.Mild)]
    [InlineData(Looks.Cold)]
    [InlineData(Looks.Freezing)]
    public void The_pieces_together_dress_a_person_in_every_temperature_band(double feels)
    {
        var wardrobe = StarterCatalog.All.Select((piece, index) => new Garment(new Guid(index + 1, 0, 0, new byte[8]), piece.Tags)).ToList();

        var candidates = CandidateFilter.Select(wardrobe, Looks.Day(feels), Occasion.Everyday);

        Assert.True(candidates.IsComplete, $"missing {string.Join(", ", candidates.Missing.Concat(candidates.MissingEither))}");
        Assert.Empty(candidates.Relaxations);
        Assert.NotEmpty(RuleBasedStylist.Compose(candidates, Looks.Day(feels), new HashSet<(Guid, Guid)>(), new Random(1)));
    }
}

[Collection(ApiTests.Name)]
public sealed class StarterPieceTests(ApiFactory factory)
{
    private static JsonObject Codes(params string[] codes) => new() { ["codes"] = new JsonArray([.. codes.Select(code => (JsonNode)code)]) };

    private static async Task<List<ClothingResponse>> WardrobeOfAsync(HttpClient client) =>
        await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();

    [Fact]
    public async Task The_list_is_public_and_gives_each_piece_a_picture_that_exists()
    {
        var anonymous = factory.CreateClient();

        var response = await anonymous.GetAsync("/api/starter-pieces");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var pieces = await response.ReadAsync<List<StarterPieceResponse>>();
        Assert.Equal(StarterCatalog.All.Select(piece => piece.Code), pieces.Select(piece => piece.Code));
        foreach (var piece in pieces)
        {
            Assert.NotEmpty(piece.Colors);
            var expected = StarterCatalog.Find(piece.Code)!;
            Assert.Equal((expected.Audience, GarmentCatalog.GroupOf(expected.Tags.Subcategory)), (piece.Audience, piece.Group));
            var picture = await anonymous.GetAsync(piece.ImageUrl);
            Assert.Equal(HttpStatusCode.OK, picture.StatusCode);
            Assert.Equal("image/png", picture.Content.Headers.ContentType?.MediaType);
        }
    }

    [Fact]
    public async Task Chosen_pieces_become_ready_garments_with_their_tags_and_cost_nothing()
    {
        factory.Ai.Reset();
        // A new account has not given its consent to AI processing yet, and choosing catalogue pieces does not need it.
        var (client, auth) = await factory.SignedInWithoutConsentAsync();
        Assert.Null(auth.User.AiConsentAt);

        var response = await client.PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt", "blue_jeans", "white_sneakers"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new StarterAdditionResponse(3, 0), await response.ReadAsync<StarterAdditionResponse>());
        var wardrobe = await WardrobeOfAsync(client);
        Assert.Equal(3, wardrobe.Count);
        Assert.All(wardrobe, garment =>
        {
            Assert.Equal(ClothingStatus.Ready, garment.Status);
            Assert.False(garment.DescribedByAi);
            Assert.StartsWith("http", garment.ImageUrl, StringComparison.Ordinal);
            // The picture lies under the person's own prefix, and it is the one file for original and cutout.
            Assert.StartsWith($"u/{auth.User.Id:N}/", garment.ImageKey, StringComparison.Ordinal);
            Assert.True(factory.Storage.Contains(garment.ImageKey!));
        });
        var jeans = Assert.Single(wardrobe, garment => garment.Name == "Blue jeans");
        var expected = StarterCatalog.Find("blue_jeans")!.Tags;
        Assert.Equal((expected.Category, expected.Subcategory, expected.Warmth, expected.Formality, expected.RainOk), (jeans.Category, jeans.Subcategory, jeans.Warmth, jeans.Formality, jeans.RainOk));
        Assert.Equal(expected.Colors, jeans.Colors);
        Assert.Equal(expected.Styles, jeans.Styles);
        Assert.NotEmpty(jeans.Seasons);

        // No AI was asked and nothing was counted against the day's limit of added items.
        Assert.Equal((0, 0), (factory.Ai.RemoverCalls, factory.Ai.TaggerCalls));
        var usage = await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();
        Assert.Equal(0, usage.Items.Used);
        Assert.Equal(3, (await (await client.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>()).Total);
    }

    [Fact]
    public async Task Saying_the_same_thing_twice_adds_nothing_the_second_time()
    {
        var (client, _) = await factory.SignedInAsync();

        await client.PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt", "blue_jeans"));
        var again = await (await client.PostJsonAsync("/api/me/starter-pieces", Codes("blue_jeans", "white_tshirt", "white_tshirt", "black_boots"))).ReadAsync<StarterAdditionResponse>();

        Assert.Equal(new StarterAdditionResponse(1, 2), again);
        Assert.Equal(3, (await WardrobeOfAsync(client)).Count);
        var empty = await client.PostJsonAsync("/api/me/starter-pieces", Codes());
        Assert.Equal(new StarterAdditionResponse(0, 0), await empty.ReadAsync<StarterAdditionResponse>());
    }

    [Fact]
    public async Task An_unknown_code_is_refused_with_its_own_code_and_nothing_is_added()
    {
        var (client, _) = await factory.SignedInAsync();

        var response = await client.PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt", "purple_cape"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("starter_piece_unknown", await response.ProblemCodeAsync());
        Assert.Empty(await WardrobeOfAsync(client));
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt"))).StatusCode);
    }

    [Fact]
    public async Task Another_persons_wardrobe_is_not_touched_and_each_person_gets_their_own_files()
    {
        var (first, _) = await factory.SignedInAsync();
        var (second, _) = await factory.SignedInAsync();
        await first.PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt"));

        var added = await (await second.PostJsonAsync("/api/me/starter-pieces", Codes("white_tshirt"))).ReadAsync<StarterAdditionResponse>();

        Assert.Equal(new StarterAdditionResponse(1, 0), added);
        var mine = Assert.Single(await WardrobeOfAsync(first));
        var theirs = Assert.Single(await WardrobeOfAsync(second));
        Assert.NotEqual(mine.ImageKey, theirs.ImageKey);
    }

    private static async Task<List<MyStarterPieceResponse>> MineAsync(HttpClient client) =>
        await (await client.GetAsync("/api/me/starter-pieces")).ReadAsync<List<MyStarterPieceResponse>>();

    [Fact]
    public async Task My_list_is_the_whole_catalog_with_a_flag_for_the_pieces_this_person_has_and_it_is_theirs_alone()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/me/starter-pieces")).StatusCode);
        var (client, _) = await factory.SignedInAsync();
        var (other, _) = await factory.SignedInAsync();

        var before = await MineAsync(client);
        await client.PostJsonAsync("/api/me/starter-pieces", Codes("navy_hoodie"));
        var after = await MineAsync(client);

        Assert.Equal(StarterCatalog.All.Select(piece => piece.Code), after.Select(piece => piece.Code));
        Assert.All(before, piece => Assert.False(piece.Added));
        Assert.Equal(["navy_hoodie"], after.Where(piece => piece.Added).Select(piece => piece.Code));
        Assert.All(after, piece => Assert.False(string.IsNullOrEmpty(piece.ImageUrl)));
        Assert.Equal(StarterCatalog.All.Select(piece => piece.Audience), after.Select(piece => piece.Audience));
        Assert.All(await MineAsync(other), piece => Assert.False(piece.Added));
    }

    [Fact]
    public async Task Deleting_a_starter_garment_removes_its_picture_and_the_piece_can_be_added_again()
    {
        var (client, _) = await factory.SignedInAsync();
        await client.PostJsonAsync("/api/me/starter-pieces", Codes("navy_hoodie"));
        var garment = Assert.Single(await WardrobeOfAsync(client));
        Assert.True(Assert.Single(await MineAsync(client), piece => piece.Code == "navy_hoodie").Added);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/clothes/{garment.Id}")).StatusCode);

        Assert.False(factory.Storage.Contains(garment.ImageKey!));
        Assert.False(Assert.Single(await MineAsync(client), piece => piece.Code == "navy_hoodie").Added);
        var again = await (await client.PostJsonAsync("/api/me/starter-pieces", Codes("navy_hoodie"))).ReadAsync<StarterAdditionResponse>();
        Assert.Equal(1, again.Added);
    }

    [Fact]
    public async Task The_stylist_can_propose_outfits_from_nothing_but_starter_pieces_on_a_mild_day()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        var weather = factory.FreshWeather();
        (weather.Low, weather.High, weather.RainProbability) = (Looks.Mild, Looks.Mild, 10);
        var (client, _) = await factory.SignedInWithConsentAsync();
        await client.PostJsonAsync("/api/me/starter-pieces", Codes([.. StarterCatalog.All.Select(piece => piece.Code)]));
        factory.Stylist.AnswersWell(cost: 0.02m);

        var response = await client.SuggestAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var answer = await response.ReadAsync<SuggestionsResponse>();
        Assert.Equal(SuggestionStatus.Proposed, answer.Status);
        Assert.Empty(answer.Missing);
        Assert.NotEmpty(answer.Outfits);
    }
}
