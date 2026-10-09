using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Styling;
using FitIt.Infrastructure.Weather;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

[Collection(ApiTests.Name)]
public sealed class SuggestionApiTests(ApiFactory factory)
{
    [Fact]
    public async Task A_request_goes_through_the_whole_pipeline_and_stores_three_proposals()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.AnswersWell(cost: 0.02m);

        var response = await client.SuggestAsync("friends", "  open-air concert  ");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var answer = await response.ReadAsync<SuggestionsResponse>();
        Assert.Equal(SuggestionStatus.Proposed, answer.Status);
        Assert.Empty(answer.Missing);
        Assert.Empty(answer.MissingEither);
        Assert.False(answer.Fallback);
        Assert.Equal(Occasion.Friends, answer.Occasion);
        Assert.Equal(("Gliwice", TemperatureBand.Warm, 20, false), (answer.Weather.Place, answer.Weather.Band, answer.Weather.FeelsMin, answer.Weather.Rain));
        Assert.Empty(answer.Relaxations);
        Assert.False(answer.Umbrella);

        Assert.Equal(3, answer.Outfits.Count);
        Assert.Equal(answer.Outfits.Select(outfit => outfit.Score).OrderDescending(), answer.Outfits.Select(outfit => outfit.Score));
        Assert.Single(answer.Outfits.Select(outfit => outfit.RequestId).Distinct());
        // Nothing in a new wardrobe is forgotten: the outfit offered as a discovery keeps its place and loses the label.
        Assert.Equal(new OutfitKind?[] { OutfitKind.SureBet, OutfitKind.NewPairing, null }.Order(), answer.Outfits.Select(outfit => outfit.Kind).Order());
        var owned = wardrobe.Select(garment => garment.Id).ToHashSet();
        Assert.All(answer.Outfits, outfit =>
        {
            Assert.Equal(OutfitSource.Model, outfit.Source);
            Assert.Equal(Occasion.Friends, outfit.Occasion);
            Assert.Equal("open-air concert", outfit.OccasionNote);
            Assert.Equal((OutfitRating.None, false, null), (outfit.Rating, outfit.IsSaved, outfit.WornOn));
            Assert.False(string.IsNullOrWhiteSpace(outfit.Reasoning));
            Assert.Equal(("Gliwice", TemperatureBand.Warm, 20, 20), (outfit.Weather!.Place, outfit.Weather.Band, outfit.Weather.FeelsMin, outfit.Weather.FeelsMax));
            Assert.Contains(outfit.Items, item => item.Slot == Category.Shoes);
            Assert.Contains(outfit.Items, item => item.Slot == Category.Top);
            Assert.Contains(outfit.Items, item => item.Slot == Category.Bottom);
            Assert.All(outfit.Items, item =>
            {
                Assert.Equal(item.Slot, item.Clothing.Category);
                Assert.Contains(item.Clothing.Id, owned);
                Assert.StartsWith("http", item.Clothing.ImageUrl, StringComparison.Ordinal);
                Assert.NotNull(item.Clothing.ImageKey);
            });
            Assert.Equal(outfit.Items.Select(item => item.Slot).Order(), outfit.Items.Select(item => item.Slot));
        });

        // The model was asked once, with the note and with aliases only.
        var request = Assert.Single(factory.Stylist.Requests);
        Assert.Empty(request.Errors);
        var brief = request.Case.Brief().ToJson();
        Assert.Contains("\"note\":\"open-air concert\"", brief, StringComparison.Ordinal);
        Assert.Contains("\"name\":\"Out with friends\"", brief, StringComparison.Ordinal);
        Assert.Contains("\"styles\":[\"casual\",\"smart casual\"]", brief, StringComparison.Ordinal);
        Assert.Contains("\"nearby_styles\":[\"minimalist\",\"preppy\"]", brief, StringComparison.Ordinal);
        Assert.All(wardrobe, garment => Assert.DoesNotContain(garment.Id.ToString(), brief, StringComparison.Ordinal));
        Assert.Equal(9, request.Case.Candidates.Items.Count);

        // Stored as context, choice and room for the reaction.
        var stored = await factory.WithDatabaseAsync(db => db.Outfits.AsNoTracking().Include(outfit => outfit.Items).Where(outfit => outfit.UserId == auth.User.Id).ToListAsync());
        Assert.Equal(answer.Outfits.Select(outfit => outfit.Id).Order(), stored.Select(outfit => outfit.Id).Order());
        Assert.All(stored, outfit =>
        {
            Assert.Equal((StylistPrompt.Version, ScriptedStylist.Model, OutfitSource.Model), (outfit.PromptVersion, outfit.Model, outfit.Source));
            Assert.Equal((TemperatureBand.Warm, 20d, 10, false, "Gliwice"), (outfit.Weather!.Band, outfit.Weather.Reference, outfit.Weather.RainProbability, outfit.Weather.Rain, outfit.Weather.Place));
            Assert.Equal(factory.Clock.GetUtcNow(), outfit.CreatedAt);
            Assert.Equal(answer.Outfits.Single(shown => shown.Id == outfit.Id).Items.Select(item => item.Clothing.Id).Order(), outfit.Items.Select(item => item.ClothingItemId).Order());
        });

        // Counted once against the day's limit, and the cost is in the ledger.
        Assert.Equal(new UsageLineResponse(1, 20), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions);
        var spent = await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.Styling).ToListAsync());
        Assert.Equal((ScriptedStylist.Model, 0.02m, true), Assert.Single(spent) is var entry ? (entry.Model, entry.CostUsd, entry.Success) : default);

        // Codes travel as text.
        var raw = await (await client.GetAsync($"/api/outfits/{answer.Outfits[0].Id}")).Content.ReadAsStringAsync();
        Assert.Contains("\"source\":\"model\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"occasion\":\"friends\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"rating\":\"none\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"slot\":\"shoes\"", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task What_the_model_says_is_shown_as_it_said_it_and_a_label_it_did_not_earn_is_dropped()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        await client.PatchJsonAsync($"/api/clothes/{wardrobe[1].Id}", new JsonObject { ["rarelyWorn"] = true });
        factory.Stylist.Answers(request =>
        {
            string Alias(int index) => request.Case.Candidates.AliasOf(wardrobe[index].Id)!;
            return
            [
                // The white tee is not forgotten: no discovery. The loud reasoning is longer than a card can hold.
                new StylistOutfit(OutfitKind.Discovery, Alias(0), null, Alias(3), null, null, Alias(5), [], new string('a', 700), "  It will cool down in the evening.  "),
                new StylistOutfit(OutfitKind.Discovery, Alias(1), Alias(2), Alias(4), null, null, Alias(6), [Alias(8)], " The light blue shirt livens up the beige chinos. ", null),
                // The forgotten shirt again: no sure bet.
                new StylistOutfit(OutfitKind.SureBet, Alias(1), null, Alias(3), null, Alias(7), Alias(5), [], "The jacket completes the outfit.", " "),
                // A fourth outfit is one too many.
                new StylistOutfit(OutfitKind.NewPairing, Alias(0), Alias(2), Alias(4), null, Alias(7), Alias(6), [], "Czwarty.", null),
            ];
        });

        var answer = await client.SuggestedAsync();

        Assert.Equal(3, answer.Outfits.Count);
        Assert.DoesNotContain(answer.Outfits, outfit => outfit.Reasoning == "Czwarty.");
        var discovery = Assert.Single(answer.Outfits, outfit => outfit.Kind == OutfitKind.Discovery);
        Assert.Equal("The light blue shirt livens up the beige chinos.", discovery.Reasoning);
        Assert.Null(discovery.WeatherNote);
        Assert.Equal(
            [wardrobe[1].Id, wardrobe[2].Id, wardrobe[4].Id, wardrobe[6].Id, wardrobe[8].Id],
            discovery.Items.Select(item => item.Clothing.Id));
        Assert.Equal([Category.Top, Category.MidLayer, Category.Bottom, Category.Shoes, Category.Accessory], discovery.Items.Select(item => item.Slot));
        var unlabelled = answer.Outfits.Where(outfit => outfit.Kind is null).ToList();
        Assert.Equal(2, unlabelled.Count);
        var loud = Assert.Single(unlabelled, outfit => outfit.Reasoning.StartsWith('a'));
        Assert.Equal(Outfit.ReasoningMaxLength, loud.Reasoning.Length);
        Assert.Equal("It will cool down in the evening.", loud.WeatherNote);
        Assert.Null(Assert.Single(unlabelled, outfit => outfit.Reasoning == "The jacket completes the outfit.").WeatherNote);
        Assert.All(answer.Outfits, outfit => Assert.Equal(OutfitSource.Model, outfit.Source));
    }

    [Fact]
    public async Task One_valid_outfit_among_invalid_ones_is_enough_and_is_not_asked_for_again()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.Answers(request =>
        [
            new StylistOutfit(OutfitKind.SureBet, "T7", null, "B1", null, null, "S1", [], "There is no such top.", null),
            new StylistOutfit(OutfitKind.NewPairing, "T1", null, "B1", null, null, "S1", [], "Prosto i wygodnie.", null),
            new StylistOutfit(OutfitKind.Discovery, "T1", null, "B1", null, null, "S1", [], "To samo drugi raz.", null),
        ]);

        var answer = await client.SuggestedAsync();

        var only = Assert.Single(answer.Outfits);
        Assert.Equal(("Prosto i wygodnie.", OutfitKind.NewPairing, OutfitSource.Model), (only.Reasoning, only.Kind, only.Source));
        Assert.False(answer.Fallback);
        Assert.Single(factory.Stylist.Requests);
        Assert.Contains(wardrobe[0].Id, only.Items.Select(item => item.Clothing.Id));
    }

    [Fact]
    public async Task An_answer_without_a_valid_outfit_is_sent_back_once_with_the_list_of_errors()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.AnswersNonsense(cost: 0.01m).AnswersWell(cost: 0.02m);

        var answer = await client.SuggestedAsync();

        Assert.False(answer.Fallback);
        Assert.Equal(3, answer.Outfits.Count);
        Assert.All(answer.Outfits, outfit => Assert.Equal(OutfitSource.Model, outfit.Source));
        Assert.Equal(2, factory.Stylist.Requests.Count);
        Assert.Empty(factory.Stylist.Requests[0].Errors);
        Assert.Equal(["Outfit 1: T99 is not among the candidates.", "Outfit 2: Shoes are missing."], factory.Stylist.Requests[1].Errors);
        Assert.Same(factory.Stylist.Requests[0].Case, factory.Stylist.Requests[1].Case);

        // Both calls cost money; only the second was of use. The person used one request, not two.
        var spent = await StylingSpendAsync(auth.User.Id);
        Assert.Equal([(0.01m, false), (0.02m, true)], spent.Select(entry => (entry.CostUsd, entry.Success)));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
    }

    [Fact]
    public async Task An_empty_answer_is_sent_back_too()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.AnswersNothing();

        var answer = await client.SuggestedAsync();

        Assert.False(answer.Fallback);
        Assert.Equal(["No outfits were returned."], factory.Stylist.Requests[1].Errors);
    }

    [Fact]
    public async Task Two_answers_without_a_valid_outfit_and_the_rules_take_over()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.AnswersNonsense(times: 2, cost: 0.01m);

        var answer = await client.SuggestedAsync();

        AssertComposedByRules(answer);
        Assert.Equal(2, factory.Stylist.Requests.Count);
        Assert.Equal([(0.01m, false), (0.01m, false)], (await StylingSpendAsync(auth.User.Id)).Select(entry => (entry.CostUsd, entry.Success)));
        var stored = await factory.WithDatabaseAsync(db => db.Outfits.AsNoTracking().Where(outfit => outfit.UserId == auth.User.Id).ToListAsync());
        Assert.All(stored, outfit => Assert.Equal((OutfitSource.Rules, null, null), (outfit.Source, outfit.Model, outfit.PromptVersion)));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
    }

    [Theory]
    [InlineData("fails")]
    [InlineData("fails_after_paying")]
    [InlineData("times_out")]
    [InlineData("refuses")]
    public async Task When_the_model_cannot_be_used_the_rules_answer_at_once(string how)
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        _ = how switch
        {
            "fails" => factory.Stylist.Fails(),
            "fails_after_paying" => factory.Stylist.Fails(cost: 0.03m),
            "times_out" => factory.Stylist.TimesOut(),
            _ => factory.Stylist.Refuses(cost: 0.01m),
        };

        var answer = await client.SuggestedAsync();

        AssertComposedByRules(answer);
        // No second try: a model that is down or says no is not asked again within the same request.
        Assert.Single(factory.Stylist.Requests);
        var entry = Assert.Single(await StylingSpendAsync(auth.User.Id));
        Assert.Equal(
            how switch
            {
                "fails_after_paying" => (ScriptedStylist.Model, 0.03m, false),
                "refuses" => (ScriptedStylist.Model, 0.01m, false),
                _ => ("unknown", 0m, false),
            },
            (entry.Model, entry.CostUsd, entry.Success));
    }

    [Fact]
    public async Task With_the_days_ai_budget_spent_the_model_is_not_asked_at_all()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        using var broke = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:AiBudgetUsdPerDay", "0"));
        (broke.Services.GetRequiredService<FakeWeather>().Low, broke.Services.GetRequiredService<FakeWeather>().High) = (Warm, Warm);
        var auth = await broke.CreateClient().RegisterAsync();
        var client = broke.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        foreach (var tags in Basics)
        {
            var added = await client.AddGarmentAsync(broke.Services.GetRequiredService<FitIt.Infrastructure.Storage.InMemoryImageStorage>());
            await using var scope = broke.Services.CreateAsyncScope();
            // Tagging itself waits for tomorrow's budget, so the test describes the garment by hand, as the person would.
            var item = await scope.ServiceProvider.GetRequiredService<FitIt.Infrastructure.Persistence.AppDbContext>().Clothes.SingleAsync(found => found.Id == added.Id);
            item.MarkReady(tags, tags.Describe(), factory.Clock.GetUtcNow());
            await scope.ServiceProvider.GetRequiredService<FitIt.Infrastructure.Persistence.AppDbContext>().SaveChangesAsync();
        }

        var answer = await client.SuggestedAsync();

        AssertComposedByRules(answer);
        Assert.Empty(factory.Stylist.Requests);
        Assert.Empty(await StylingSpendAsync(auth.User.Id));
    }

    [Fact]
    public async Task A_wardrobe_that_cannot_dress_the_person_gets_the_list_of_what_is_missing_and_nothing_is_counted()
    {
        var (client, auth, _) = await factory.DressedAsync(Cold, [Tee, Jeans]);

        var response = await client.SuggestAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\":\"missing_garments\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"missing\":[\"outerwear\",\"shoes\"]", raw, StringComparison.Ordinal);
        var answer = System.Text.Json.JsonSerializer.Deserialize<SuggestionsResponse>(raw, TestApi.Json)!;
        Assert.Equal(SuggestionStatus.MissingGarments, answer.Status);
        Assert.Equal([Category.Outerwear, Category.Shoes], answer.Missing);
        Assert.Contains("\"missingEither\":[]", raw, StringComparison.Ordinal);
        Assert.Empty(answer.MissingEither);
        Assert.Empty(answer.Outfits);
        Assert.False(answer.Fallback);
        Assert.Equal(TemperatureBand.Cold, answer.Weather.Band);

        Assert.Empty(factory.Stylist.Requests);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));
        Assert.Empty(await (await client.GetAsync("/api/outfits")).ReadAsync<List<OutfitResponse>>());
    }

    [Fact]
    public async Task When_either_of_two_roles_would_do_and_neither_exists_they_are_listed_as_a_group_and_not_as_both_required()
    {
        var (client, auth, _) = await factory.DressedAsync(14, [Tee, Jeans, Sneakers]);

        var response = await client.SuggestAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"missing\":[]", raw, StringComparison.Ordinal);
        Assert.Contains("\"missingEither\":[\"mid_layer\",\"outerwear\"]", raw, StringComparison.Ordinal);
        var answer = System.Text.Json.JsonSerializer.Deserialize<SuggestionsResponse>(raw, TestApi.Json)!;
        Assert.Equal(SuggestionStatus.MissingGarments, answer.Status);
        Assert.Empty(answer.Missing);
        Assert.Equal([Category.MidLayer, Category.Outerwear], answer.MissingEither);
        Assert.Empty(answer.Outfits);
        Assert.Empty(factory.Stylist.Requests);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));

        // A jacket is enough, and the wardrobe can dress the person after all.
        await factory.AddTaggedGarmentAsync(client, Jacket);
        var dressed = await client.SuggestedAsync();
        Assert.Equal(SuggestionStatus.Proposed, dressed.Status);
        Assert.Empty(dressed.MissingEither);
    }

    [Fact]
    public async Task Garments_that_are_not_described_yet_or_are_in_the_laundry_are_not_proposed()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Shirt, Jeans, Sneakers]);
        await client.AddGarmentAsync(factory.Storage);
        await client.PatchJsonAsync($"/api/clothes/{wardrobe[1].Id}", new JsonObject { ["inLaundry"] = true });

        var answer = await client.SuggestedAsync();

        var only = Assert.Single(answer.Outfits);
        Assert.Equal([wardrobe[0].Id, wardrobe[2].Id, wardrobe[3].Id], only.Items.Select(item => item.Clothing.Id));
        Assert.Equal(3, Assert.Single(factory.Stylist.Requests).Case.Candidates.Items.Count);
    }

    [Fact]
    public async Task Relaxed_rules_and_the_umbrella_are_told_with_the_proposals()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Slippers, Jacket], rain: true);

        var response = await client.SuggestAsync("work");

        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"relaxations\":[{\"role\":\"shoes\",\"rule\":\"formality\"}]", raw, StringComparison.Ordinal);
        var answer = System.Text.Json.JsonSerializer.Deserialize<SuggestionsResponse>(raw, TestApi.Json)!;
        Assert.Equal([new RelaxationResponse(Category.Shoes, RelaxedRule.Formality)], answer.Relaxations);
        Assert.True(answer.Umbrella);
        Assert.True(answer.Weather.Rain);
        Assert.NotEmpty(answer.Outfits);
        Assert.All(answer.Outfits, outfit =>
        {
            Assert.True(outfit.Umbrella);
            Assert.Equal([new RelaxationResponse(Category.Shoes, RelaxedRule.Formality)], outfit.Relaxations);
            Assert.True(outfit.Weather!.Rain);
            Assert.Contains(wardrobe[2].Id, outfit.Items.Select(item => item.Clothing.Id));
        });

        // Read again later, the outfit still says what gave way when it was proposed.
        var later = await (await client.GetAsync($"/api/outfits/{answer.Outfits[0].Id}")).ReadAsync<OutfitResponse>();
        Assert.Equal(answer.Outfits[0].Relaxations, later.Relaxations);
        Assert.True(later.Umbrella);
    }

    [Fact]
    public async Task In_rain_every_proposal_wears_the_outerwear_that_stands_it()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [.. Basics, Raincoat], rain: true);

        var answer = await client.SuggestedAsync();

        Assert.False(answer.Umbrella);
        Assert.Equal(3, answer.Outfits.Count);
        Assert.All(answer.Outfits, outfit => Assert.Equal(wardrobe[^1].Id, outfit.Items.Single(item => item.Slot == Category.Outerwear).Clothing.Id));
        Assert.Contains("rain outerwear", Assert.Single(factory.Stylist.Requests).Case.Brief().Weather.Requires);
    }

    [Fact]
    public async Task Build_around_this_puts_the_garment_into_every_proposal()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var sweater = wardrobe[2];

        var answer = await client.SuggestedAsync(baseItemId: sweater.Id);

        Assert.Equal(3, answer.Outfits.Count);
        Assert.All(answer.Outfits, outfit => Assert.Contains(sweater.Id, outfit.Items.Select(item => item.Clothing.Id)));
        var request = Assert.Single(factory.Stylist.Requests);
        Assert.Equal("M1", request.Case.Brief().BaseItem);
    }

    [Fact]
    public async Task The_garment_to_build_around_must_be_a_described_garment_of_the_same_person()
    {
        var (stranger, _, theirs) = await factory.DressedAsync(Warm, [Tee]);
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var waiting = await client.AddGarmentAsync(factory.Storage);

        foreach (var id in new[] { theirs[0].Id, waiting.Id, Guid.NewGuid() })
        {
            var response = await client.SuggestAsync(baseItemId: id);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("base_item_invalid", await response.ProblemCodeAsync());
        }

        Assert.Empty(factory.Stylist.Requests);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync("/api/clothes")).StatusCode);
    }

    [Theory]
    [InlineData("""{}""", "validation_failed")]
    [InlineData("""{"occasion":null}""", "validation_failed")]
    [InlineData("""{"occasion":"wedding"}""", "bad_request")]
    [InlineData("""{"occasion":2}""", "bad_request")]
    [InlineData("""{"occasion":"work","baseItemId":"not-an-id"}""", "bad_request")]
    public async Task A_request_that_does_not_fit_the_contract_is_refused(string body, string code)
    {
        var (client, _) = await factory.SignedInAsync();

        var response = await client.PostAsync("/api/outfits/suggestions", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task The_note_has_a_sane_length_and_a_blank_one_is_no_note()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);

        var tooLong = await client.SuggestAsync(note: new string('x', Outfit.NoteMaxLength + 1));
        var longest = await client.SuggestAsync(note: new string('x', Outfit.NoteMaxLength));
        var blank = await client.SuggestedAsync(note: "   ");

        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Equal("validation_failed", await tooLong.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, longest.StatusCode);
        Assert.All(blank.Outfits, outfit => Assert.Null(outfit.OccasionNote));
        Assert.Null(factory.Stylist.Requests[^1].Case.Note);
        Assert.Equal(2, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.Equal(6, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task Proposals_need_a_signed_in_person_a_place_and_a_forecast()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().SuggestAsync()).StatusCode);

        factory.FreshWeather();
        factory.Stylist.Reset();
        var (nowhere, _) = await factory.SignedInAsync(body => body.Remove("location"));
        var noPlace = await nowhere.SuggestAsync();
        Assert.Equal(HttpStatusCode.Conflict, noPlace.StatusCode);
        Assert.Equal("location_missing", await noPlace.ProblemCodeAsync());

        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        factory.FreshWeather().Down = true;
        var noForecast = await client.SuggestAsync();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, noForecast.StatusCode);
        Assert.Equal("weather_unavailable", await noForecast.ProblemCodeAsync());
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used);
        Assert.Empty(factory.Stylist.Requests);
        factory.FreshWeather();
    }

    [Fact]
    public async Task The_daily_limit_of_requests_holds_however_many_arrive_at_once()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:SuggestionsPerDay", "3"));
        var weather = limited.Services.GetRequiredService<FakeWeather>();
        (weather.Low, weather.High) = (Warm, Warm);
        var auth = await limited.CreateClient().RegisterAsync();
        var client = limited.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        foreach (var tags in (GarmentTags[])[Tee, Jeans, Sneakers])
        {
            factory.Ai.TaggingReturns(tags);
            var added = await client.AddGarmentAsync(limited.Services.GetRequiredService<FitIt.Infrastructure.Storage.InMemoryImageStorage>());
            await factory.ProcessAsync(added.Id, limited.Services);
        }

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.SuggestAsync()));

        Assert.Equal(3, responses.Count(response => response.StatusCode == HttpStatusCode.OK));
        var refused = responses.Where(response => response.StatusCode == HttpStatusCode.TooManyRequests).ToList();
        Assert.Equal(5, refused.Count);
        var problem = await refused[0].Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("limit_reached", problem!["code"]!.GetValue<string>());
        Assert.Equal("suggestion", problem["kind"]!.GetValue<string>());
        Assert.Equal(3, problem["limit"]!.GetValue<int>());
        Assert.Equal(new UsageLineResponse(3, 3), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions);
        // Only the requests that were let in reached the model and left outfits behind.
        Assert.Equal(3, factory.Stylist.Requests.Count);
        Assert.Equal(3, await factory.WithDatabaseAsync(db => db.Outfits.Where(outfit => outfit.UserId == auth.User.Id).Select(outfit => outfit.RequestId).Distinct().CountAsync()));
    }

    [Fact]
    public async Task What_the_person_liked_disliked_and_wore_goes_into_the_next_request()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var first = await client.SuggestedAsync();
        var (liked, disliked, worn) = (first.Outfits[0], first.Outfits[1], first.Outfits[2]);
        await client.PatchJsonAsync($"/api/outfits/{liked.Id}", new JsonObject { ["rating"] = "like" });
        await client.PatchJsonAsync($"/api/outfits/{disliked.Id}", new JsonObject { ["rating"] = "dislike" });
        await client.PatchJsonAsync($"/api/outfits/{worn.Id}", new JsonObject { ["worn"] = true });
        static Guid[] Ids(OutfitResponse outfit) => [.. outfit.Items.Select(item => item.Clothing.Id).Order()];
        factory.Stylist.Reset();

        var second = await client.SuggestedAsync();

        var styling = Assert.Single(factory.Stylist.Requests).Case;
        Assert.Equal(Ids(liked), Assert.Single(styling.History.Liked).Order());
        Assert.Equal(Ids(disliked), Assert.Single(styling.History.Disliked).Order());
        Assert.Equal(Ids(worn), Assert.Single(styling.History.Recent).Order());
        Assert.Equal(
            (worn.Items.Single(item => item.Slot == Category.Top).Clothing.Id, worn.Items.Single(item => item.Slot == Category.Bottom).Clothing.Id),
            Assert.Single(styling.History.WornPairs));
        var brief = styling.Brief();
        Assert.Equal(Ids(liked).Length, Assert.Single(brief.Liked).Count);
        Assert.Equal(Ids(disliked).Length, Assert.Single(brief.Disliked).Count);
        Assert.Equal(Ids(worn).Length, Assert.Single(brief.Recent).Count);

        // Liked garments rank as favourites, worn ones are known to be worn, and wearing them again so soon costs points.
        var wornIds = Ids(worn).ToHashSet();
        Assert.All(styling.Candidates.Items, candidate =>
        {
            Assert.Equal(wornIds.Contains(candidate.Garment.Id), candidate.Garment.RecentlyWorn);
            Assert.Equal(wornIds.Contains(candidate.Garment.Id) ? 1 : 0, candidate.Garment.WearCount);
            Assert.Equal(Ids(liked).Contains(candidate.Garment.Id) ? 1 : 0, candidate.Garment.Likes);
        });
        Assert.All(second.Outfits, outfit =>
            Assert.True(outfit.Score <= 100 - (CoherenceScore.PerRecentlyWorn * outfit.Items.Count(item => wornIds.Contains(item.Clothing.Id)))));
        Assert.All(second.Outfits.Where(outfit => outfit.Kind == OutfitKind.NewPairing), outfit =>
            Assert.NotEqual(
                styling.History.WornPairs.Single(),
                (outfit.Items.Single(item => item.Slot == Category.Top).Clothing.Id, outfit.Items.Single(item => item.Slot == Category.Bottom).Clothing.Id)));

        // Three days on, the outfit is no longer "recent", but the pairing stays known as worn. A cleared rating is no example.
        await client.PatchJsonAsync($"/api/outfits/{liked.Id}", new JsonObject { ["rating"] = "none" });
        factory.Clock.Advance(TimeSpan.FromDays(3));
        client = await factory.SignInAgainAsync(auth);
        factory.FreshWeather();
        (factory.Weather.Low, factory.Weather.High) = (Warm, Warm);
        factory.Stylist.Reset();
        await client.SuggestedAsync();

        var later = Assert.Single(factory.Stylist.Requests).Case;
        Assert.Empty(later.History.Recent);
        Assert.Empty(later.History.Liked);
        Assert.Single(later.History.Disliked);
        Assert.Single(later.History.WornPairs);
        Assert.All(later.Candidates.Items, candidate => Assert.False(candidate.Garment.RecentlyWorn));
        Assert.Equal(wardrobe.Count, later.Candidates.Items.Count);
    }

    [Fact]
    public async Task Only_the_five_newest_liked_outfits_are_examples()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var rated = new List<OutfitResponse>();
        for (var round = 0; round < 3; round++)
        {
            foreach (var outfit in (await client.SuggestedAsync()).Outfits.Take(2))
            {
                factory.Clock.Advance(TimeSpan.FromSeconds(1));
                await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["rating"] = "like" });
                rated.Add(outfit);
            }
        }

        factory.Stylist.Reset();
        await client.SuggestedAsync();

        var history = Assert.Single(factory.Stylist.Requests).Case.History;
        Assert.Equal(StylingHistory.Examples, history.Liked.Count);
        Assert.Equal(
            rated.AsEnumerable().Reverse().Take(5).Select(outfit => outfit.Items.Select(item => item.Clothing.Id).Order().ToArray()),
            history.Liked.Select(ids => ids.Order().ToArray()));
    }

    [Fact]
    public void The_system_prompt_is_a_versioned_file_that_travels_with_the_assembly()
    {
        var prompt = StylistPrompt.System;

        Assert.Equal("stylist-v3", StylistPrompt.Version);
        Assert.Equal(StylistPrompt.Version, new FakeOutfitStylist().PromptVersion);
        // The three kinds under the names of the answer schema, the reasoning in English, and the rules of tone.
        string[] expected = ["sure_bet", "discovery", "new_pairing", "one_piece", "weather_note", "base_item", "in English", "second person", "gender", "No emoji"];
        Assert.All(expected, words => Assert.Contains(words, prompt, StringComparison.Ordinal));
        Assert.DoesNotContain('—', prompt);
    }

    [Fact]
    public void A_stylist_that_does_not_exist_yet_stops_the_application_from_starting()
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder.UseSetting("Providers:OutfitStylist", "Claude"));

        var failure = Assert.Throws<InvalidOperationException>(() => misconfigured.CreateClient());

        Assert.Contains("Providers:OutfitStylist is 'Claude'", failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_contract_of_the_stylist_is_typed_in_the_openapi_document()
    {
        var document = await factory.CreateClient().GetFromJsonAsync<JsonObject>("/openapi/v1.json");

        var paths = document!["paths"]!;
        Assert.Equal("suggestOutfits", paths["/api/outfits/suggestions"]!["post"]!["operationId"]!.GetValue<string>());
        Assert.Equal("listOutfits", paths["/api/outfits"]!["get"]!["operationId"]!.GetValue<string>());
        Assert.Equal("getOutfit", paths["/api/outfits/{id}"]!["get"]!["operationId"]!.GetValue<string>());
        Assert.Equal("updateOutfit", paths["/api/outfits/{id}"]!["patch"]!["operationId"]!.GetValue<string>());
        Assert.Equal("deleteOutfit", paths["/api/outfits/{id}"]!["delete"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["200", "400", "401", "409", "429", "503"], paths["/api/outfits/suggestions"]!["post"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        Assert.Equal(["200", "400", "401", "404"], paths["/api/outfits/{id}"]!["patch"]!["responses"]!.AsObject().Select(response => response.Key).Order());

        var schemas = document["components"]!["schemas"]!.AsObject();
        Assert.Equal(["proposed", "missing_garments"], schemas["SuggestionStatus"]!["enum"]!.AsArray().Select(value => value!.GetValue<string>()));
        Assert.Equal(["everyday", "work", "business", "date", "friends", "workout"], schemas["Occasion"]!["enum"]!.AsArray().Select(value => value!.GetValue<string>()));
        Assert.Equal(["sure_bet", "discovery", "new_pairing"], EnumOf(schemas, "OutfitKind"));
        Assert.Equal(["none", "like", "dislike"], schemas["OutfitRating"]!["enum"]!.AsArray().Select(value => value!.GetValue<string>()));
        Assert.Equal(["formality", "style", "warmth"], schemas["RelaxedRule"]!["enum"]!.AsArray().Select(value => value!.GetValue<string>()));
        Assert.Contains("outfits", schemas["SuggestionsResponse"]!["properties"]!.AsObject().Select(property => property.Key));
        Assert.Contains("missing", schemas["SuggestionsResponse"]!["properties"]!.AsObject().Select(property => property.Key));
    }

    /// <summary>A nullable enum may be published under its own name or with a "Nullable" prefix, with null among the values.</summary>
    private static IEnumerable<string> EnumOf(JsonObject schemas, string name) =>
        (schemas[name] ?? schemas[$"NullableOf{name}"])!["enum"]!.AsArray().Where(value => value is not null).Select(value => value!.GetValue<string>());

    private static void AssertComposedByRules(SuggestionsResponse answer)
    {
        Assert.Equal(SuggestionStatus.Proposed, answer.Status);
        Assert.True(answer.Fallback);
        Assert.Equal(3, answer.Outfits.Count);
        Assert.Equal(answer.Outfits.Select(outfit => outfit.Score).OrderDescending(), answer.Outfits.Select(outfit => outfit.Score));
        Assert.All(answer.Outfits, outfit =>
        {
            Assert.Equal(OutfitSource.Rules, outfit.Source);
            Assert.False(string.IsNullOrWhiteSpace(outfit.Reasoning));
            Assert.Contains(outfit.Items, item => item.Slot == Category.Shoes);
        });
    }

    private Task<List<AiUsageEntry>> StylingSpendAsync(Guid userId) => factory.WithDatabaseAsync(db =>
        db.AiUsage.AsNoTracking().Where(entry => entry.UserId == userId && entry.Operation == AiOperation.Styling).OrderBy(entry => entry.Id).ToListAsync());
}
