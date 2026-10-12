using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Weather;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

/// <summary>Outfits the person builds themselves: creating them, the refusals, and the tips on a combination.</summary>
[Collection(ApiTests.Name)]
public sealed class OutfitBuilderTests(ApiFactory factory)
{
    private static readonly GarmentTags Dress = new(Category.OnePiece, Subcategory.Dress, "Green dress", [Color.Green], Pattern.Plain, Material.Cotton, 3, 1, false, [StyleTag.Casual]);
    private static readonly GarmentTags Shorts = new(Category.Bottom, Subcategory.Shorts, "Denim shorts", [Color.Blue], Pattern.Plain, Material.Denim, 1, 1, false, [StyleTag.Casual]);
    private static readonly GarmentTags Sandals = new(Category.Shoes, Subcategory.Sandals, "Leather sandals", [Color.Brown], Pattern.Plain, Material.Leather, 1, 1, false, [StyleTag.Casual]);
    private static readonly GarmentTags Blazer = new(Category.MidLayer, Subcategory.Blazer, "Navy blazer", [Color.Navy], Pattern.Plain, Material.Wool, 5, 2, false, [StyleTag.Smart]);
    private static readonly GarmentTags Cargo = new(Category.Bottom, Subcategory.Trousers, "Cargo pants", [Color.Olive], Pattern.Plain, Material.Cotton, 1, 2, false, [StyleTag.Casual]);
    private static readonly GarmentTags RedSweater = new(Category.MidLayer, Subcategory.Sweater, "Red sweater", [Color.Red], Pattern.Plain, Material.Knit, 2, 3, false, [StyleTag.Casual]);
    private static readonly GarmentTags YellowTee = new(Category.Top, Subcategory.TShirt, "Yellow T-shirt", [Color.Yellow], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual]);
    private static readonly GarmentTags PinkJeans = new(Category.Bottom, Subcategory.Jeans, "Pink jeans", [Color.Pink], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual]);
    private static readonly GarmentTags GreenSneakers = new(Category.Shoes, Subcategory.Sneakers, "Green sneakers", [Color.Green], Pattern.Plain, Material.Leather, 2, 2, false, [StyleTag.Casual]);
    private static readonly GarmentTags Scarf = new(Category.Accessory, Subcategory.Scarf, "Wool scarf", [Color.Grey], Pattern.Plain, Material.Wool, 2, 3, false, [StyleTag.Casual]);

    private static JsonObject Body(IEnumerable<ClothingResponse> items, string? occasion = null, string? name = null)
    {
        var body = new JsonObject { ["items"] = new JsonArray([.. items.Select(item => (JsonNode)JsonValue.Create(item.Id.ToString())!)]) };
        if (occasion is not null)
        {
            body["occasion"] = occasion;
        }

        if (name is not null)
        {
            body["name"] = name;
        }

        return body;
    }

    private static Task<HttpResponseMessage> Create(HttpClient client, IEnumerable<ClothingResponse> items, string? occasion = null, string? name = null) =>
        client.PostJsonAsync("/api/outfits", Body(items, occasion, name));

    private static Task<HttpResponseMessage> Tips(HttpClient client, IEnumerable<ClothingResponse> items, string? occasion = null) =>
        client.PostJsonAsync("/api/outfits/tips", Body(items, occasion));

    private static async Task<OutfitTipsResponse> TipsOf(HttpClient client, IEnumerable<ClothingResponse> items, string? occasion = null)
    {
        var response = await Tips(client, items, occasion);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<OutfitTipsResponse>();
    }

    [Fact]
    public async Task Building_and_tips_need_a_signed_in_person()
    {
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostJsonAsync("/api/outfits", new JsonObject())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostJsonAsync("/api/outfits/tips", new JsonObject())).StatusCode);
    }

    [Fact]
    public async Task An_outfit_is_created_saved_with_its_garments_in_their_slots_and_todays_weather()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Belt]);

        var response = await Create(client, wardrobe, "work", "  Monday  ");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var outfit = await response.ReadAsync<OutfitResponse>();
        Assert.Equal($"/api/outfits/{outfit.Id}", response.Headers.Location?.OriginalString);
        Assert.Equal((OutfitSource.Manual, (OutfitKind?)null, true, Occasion.Work, "Monday"), (outfit.Source, outfit.Kind, outfit.IsSaved, outfit.Occasion, outfit.Name));
        Assert.Equal([Category.Top, Category.Bottom, Category.Shoes, Category.Accessory], outfit.Items.Select(item => item.Slot));
        Assert.Equal(("Gliwice", TemperatureBand.Warm), (outfit.Weather!.Place, outfit.Weather.Band));
        Assert.Equal(string.Empty, outfit.Reasoning);
        Assert.InRange(outfit.Score, 0, 100);
        Assert.Equal(outfit.Id, Assert.Single(await ListAsync(client, "?saved=true")).Id);
        Assert.Equivalent(outfit with { Items = [], Visualization = null }, (await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()) with { Items = [], Visualization = null });
    }

    [Fact]
    public async Task The_occasion_is_everyday_and_the_name_empty_when_left_out()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var outfit = await (await Create(client, wardrobe)).ReadAsync<OutfitResponse>();

        Assert.Equal((Occasion.Everyday, (string?)null), (outfit.Occasion, outfit.Name));
    }

    [Fact]
    public async Task The_weather_never_refuses_an_outfit()
    {
        // Sandals and shorts in the cold and the rain, a blazer over cargo pants: the person is free to choose.
        var (client, _, wardrobe) = await factory.DressedAsync(Cold, [Tee, Shorts, Sandals, Blazer, Cargo], rain: true);

        var outfit = await Create(client, [wardrobe[0], wardrobe[1], wardrobe[2], wardrobe[3]]);

        Assert.Equal(HttpStatusCode.Created, outfit.StatusCode);
        Assert.Equal(TemperatureBand.Cold, (await outfit.ReadAsync<OutfitResponse>()).Weather!.Band);
    }

    [Fact]
    public async Task Without_a_place_the_outfit_has_no_weather()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var wardrobe = await factory.DressAsync(client, Tee, Jeans, Sneakers);
        await factory.WithDatabaseAsync(async db => await db.Users.ExecuteUpdateAsync(user => user.SetProperty(found => found.LocationName, (string?)null)));

        var created = await Create(client, wardrobe);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Null((await created.ReadAsync<OutfitResponse>()).Weather);
    }

    [Fact]
    public async Task The_garments_are_checked_for_integrity_and_each_refusal_has_its_own_code()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Dress, Belt, Belt, Belt, Belt, Shirt, Jacket]);
        var (tee, jeans, sneakers, dress, belts, shirt, jacket) = (wardrobe[0], wardrobe[1], wardrobe[2], wardrobe[3], wardrobe[4..8], wardrobe[8], wardrobe[9]);

        async Task Refused(IEnumerable<ClothingResponse> items, string code)
        {
            var response = await Create(client, items);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(code, await response.ProblemCodeAsync());
        }

        await Refused([tee], "outfit_size_invalid");
        await Refused(wardrobe[..9], "outfit_size_invalid");
        await Refused([tee, tee, jeans], "item_repeated");
        await Refused([tee, shirt, jeans, sneakers], "role_repeated");
        await Refused([tee, jeans, sneakers, .. belts], "too_many_accessories");
        await Refused([dress, tee, sneakers], "one_piece_with_separates");
        await Refused([dress, jeans, sneakers], "one_piece_with_separates");
        await Refused([tee, jeans with { Id = Guid.NewGuid() }], "item_not_found");

        // Someone else's garment is not found, exactly like one that does not exist.
        var (stranger, _) = await factory.SignedInWithConsentAsync();
        var theirs = await factory.AddTaggedGarmentAsync(stranger, Chinos);
        await Refused([tee, theirs], "item_not_found");

        // One that is still being prepared cannot be used yet.
        var waiting = await client.AddGarmentAsync(factory.Storage);
        await Refused([tee, waiting], "item_not_ready");

        // The same people and garments, put together properly, are accepted: nothing above was stored.
        Assert.Empty(await ListAsync(client));
        Assert.Equal(HttpStatusCode.Created, (await Create(client, [tee, jeans, sneakers, jacket, belts[0], belts[1]])).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Create(client, [dress, sneakers, belts[0]])).StatusCode);
        Assert.Equal(2, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task A_name_longer_than_sixty_characters_is_refused()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans]);

        Assert.Equal(HttpStatusCode.BadRequest, (await Create(client, wardrobe, name: new string('a', 61))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Create(client, wardrobe, name: new string('a', 60))).StatusCode);
    }

    [Fact]
    public async Task An_outfit_can_be_created_with_the_board_already_arranged()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Belt]);
        var chosen = wardrobe.Take(3).ToList();
        JsonObject Placed(Guid id, double x) => new() { ["clothingId"] = id.ToString(), ["x"] = x, ["y"] = 0.4, ["scale"] = 0.35, ["z"] = 2 };

        var body = Body(chosen);
        body["layout"] = new JsonArray(Placed(chosen[0].Id, 0.3), Placed(chosen[2].Id, 0.8));
        var created = await client.PostJsonAsync("/api/outfits", body);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        OutfitPlacementResponse[] expected = [new(chosen[0].Id, 0.3, 0.4, 0.35, 2), new(chosen[2].Id, 0.8, 0.4, 0.35, 2)];
        var outfit = await created.ReadAsync<OutfitResponse>();
        Assert.Equal(expected, outfit.Layout);
        Assert.Equal(expected, (await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()).Layout);

        // Left out, the app lays the garments out itself.
        Assert.Null((await (await Create(client, chosen)).ReadAsync<OutfitResponse>()).Layout);

        // A garment that is not in the outfit (though it is the person's own), or one placed twice, is refused and nothing is stored.
        foreach (var layout in new[] { new JsonArray(Placed(wardrobe[3].Id, 0.5)), new JsonArray(Placed(chosen[0].Id, 0.2), Placed(chosen[0].Id, 0.6)) })
        {
            var wrong = Body(chosen);
            wrong["layout"] = layout;
            var refused = await client.PostJsonAsync("/api/outfits", wrong);
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("layout_invalid", await refused.ProblemCodeAsync());
        }

        var offBoard = Body(chosen);
        offBoard["layout"] = new JsonArray(Placed(chosen[0].Id, 1.2));
        Assert.Equal("validation_failed", await (await client.PostJsonAsync("/api/outfits", offBoard)).ProblemCodeAsync());
        Assert.Equal(2, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(found => found.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task An_outfit_can_be_created_with_the_figure_already_arranged()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Belt]);
        var chosen = wardrobe.Take(3).ToList();
        JsonObject Placed(Guid id, double x) => new() { ["clothingId"] = id.ToString(), ["x"] = x, ["y"] = 0.4, ["scale"] = 0.35, ["z"] = 2 };

        var body = Body(chosen);
        body["figureLayout"] = new JsonArray(Placed(chosen[0].Id, 0.3), Placed(chosen[2].Id, 0.8));
        var created = await client.PostJsonAsync("/api/outfits", body);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        OutfitPlacementResponse[] expected = [new(chosen[0].Id, 0.3, 0.4, 0.35, 2), new(chosen[2].Id, 0.8, 0.4, 0.35, 2)];
        var outfit = await created.ReadAsync<OutfitResponse>();
        Assert.Equal(expected, outfit.FigureLayout);
        Assert.Null(outfit.Layout);
        Assert.Equal(expected, (await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()).FigureLayout);

        // Left out, the app places the garments itself.
        Assert.Null((await (await Create(client, chosen)).ReadAsync<OutfitResponse>()).FigureLayout);

        // A garment that is not in the outfit (though it is the person's own), or one placed twice, is refused and nothing is stored.
        foreach (var layout in new[] { new JsonArray(Placed(wardrobe[3].Id, 0.5)), new JsonArray(Placed(chosen[0].Id, 0.2), Placed(chosen[0].Id, 0.6)) })
        {
            var wrong = Body(chosen);
            wrong["figureLayout"] = layout;
            var refused = await client.PostJsonAsync("/api/outfits", wrong);
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("layout_invalid", await refused.ProblemCodeAsync());
        }

        var offFigure = Body(chosen);
        offFigure["figureLayout"] = new JsonArray(Placed(chosen[0].Id, 1.2));
        Assert.Equal("validation_failed", await (await client.PostJsonAsync("/api/outfits", offFigure)).ProblemCodeAsync());
        Assert.Equal(2, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(found => found.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task A_built_outfit_can_be_rated_worn_deleted_and_tried_on_like_any_other()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        factory.Visualizer.Reset();
        factory.Jobs.Clear();
        var outfit = await (await Create(client, wardrobe)).ReadAsync<OutfitResponse>();

        var rated = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["rating"] = "like" })).ReadAsync<OutfitResponse>();
        var worn = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true })).ReadAsync<OutfitResponse>();
        var order = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfit.Id}/visualizations");
        order.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        var tryOn = await client.SendAsync(order);

        Assert.Equal(OutfitRating.Like, rated.Rating);
        Assert.NotNull(worn.WornOn);
        Assert.Equal(HttpStatusCode.Accepted, tryOn.StatusCode);
        var ids = wardrobe.Select(item => item.Id).ToList();
        Assert.All(await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().Where(item => ids.Contains(item.Id)).ToListAsync()), item => Assert.Equal(1, item.WearCount));

        // The next stylist request knows about it: a liked, worn outfit is history like the proposals are.
        Assert.Equal(HttpStatusCode.OK, (await client.SuggestAsync()).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/outfits/{outfit.Id}")).StatusCode);
        Assert.DoesNotContain(await ListAsync(client), listed => listed.Id == outfit.Id);
    }

    [Fact]
    public async Task A_draft_is_not_saved_can_be_tried_on_and_hands_its_picture_to_the_outfit_saved_from_it()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        factory.Visualizer.Reset();
        factory.Jobs.Clear();
        var body = Body(wardrobe);
        body["saved"] = false;
        var draft = await (await client.PostJsonAsync("/api/outfits", body)).ReadAsync<OutfitResponse>();

        Assert.False(draft.IsSaved);
        Assert.Equal(OutfitSource.Manual, draft.Source);
        Assert.DoesNotContain(await ListAsync(client, "?saved=true"), listed => listed.Id == draft.Id);

        var order = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{draft.Id}/visualizations");
        order.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        var tryOn = await client.SendAsync(order);
        Assert.Equal(HttpStatusCode.Accepted, tryOn.StatusCode);
        var picture = await tryOn.ReadAsync<VisualizationResponse>();

        var keep = Body(wardrobe, "work", "Monday");
        keep["draftId"] = draft.Id.ToString();
        var saved = await (await client.PostJsonAsync("/api/outfits", keep)).ReadAsync<OutfitResponse>();

        Assert.True(saved.IsSaved);
        Assert.Equal("Monday", saved.Name);
        Assert.Equal(Occasion.Work, saved.Occasion);
        Assert.Equal(picture.Id, saved.Visualization?.Id);
        Assert.Equal(saved.Id, (await (await client.GetAsync($"/api/visualizations/{picture.Id}")).ReadAsync<VisualizationResponse>()).OutfitId);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/outfits/{draft.Id}")).StatusCode);
    }

    [Fact]
    public async Task Only_the_persons_own_unsaved_outfit_counts_as_a_draft()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var (other, _, theirs) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var kept = await (await Create(client, wardrobe)).ReadAsync<OutfitResponse>();
        var foreignBody = Body(theirs);
        foreignBody["saved"] = false;
        var foreign = await (await other.PostJsonAsync("/api/outfits", foreignBody)).ReadAsync<OutfitResponse>();

        foreach (var id in new[] { kept.Id, foreign.Id, Guid.NewGuid() })
        {
            var body = Body(wardrobe);
            body["draftId"] = id.ToString();
            Assert.Equal(HttpStatusCode.Created, (await client.PostJsonAsync("/api/outfits", body)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/outfits/{kept.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync($"/api/outfits/{foreign.Id}")).StatusCode);
    }

    // ---- tips ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Missing_shoes_come_first_and_the_rest_is_praised()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans]);

        var tips = await TipsOf(client, wardrobe);

        Assert.Equal("no_shoes", tips.Improvements[0].Code);
        Assert.Equal("No shoes yet. Add a pair to finish the outfit.", tips.Improvements[0].Text);
        Assert.Contains(tips.Positives, positive => positive.Contains("accent color", StringComparison.Ordinal));
        Assert.True(tips.Score < 100);
    }

    [Fact]
    public async Task A_good_outfit_gets_only_positives()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var tips = await TipsOf(client, wardrobe, "everyday");

        Assert.Empty(tips.Improvements);
        Assert.Equal(100, tips.Score);
        Assert.Equal(
            [
                "The white T-shirt and the blue jeans make a complete outfit with the white sneakers.",
                "It suits the 20°C forecast for Gliwice today.",
                "One accent color keeps the palette calm.",
            ],
            tips.Positives);
    }

    [Fact]
    public async Task Rain_and_cold_are_named_with_the_place_and_the_temperature()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(8, [Tee, Jeans, Sneakers, Sweater, Jacket], rain: true);

        var without = await TipsOf(client, wardrobe[..3]);
        var withJacket = await TipsOf(client, [wardrobe[0], wardrobe[1], wardrobe[2], wardrobe[4]]);

        Assert.Equal("rain_gear", without.Improvements[0].Code);
        Assert.Equal("It is 8°C and rainy in Gliwice today: add a jacket that handles rain.", without.Improvements[0].Text);
        Assert.Equal("rain_gear", withJacket.Improvements[0].Code);
        Assert.Equal("Rain is on the way in Gliwice and the black jacket will not keep you dry. Choose a rain-proof jacket.", withJacket.Improvements[0].Text);
        Assert.DoesNotContain(withJacket.Positives, positive => positive.Contains("forecast", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Sandals_and_shorts_in_the_cold_are_called_out()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Cold, [Tee, Shorts, Sandals, Jacket]);

        var tips = await TipsOf(client, wardrobe);

        Assert.Contains(tips.Improvements, item => item.Code == "cold_legs" && item.Text == "Shorts will feel cold at 6°C. Try trousers or a long skirt instead of the denim shorts.");
        Assert.Contains(tips.Improvements, item => item.Code == "cold_feet");
        Assert.True(tips.Improvements.Count <= 3);
    }

    [Fact]
    public async Task Competing_colors_and_a_formality_gap_name_the_garments_involved()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [YellowTee, PinkJeans, GreenSneakers, RedSweater, Blazer, Cargo]);

        var clash = await TipsOf(client, [wardrobe[0], wardrobe[1], wardrobe[2], wardrobe[3]]);
        var gap = await TipsOf(client, [wardrobe[0], wardrobe[5], wardrobe[2], wardrobe[4]]);

        var colors = Assert.Single(clash.Improvements, item => item.Code == "colors_compete");
        Assert.Equal("Four strong colors compete here. Swap the yellow T-shirt for a neutral one.", colors.Text);
        Assert.Contains(gap.Improvements, item => item.Code == "formality_gap" && item.Text == "The navy blazer is far more formal than the cargo pants. Bring the two closer together.");
    }

    [Fact]
    public async Task The_occasion_is_judged_only_when_the_person_names_one()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var open = await TipsOf(client, wardrobe);
        var business = await TipsOf(client, wardrobe, "business");

        Assert.DoesNotContain(open.Improvements, item => item.Code.StartsWith("occasion_", StringComparison.Ordinal));
        Assert.Contains(business.Improvements, item => item.Code == "occasion_formality" && item.Text.StartsWith("The white T-shirt is too casual for this occasion (business meeting)", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Tips_work_without_a_place_and_say_nothing_about_the_weather()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        await factory.WithDatabaseAsync(async db => await db.Users.ExecuteUpdateAsync(user => user.SetProperty(found => found.LocationName, (string?)null)));

        var tips = await TipsOf(client, wardrobe);

        Assert.Empty(tips.Improvements);
        Assert.DoesNotContain(tips.Positives, positive => positive.Contains("forecast", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Tips_are_refused_for_garments_that_are_not_the_persons_own()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans]);
        var (stranger, _) = await factory.SignedInWithConsentAsync();
        var theirs = await factory.AddTaggedGarmentAsync(stranger, Sneakers);

        var response = await Tips(client, [wardrobe[0], theirs]);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("item_not_found", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Tips_have_their_own_daily_allowance_and_do_not_touch_the_stylists()
    {
        factory.Ai.Reset();
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:TipsPerDay", "2"));
        var weather = limited.Services.GetRequiredService<FakeWeather>();
        (weather.Low, weather.High) = (Warm, Warm);
        var auth = await limited.CreateClient().RegisterAsync();
        var client = limited.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        var wardrobe = new List<ClothingResponse>();
        foreach (var tags in (GarmentTags[])[Tee, Jeans])
        {
            factory.Ai.TaggingReturns(tags);
            var added = await client.AddGarmentAsync(limited.Services.GetRequiredService<FitIt.Infrastructure.Storage.InMemoryImageStorage>());
            await factory.ProcessAsync(added.Id, limited.Services);
            wardrobe.Add(await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>());
        }

        var answers = new List<HttpResponseMessage>();
        for (var attempt = 0; attempt < 3; attempt++)
        {
            answers.Add(await Tips(client, wardrobe));
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], answers.Select(answer => answer.StatusCode));
        var problem = await answers[2].Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(("limit_reached", "tips", 2), (problem!["code"]!.GetValue<string>(), problem["kind"]!.GetValue<string>(), problem["limit"]!.GetValue<int>()));
        Assert.Equal(0, (await limited.Services.GetRequiredService<IServiceScopeFactory>().CreateAsyncScope().ServiceProvider.GetRequiredService<FitIt.Infrastructure.Persistence.AppDbContext>()
            .UsageCounters.CountAsync(counter => counter.UserId == auth.User.Id && counter.Kind == UsageKind.Suggestion)));
    }

    [Fact]
    public async Task Every_answer_is_written_to_the_ai_log_at_no_cost()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans]);

        await TipsOf(client, wardrobe);

        var entry = Assert.Single(await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(found => found.UserId == auth.User.Id && found.Operation == AiOperation.Critique).ToListAsync()));
        Assert.Equal((0m, true), (entry.CostUsd, entry.Success));
    }

    private static async Task<List<OutfitResponse>> ListAsync(HttpClient client, string query = "") =>
        await (await client.GetAsync($"/api/outfits{query}")).ReadAsync<List<OutfitResponse>>();
}
