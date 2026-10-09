using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Weather;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

/// <summary>Today's picks: one set per person, day and occasion, made on the first visit and kept for the rest of the day.</summary>
[Collection(ApiTests.Name)]
public sealed class TodaysPicksApiTests(ApiFactory factory)
{
    [Fact]
    public async Task The_first_visit_of_the_day_makes_the_picks_and_later_visits_get_the_same_ones()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.AnswersWell(cost: 0.02m);

        var first = await client.TodaysAsync();
        var again = await client.TodaysAsync();

        Assert.Equal(SuggestionStatus.Proposed, first.Status);
        Assert.Equal(3, first.Outfits.Count);
        Assert.Equal(first.Outfits.Select(outfit => outfit.Id), again.Outfits.Select(outfit => outfit.Id));
        Assert.Equal(SuggestionStatus.Proposed, again.Status);
        Assert.Equal((Occasion.Everyday, false, "Gliwice"), (again.Occasion, again.Fallback, again.Weather.Place));
        Assert.All(again.Outfits, outfit => Assert.Equal((Occasion.Everyday, (string?)null), (outfit.Occasion, outfit.OccasionNote)));

        // One model call, one count against the day's limit, one line in the ledger.
        Assert.Single(factory.Stylist.Requests);
        Assert.Equal(1, await UsedAsync(client));
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.AiUsage.CountAsync(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.Styling)));
        Assert.Equal(3, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task Every_occasion_has_its_own_picks()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);

        var everyday = await client.TodaysAsync();
        var friends = await client.TodaysAsync("friends");
        var friendsAgain = await client.TodaysAsync("friends");

        Assert.All(friends.Outfits, outfit => Assert.Equal(Occasion.Friends, outfit.Occasion));
        Assert.Empty(everyday.Outfits.Select(outfit => outfit.Id).Intersect(friends.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(friends.Outfits.Select(outfit => outfit.Id), friendsAgain.Outfits.Select(outfit => outfit.Id));
        Assert.Equal(2, factory.Stylist.Requests.Count);
        Assert.Equal(2, await UsedAsync(client));
    }

    [Fact]
    public async Task Opening_the_app_several_times_at_once_still_makes_one_set()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);

        var answers = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => client.TodaysAsync()));

        Assert.All(answers, answer => Assert.Equal(answers[0].Outfits.Select(outfit => outfit.Id), answer.Outfits.Select(outfit => outfit.Id)));
        Assert.Single(factory.Stylist.Requests);
        Assert.Equal(1, await UsedAsync(client));
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Outfits.Where(outfit => outfit.UserId == auth.User.Id).Select(outfit => outfit.RequestId).Distinct().CountAsync()));
    }

    [Fact]
    public async Task A_fresh_set_replaces_todays_picks_and_counts_as_a_request()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var first = await client.TodaysAsync();

        var fresh = await client.TodaysAsync(fresh: true);
        var later = await client.TodaysAsync();

        Assert.Empty(first.Outfits.Select(outfit => outfit.Id).Intersect(fresh.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(fresh.Outfits.Select(outfit => outfit.Id), later.Outfits.Select(outfit => outfit.Id));
        Assert.Equal(2, factory.Stylist.Requests.Count);
        Assert.Equal(2, await UsedAsync(client));
    }

    [Fact]
    public async Task Proposals_asked_for_elsewhere_are_not_todays_picks()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var styled = await client.SuggestedAsync(baseItemId: wardrobe[0].Id);

        var picks = await client.TodaysAsync();

        Assert.Empty(styled.Outfits.Select(outfit => outfit.Id).Intersect(picks.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(2, factory.Stylist.Requests.Count);
    }

    [Fact]
    public async Task The_next_day_gets_new_picks()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var today = await client.TodaysAsync();

        factory.Clock.Advance(TimeSpan.FromDays(1));
        client = await factory.SignInAgainAsync(auth);
        var tomorrow = await client.TodaysAsync();

        Assert.Empty(today.Outfits.Select(outfit => outfit.Id).Intersect(tomorrow.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(2, factory.Stylist.Requests.Count);
        // The count started again with the day.
        Assert.Equal(1, await UsedAsync(client));
    }

    [Fact]
    public async Task Picks_that_were_all_deleted_are_made_again_and_a_remaining_one_is_kept()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var first = await client.TodaysAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/outfits/{first.Outfits[0].Id}")).StatusCode);
        var fewer = await client.TodaysAsync();
        Assert.Equal(first.Outfits.Skip(1).Select(outfit => outfit.Id), fewer.Outfits.Select(outfit => outfit.Id));

        foreach (var outfit in fewer.Outfits)
        {
            await client.DeleteAsync($"/api/outfits/{outfit.Id}");
        }

        var made = await client.TodaysAsync();
        Assert.Equal(3, made.Outfits.Count);
        Assert.Equal(2, factory.Stylist.Requests.Count);
    }

    [Fact]
    public async Task The_daily_limit_holds_for_the_picks_and_kept_ones_are_still_served_after_it_is_used_up()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:SuggestionsPerDay", "2"));
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

        var everyday = await client.TodaysAsync();
        await client.TodaysAsync(fresh: true);

        var refusedFresh = await client.TodayAsync(fresh: true);
        Assert.Equal(HttpStatusCode.TooManyRequests, refusedFresh.StatusCode);
        var problem = await refusedFresh.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(("limit_reached", "suggestion", 2), (problem!["code"]!.GetValue<string>(), problem["kind"]!.GetValue<string>(), problem["limit"]!.GetValue<int>()));
        // Another occasion has no picks yet and none can be made today.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.TodayAsync("friends")).StatusCode);
        // What was made is still there.
        var kept = await client.TodaysAsync();
        Assert.NotEmpty(kept.Outfits);
        Assert.Empty(everyday.Outfits.Select(outfit => outfit.Id).Intersect(kept.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(2, factory.Stylist.Requests.Count);
        Assert.Equal(new UsageLineResponse(2, 2), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions);
    }

    [Fact]
    public async Task A_wardrobe_that_cannot_dress_the_person_gets_what_is_missing_and_nothing_is_kept_or_counted()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, [Tee]);

        var answer = await client.TodaysAsync();
        await client.TodaysAsync();

        Assert.Equal(SuggestionStatus.MissingGarments, answer.Status);
        Assert.Empty(answer.Outfits);
        Assert.Contains(Category.Shoes, answer.Missing);
        Assert.Empty(factory.Stylist.Requests);
        Assert.Equal(0, await UsedAsync(client));
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(outfit => outfit.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task When_the_model_cannot_be_used_the_rules_make_the_picks_and_they_are_kept_too()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.Fails();

        var first = await client.TodaysAsync();
        var again = await client.TodaysAsync();

        Assert.True(first.Fallback);
        Assert.True(again.Fallback);
        Assert.All(again.Outfits, outfit => Assert.Equal(OutfitSource.Rules, outfit.Source));
        Assert.Equal(first.Outfits.Select(outfit => outfit.Id), again.Outfits.Select(outfit => outfit.Id));
        Assert.Single(factory.Stylist.Requests);
    }

    [Fact]
    public async Task Nobody_gets_another_persons_picks()
    {
        var (mine, _, _) = await factory.DressedAsync(Warm, Basics);
        var picks = await mine.TodaysAsync();
        var (other, _) = await factory.SignedInWithConsentAsync();
        await factory.DressAsync(other, Tee, Jeans, Sneakers);

        var theirs = await other.TodaysAsync();

        Assert.NotEmpty(theirs.Outfits);
        Assert.Empty(picks.Outfits.Select(outfit => outfit.Id).Intersect(theirs.Outfits.Select(outfit => outfit.Id)));
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/outfits/{picks.Outfits[0].Id}")).StatusCode);
        Assert.Equal(picks.Outfits.Select(outfit => outfit.Id), (await mine.TodaysAsync()).Outfits.Select(outfit => outfit.Id));
    }

    [Fact]
    public async Task The_picks_need_a_signed_in_person_an_occasion_a_place_and_a_forecast()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().TodayAsync()).StatusCode);

        factory.FreshWeather();
        factory.Stylist.Reset();
        var (nowhere, _) = await factory.SignedInAsync(body => body.Remove("location"));
        var noPlace = await nowhere.TodayAsync();
        Assert.Equal(HttpStatusCode.Conflict, noPlace.StatusCode);
        Assert.Equal("location_missing", await noPlace.ProblemCodeAsync());

        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJsonAsync("/api/outfits/suggestions/today", new JsonObject())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.TodayAsync("gala")).StatusCode);

        factory.FreshWeather().Down = true;
        var noForecast = await client.TodayAsync();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, noForecast.StatusCode);
        Assert.Equal("weather_unavailable", await noForecast.ProblemCodeAsync());
        Assert.Equal(0, await UsedAsync(client));
        Assert.Empty(factory.Stylist.Requests);
        factory.FreshWeather();
    }

    private static async Task<int> UsedAsync(HttpClient client) => (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Suggestions.Used;
}
