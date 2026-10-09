using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Visualizations;
using FitIt.Tests.Support;
using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Visualizations;

/// <summary>An image of an outfit on the person's silhouette, ordered and fetched later (product spec 7).</summary>
[Collection(ApiTests.Name)]
public sealed class VisualizationTests(ApiFactory factory)
{
    // ---- the order -------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Visualizations_need_a_signed_in_person()
    {
        var client = factory.CreateClient();

        var ordered = await Order(client, Guid.NewGuid());
        var read = await client.GetAsync($"/api/visualizations/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, ordered.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, read.StatusCode);
    }

    [Fact]
    public async Task An_order_is_recorded_as_pending_counted_and_handed_to_the_background()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();

        var response = await Order(client, outfit.Id);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var visualization = await response.ReadAsync<VisualizationResponse>();
        Assert.Equal($"/api/visualizations/{visualization.Id}", response.Headers.Location?.OriginalString);
        Assert.Equal((outfit.Id, VisualizationStatus.Pending), (visualization.OutfitId, visualization.Status));
        Assert.Null(visualization.ImageUrl);
        Assert.Null(visualization.ImageKey);
        Assert.Null(visualization.ErrorCode);
        Assert.Null(visualization.CompletedAt);
        Assert.Equal(1, factory.Jobs.PendingCount);
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        Assert.Equal(visualization, await (await client.GetAsync($"/api/visualizations/{visualization.Id}")).ReadAsync<VisualizationResponse>());

        var stored = await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == visualization.Id));
        Assert.Equal((auth.User.Id, auth.User.Avatar.Id), (stored.UserId, stored.AvatarId));
        Assert.Null(stored.ProviderRequestId);
        Assert.Equal(0, factory.Visualizer.SubmitCalls);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("has spaces in it 123")]
    [InlineData("zażółć-gęślą-jaźń-1234")]
    [InlineData("0123456789012345678901234567890123456789012345678901234567890123456789")]
    public async Task A_key_that_is_not_a_plain_identifier_is_refused(string key)
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();

        var response = await Order(client, outfit.Id, key);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("idempotency_key_invalid", await response.ProblemCodeAsync());
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task An_order_without_a_key_is_refused()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();

        var response = await client.PostAsync($"/api/outfits/{outfit.Id}/visualizations", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    // ---- success ---------------------------------------------------------------------------------------------------

    [Fact]
    public async Task The_job_orders_the_picture_stores_it_under_the_persons_prefix_and_logs_its_cost()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync("kolacja z klientem");
        factory.Visualizer.Completes(0.08m);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var done = await (await client.GetAsync($"/api/visualizations/{order.Id}")).ReadAsync<VisualizationResponse>();
        var key = $"u/{auth.User.Id:N}/viz/{order.Id:N}.jpg";
        Assert.Equal(VisualizationStatus.Completed, done.Status);
        Assert.Equal(key, done.ImageKey);
        Assert.Contains(key, done.ImageUrl, StringComparison.Ordinal);
        Assert.NotNull(done.CompletedAt);
        Assert.Null(done.ErrorCode);
        Assert.Equal(TestApi.Jpeg(512), await factory.Storage.ReadAsync(key, null, CancellationToken.None));

        var stored = await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id));
        Assert.StartsWith("scripted-", stored.ProviderRequestId, StringComparison.Ordinal);
        Assert.Equal((ScriptedVisualizer.ModelName, VisualizationPrompt.Version, 0.08m), (stored.Model, stored.PromptVersion, stored.CostUsd));

        var log = await factory.WithDatabaseAsync(db => db.AiUsage.Where(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.Visualization).ToListAsync());
        var entry = Assert.Single(log);
        Assert.Equal((ScriptedVisualizer.ModelName, 0.08m, true), (entry.Model, entry.CostUsd, entry.Success));
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task The_provider_gets_the_silhouette_and_the_cutouts_as_signed_addresses_and_a_prompt_made_only_of_descriptions()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync("kolacja z klientem");
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var sent = Assert.Single(factory.Visualizer.Orders);
        var silhouette = $"u/{auth.User.Id:N}/sil/{auth.User.Avatar.Id:N}.jpg";
        Assert.Equal(silhouette, sent.Silhouette.Key);
        Assert.Contains(silhouette, sent.Silhouette.Url.AbsoluteUri, StringComparison.Ordinal);
        Assert.Equal([0xFF, 0xD8, 0xFF], (await factory.Storage.ReadAsync(silhouette, 3, CancellationToken.None)).Select(value => (int)value));

        // The garments come in the order of the roles, each as the cutout the app shows.
        Assert.Equal(outfit.Items.Select(item => item.Clothing.ImageKey), sent.Garments.Select(garment => garment.Key));
        Assert.All(sent.Garments, garment => Assert.Contains(garment.Key, garment.Url.AbsoluteUri, StringComparison.Ordinal));

        var descriptions = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().Where(item => item.UserId == auth.User.Id).ToDictionaryAsync(item => item.Id, item => item.Description));
        var lines = outfit.Items.Select((item, index) => $"{index + 2}: {descriptions[item.Clothing.Id]} ({EnumCodes.ToCode(item.Slot).Replace('_', ' ')})");
        Assert.StartsWith("Image 1 shows a person. The other images show individual garments:\n" + string.Join('\n', lines) + "\nGenerate a photorealistic", sent.Prompt, StringComparison.Ordinal);
        Assert.EndsWith("whole body visible including shoes.", sent.Prompt, StringComparison.Ordinal);
        Assert.DoesNotContain("{garments}", sent.Prompt, StringComparison.Ordinal);
        Assert.DoesNotContain("kolacja", sent.Prompt, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_prompt_carries_size_and_leg_length_as_neutral_hints_when_the_profile_has_them()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        await client.PatchJsonAsync("/api/me", new JsonObject { ["clothingSize"] = "m", ["legLength"] = "longer" });
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var sent = Assert.Single(factory.Visualizer.Orders);
        Assert.Contains("usual clothing size M, longer legs", sent.Prompt, StringComparison.Ordinal);
        Assert.DoesNotContain("{fit}", sent.Prompt, StringComparison.Ordinal);
        Assert.EndsWith("whole body visible including shoes.", sent.Prompt, StringComparison.Ordinal);
        Assert.Equal("visualizer-v2", VisualizationPrompt.Version);
    }

    [Fact]
    public async Task Without_size_and_leg_length_the_prompt_has_no_fit_line()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var sent = Assert.Single(factory.Visualizer.Orders);
        Assert.DoesNotContain("Fit notes", sent.Prompt, StringComparison.Ordinal);
        Assert.DoesNotContain("{fit}", sent.Prompt, StringComparison.Ordinal);
        Assert.DoesNotContain("\n\n", sent.Prompt, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(ClothingSize.Xs, null, "usual clothing size XS")]
    [InlineData(null, LegLength.Shorter, "shorter legs")]
    [InlineData(ClothingSize.Xxl, LegLength.Average, "usual clothing size XXL, average legs")]
    [InlineData(null, null, null)]
    public void The_fit_hint_is_made_from_the_two_codes_only(ClothingSize? size, LegLength? legs, string? expected)
    {
        Assert.Equal(expected, VisualizationPrompt.FitHint(size, legs));
    }

    [Fact]
    public async Task At_most_two_accessories_are_sent()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset().Answers(request =>
        {
            var candidates = request.Case.Candidates;
            string First(Category role) => candidates.Items.First(candidate => candidate.Garment.Role == role).Alias;
            var accessories = candidates.Items.Where(candidate => candidate.Garment.Role == Category.Accessory).Select(candidate => candidate.Alias).ToList();
            return [new StylistOutfit(OutfitKind.SureBet, First(Category.Top), null, First(Category.Bottom), null, null, First(Category.Shoes), accessories, "Z trzema paskami.", null)];
        });
        var weather = factory.FreshWeather();
        (weather.Low, weather.High) = (Warm, Warm);
        var (client, _) = await factory.SignedInWithConsentAsync();
        await factory.DressAsync(client, Tee, Jeans, Sneakers, Belt, Belt with { Name = "Black belt", Colors = [Color.Black] }, Belt with { Name = "Gray belt", Colors = [Color.Grey] });
        factory.Visualizer.Reset();
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        Assert.Equal(6, outfit.Items.Count);

        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);

        var sent = Assert.Single(factory.Visualizer.Orders);
        Assert.Equal(5, sent.Garments.Count);
        Assert.Equal(2, sent.Garments.Count(garment => outfit.Items.Single(item => item.Clothing.ImageKey == garment.Key).Slot == Category.Accessory));
    }

    [Fact]
    public async Task The_outfit_carries_its_newest_visualization()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        Assert.Null((await GetOutfit(client, outfit.Id)).Visualization);

        var first = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        var pending = (await GetOutfit(client, outfit.Id)).Visualization!;
        Assert.Equal((first.Id, VisualizationStatus.Pending, null), (pending.Id, pending.Status, pending.ImageUrl));

        await factory.RunVisualizationAsync(first.Id);
        var completed = (await GetOutfit(client, outfit.Id)).Visualization!;
        Assert.Equal((first.Id, VisualizationStatus.Completed), (completed.Id, completed.Status));
        Assert.Contains(completed.ImageKey!, completed.ImageUrl, StringComparison.Ordinal);

        // A newer visualization replaces it in the outfit, in the list as well as when read alone.
        factory.Clock.Advance(TimeSpan.FromSeconds(1));
        factory.Visualizer.Blocks();
        var second = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(second.Id);
        var listed = (await (await client.GetAsync("/api/outfits")).ReadAsync<List<OutfitResponse>>()).Single(found => found.Id == outfit.Id).Visualization!;
        Assert.Equal((second.Id, VisualizationStatus.Blocked, null), (listed.Id, listed.Status, listed.ImageUrl));
        Assert.Equal(second.Id, (await GetOutfit(client, outfit.Id)).Visualization!.Id);
    }

    [Fact]
    public async Task A_picture_that_takes_a_few_polls_is_waited_for_without_ordering_again()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.Queued().StaysRunning(2);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        factory.Jobs.Clear();

        // Every run asks once and, while the picture is not there, schedules the next one.
        for (var poll = 1; poll <= 3; poll++)
        {
            await factory.RunVisualizationAsync(order.Id);
            Assert.Equal(poll, factory.Visualizer.StatusCalls);
            Assert.Equal(VisualizationStatus.Running, (await Read(client, order.Id)).Status);
            Assert.Equal(poll, factory.Jobs.PendingCount);
        }

        await factory.RunVisualizationAsync(order.Id);

        Assert.Equal(VisualizationStatus.Completed, (await Read(client, order.Id)).Status);
        Assert.Equal(1, factory.Visualizer.SubmitCalls);
    }

    // ---- failure, block, timeout: the allowance comes back ---------------------------------------------------------

    [Fact]
    public async Task A_blocked_picture_is_an_ordinary_outcome_and_gives_the_allowance_back()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.Blocks(0.02m);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);

        await factory.RunVisualizationAsync(order.Id);

        var blocked = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Blocked, VisualizationErrors.ContentBlocked), (blocked.Status, blocked.ErrorCode));
        Assert.Null(blocked.ImageUrl);
        Assert.NotNull(blocked.CompletedAt);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        Assert.Equal(0, factory.Visualizer.ResultCalls);
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith($"u/{auth.User.Id:N}/viz/", StringComparison.Ordinal));
        var entry = Assert.Single(await LogAsync(auth.User.Id));
        Assert.Equal((0.02m, false), (entry.CostUsd, entry.Success));
    }

    [Fact]
    public async Task A_provider_that_reports_failure_ends_the_order_and_gives_the_allowance_back()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.ReportsFailure();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var failed = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.ProviderFailed), (failed.Status, failed.ErrorCode));
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        Assert.False(Assert.Single(await LogAsync(auth.User.Id)).Success);
    }

    [Fact]
    public async Task An_order_the_provider_keeps_refusing_is_retried_and_then_given_up()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.SubmitFails(3);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        // Two failures are handed back to the worker for a retry; the third is the last and is absorbed.
        await Assert.ThrowsAsync<ProviderException>(() => factory.RunVisualizationAsync(order.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.RunVisualizationAsync(order.Id));
        Assert.Equal(VisualizationStatus.Pending, (await Read(client, order.Id)).Status);
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        await factory.RunVisualizationAsync(order.Id);

        var failed = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.ProviderFailed), (failed.Status, failed.ErrorCode));
        Assert.Equal(3, factory.Visualizer.SubmitCalls);
        Assert.Empty(factory.Visualizer.Orders);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        Assert.Equal(3, (await LogAsync(auth.User.Id)).Count(entry => !entry.Success));
    }

    [Fact]
    public async Task An_order_that_does_not_come_back_in_three_minutes_fails_and_gives_the_allowance_back()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.StaysRunning(10);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);
        factory.Clock.Advance(TimeSpan.FromMinutes(2));
        client = await factory.SignInAgainAsync(auth);
        await factory.RunVisualizationAsync(order.Id);
        Assert.Equal(VisualizationStatus.Running, (await Read(client, order.Id)).Status);
        Assert.Equal(2, factory.Visualizer.StatusCalls);

        factory.Clock.Advance(TimeSpan.FromSeconds(61));
        client = await factory.SignInAgainAsync(auth);
        await factory.RunVisualizationAsync(order.Id);

        var failed = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.TimedOut), (failed.Status, failed.ErrorCode));
        Assert.Equal(2, factory.Visualizer.StatusCalls);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        Assert.False(Assert.Single(await LogAsync(auth.User.Id)).Success);

        // Final is final: a late run does nothing.
        await factory.RunVisualizationAsync(order.Id);
        Assert.Equal(2, factory.Visualizer.StatusCalls);
    }

    [Fact]
    public async Task What_the_provider_hands_over_must_be_a_picture()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.ReturnsGarbage();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        var failed = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.InvalidImage), (failed.Status, failed.ErrorCode));
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith($"u/{auth.User.Id:N}/viz/", StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_allowance_goes_back_to_the_day_it_was_taken_from()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.StaysRunning(10);
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        var takenOn = await factory.WithDatabaseAsync(db => db.Visualizations.Where(found => found.Id == order.Id).Select(found => found.UsageDay).SingleAsync());

        // By the time the order times out another day has begun where the person is.
        factory.Clock.Advance(TimeSpan.FromHours(26));
        await factory.RunVisualizationAsync(order.Id);

        var counters = await factory.WithDatabaseAsync(db => db.UsageCounters.AsNoTracking().Where(counter => counter.UserId == auth.User.Id && counter.Kind == UsageKind.Visualization).ToListAsync());
        var counter = Assert.Single(counters);
        Assert.Equal((takenOn, 0), (counter.Day, counter.Count));
        client = await factory.SignInAgainAsync(auth);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    // ---- a retried job resumes -------------------------------------------------------------------------------------

    [Fact]
    public async Task A_job_that_runs_again_after_a_crash_asks_about_the_order_and_never_places_another()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.PollCrashes();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        // The order was placed and its id stored; then the worker died while asking about it.
        await Assert.ThrowsAsync<InvalidOperationException>(() => factory.RunVisualizationAsync(order.Id));
        var midway = await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id));
        Assert.NotNull(midway.ProviderRequestId);
        Assert.Equal(VisualizationStatus.Running, midway.Status);

        await factory.RunVisualizationAsync(order.Id);

        Assert.Equal(1, factory.Visualizer.SubmitCalls);
        Assert.Equal(midway.ProviderRequestId, (await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id))).ProviderRequestId);
        Assert.Equal(VisualizationStatus.Completed, (await Read(client, order.Id)).Status);
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        Assert.Single(await LogAsync(auth.User.Id), entry => entry.Success);
    }

    [Fact]
    public async Task A_job_that_runs_again_after_the_end_does_nothing()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        var before = await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id));

        await factory.RunVisualizationAsync(order.Id);
        await factory.RunVisualizationAsync(Guid.NewGuid());

        Assert.Equal((1, 1, 1), (factory.Visualizer.SubmitCalls, factory.Visualizer.StatusCalls, factory.Visualizer.ResultCalls));
        Assert.Equal(before.UpdatedAt, (await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id))).UpdatedAt);
        Assert.Single(await LogAsync(auth.User.Id));
    }

    [Fact]
    public async Task A_provider_that_cannot_say_how_the_order_stands_is_asked_again_until_the_time_limit()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.PollFails();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);
        Assert.Equal(VisualizationStatus.Running, (await Read(client, order.Id)).Status);
        await factory.RunVisualizationAsync(order.Id);

        Assert.Equal((1, 2), (factory.Visualizer.SubmitCalls, factory.Visualizer.StatusCalls));
        Assert.Equal(VisualizationStatus.Completed, (await Read(client, order.Id)).Status);
    }

    [Fact]
    public async Task The_sweep_runs_the_job_again_for_an_order_that_stopped_moving_and_leaves_fresh_and_finished_ones_alone()
    {
        var (client, auth, outfits) = await PersonWithOutfitsAsync();
        var lost = await (await Order(client, outfits[0].Id)).ReadAsync<VisualizationResponse>();
        var finished = await VisualizeAsync(client, outfits[1].Id);
        factory.Jobs.Clear();

        // The job of the first order was lost. Fresh, it is not touched.
        await SweepAsync();
        await factory.Jobs.RunPendingAsync();
        Assert.Equal(VisualizationStatus.Pending, (await Read(client, lost.Id)).Status);

        factory.Clock.Advance(VisualizationMaintenance.StuckAfter + TimeSpan.FromSeconds(1));
        await SweepAsync();
        await factory.Jobs.RunPendingAsync();

        client = await factory.SignInAgainAsync(auth);
        Assert.Equal(VisualizationStatus.Completed, (await Read(client, lost.Id)).Status);
        // The finished one was never run again: it was ordered from the provider once, like the other.
        Assert.Equal(2, factory.Visualizer.SubmitCalls);
        Assert.Equal(finished.ImageKey, (await Read(client, finished.Id)).ImageKey);
    }

    // ---- idempotency and limits ------------------------------------------------------------------------------------

    [Fact]
    public async Task The_same_key_is_the_same_order_counted_and_sent_once()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        const string key = "tap-0001-same-key";

        var first = await Order(client, outfit.Id, key);
        var again = await Order(client, outfit.Id, key);

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        var created = await first.ReadAsync<VisualizationResponse>();
        Assert.Equal(created, await again.ReadAsync<VisualizationResponse>());
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        Assert.Equal(1, factory.Jobs.PendingCount);

        await factory.RunVisualizationAsync(created.Id);
        // Even when the picture is already there, the same key still gives that picture and orders nothing.
        var late = await Order(client, outfit.Id, key);
        Assert.Equal(HttpStatusCode.OK, late.StatusCode);
        Assert.Equal((created.Id, VisualizationStatus.Completed), ((await late.ReadAsync<VisualizationResponse>()).Id, VisualizationStatus.Completed));
        Assert.Equal(1, factory.Visualizer.SubmitCalls);
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.UserId == auth.User.Id)));
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task The_same_key_arriving_many_times_at_once_still_makes_one_order()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        const string key = "tap-0002-parallel";

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Order(client, outfit.Id, key)));

        Assert.All(responses, response => Assert.True(response.StatusCode is HttpStatusCode.Accepted or HttpStatusCode.OK, response.StatusCode.ToString()));
        var ids = (await Task.WhenAll(responses.Select(response => response.ReadAsync<VisualizationResponse>()))).Select(found => found.Id).Distinct().ToList();
        Assert.Single(ids);
        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Accepted));
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.UserId == auth.User.Id)));
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        Assert.Equal(1, factory.Jobs.PendingCount);
    }

    [Fact]
    public async Task A_key_used_for_one_outfit_cannot_order_another()
    {
        var (client, _, outfits) = await PersonWithOutfitsAsync();
        const string key = "tap-0003-reused";
        Assert.Equal(HttpStatusCode.Accepted, (await Order(client, outfits[0].Id, key)).StatusCode);

        var response = await Order(client, outfits[1].Id, key);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("idempotency_key_reused", await response.ProblemCodeAsync());
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task An_outfit_with_an_order_in_progress_is_not_ordered_a_second_time()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        var first = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        var second = await Order(client, outfit.Id);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(first.Id, (await second.ReadAsync<VisualizationResponse>()).Id);
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);

        // Once it is over, a new picture can be asked for, and is counted.
        await factory.RunVisualizationAsync(first.Id);
        var third = await Order(client, outfit.Id);
        Assert.Equal(HttpStatusCode.Accepted, third.StatusCode);
        Assert.NotEqual(first.Id, (await third.ReadAsync<VisualizationResponse>()).Id);
        Assert.Equal(2, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task The_daily_limit_refuses_the_next_order_until_tomorrow()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        var limit = (await Usage(client)).Visualizations.Limit;
        Assert.Equal(5, limit);
        for (var done = 0; done < limit; done++)
        {
            var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
            await factory.RunVisualizationAsync(order.Id);
            factory.Clock.Advance(TimeSpan.FromSeconds(1));
        }

        factory.Jobs.Clear();
        var refused = await Order(client, outfit.Id);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(("limit_reached", "visualization", limit), (problem!["code"]!.GetValue<string>(), problem["kind"]!.GetValue<string>(), problem["limit"]!.GetValue<int>()));
        Assert.Equal(limit, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.UserId == auth.User.Id)));
        Assert.Equal(0, factory.Jobs.PendingCount);
        Assert.Equal(limit, (await Usage(client)).Visualizations.Used);

        // The next day is a new allowance.
        factory.Clock.Advance(TimeSpan.FromDays(1));
        client = await factory.SignInAgainAsync(auth);
        Assert.Equal(HttpStatusCode.Accepted, (await Order(client, outfit.Id)).StatusCode);
    }

    [Fact]
    public async Task A_refused_order_that_was_not_made_costs_nothing_and_a_failed_one_frees_its_place()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        var limit = (await Usage(client)).Visualizations.Limit;
        // Every order of the day fails, so each gives its place back and the day never fills up.
        for (var done = 0; done < limit + 2; done++)
        {
            factory.Visualizer.ReportsFailure();
            var order = await Order(client, outfit.Id);
            Assert.Equal(HttpStatusCode.Accepted, order.StatusCode);
            await factory.RunVisualizationAsync((await order.ReadAsync<VisualizationResponse>()).Id);
            Assert.Equal(0, (await Usage(client)).Visualizations.Used);
        }
    }

    // ---- consent, budget -------------------------------------------------------------------------------------------

    [Fact]
    public async Task Without_consent_nothing_is_ordered()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        await client.GiveConsentAsync(false);

        var response = await Order(client, outfit.Id);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("consent_required", await response.ProblemCodeAsync());
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task Consent_withdrawn_while_an_order_waits_sends_nothing_out_and_gives_the_allowance_back()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await client.GiveConsentAsync(false);

        await factory.RunVisualizationAsync(order.Id);

        var failed = await Read(client, order.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.ConsentWithdrawn), (failed.Status, failed.ErrorCode));
        Assert.Equal(0, factory.Visualizer.SubmitCalls);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    [Fact]
    public async Task With_the_days_ai_budget_spent_visualizations_are_paused_and_nothing_is_counted()
    {
        var (client, auth, outfits) = await PersonWithOutfitsAsync();
        const string key = "tap-budget-waiting";
        var waiting = await (await Order(client, outfits[0].Id, key)).ReadAsync<VisualizationResponse>();
        using var broke = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:AiBudgetUsdPerDay", "0"));
        var poor = broke.CreateClient();
        poor.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);

        // A new order is refused up front, as a pause and not as an error of the person's.
        var paused = await Order(poor, outfits[1].Id);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, paused.StatusCode);
        Assert.Equal("visualizations_paused", await paused.ProblemCodeAsync());
        Assert.Equal(1, (await Usage(client)).Visualizations.Used);
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.UserId == auth.User.Id)));

        // An order that already exists is still theirs to ask about.
        var replay = await Order(poor, outfits[0].Id, key);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(waiting.Id, (await replay.ReadAsync<VisualizationResponse>()).Id);

        // An order that was waiting is given up when its turn comes with no budget left, and its place is freed.
        await factory.RunVisualizationAsync(waiting.Id, broke.Services);

        var failed = await Read(client, waiting.Id);
        Assert.Equal((VisualizationStatus.Failed, VisualizationErrors.BudgetExhausted), (failed.Status, failed.ErrorCode));
        Assert.Equal(0, factory.Visualizer.SubmitCalls);
        Assert.Equal(0, (await Usage(client)).Visualizations.Used);
    }

    // ---- somebody else's ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Somebody_elses_outfit_and_visualization_look_as_if_they_did_not_exist()
    {
        var (owner, _, outfit) = await PersonWithOutfitAsync();
        var order = await (await Order(owner, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        var (stranger, _) = await factory.SignedInWithConsentAsync();

        var responses = new[]
        {
            await Order(stranger, outfit.Id),
            await Order(stranger, Guid.NewGuid()),
            await stranger.GetAsync($"/api/visualizations/{order.Id}"),
            await stranger.GetAsync($"/api/visualizations/{Guid.NewGuid()}"),
        };

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        Assert.Equal(0, (await Usage(stranger)).Visualizations.Used);
        Assert.Equal(1, factory.Visualizer.SubmitCalls);
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.Visualizations.CountAsync(found => found.OutfitId == outfit.Id)));
        // The same key from two people is two unrelated orders: a key is private to its person.
        var (other, _, theirs) = await PersonWithOutfitAsync();
        var key = "shared-by-chance-1";
        Assert.Equal(HttpStatusCode.Accepted, (await Order(owner, outfit.Id, key)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await Order(other, theirs.Id, key)).StatusCode);
    }

    // ---- files go with their outfit --------------------------------------------------------------------------------

    [Fact]
    public async Task Deleting_an_outfit_deletes_the_pictures_made_for_it_and_only_those()
    {
        var (client, auth, outfits) = await PersonWithOutfitsAsync();
        var first = await VisualizeAsync(client, outfits[0].Id);
        var second = await VisualizeAsync(client, outfits[1].Id);
        var firstKey = first.ImageKey!;
        var secondKey = second.ImageKey!;
        var silhouette = $"u/{auth.User.Id:N}/sil/{auth.User.Avatar.Id:N}.jpg";
        Assert.True(factory.Storage.Contains(firstKey));

        var response = await client.DeleteAsync($"/api/outfits/{outfits[0].Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(factory.Storage.Contains(firstKey));
        Assert.True(factory.Storage.Contains(secondKey));
        Assert.True(factory.Storage.Contains(silhouette));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/visualizations/{first.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/visualizations/{second.Id}")).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_garment_deletes_the_outfits_that_contain_it_and_the_pictures_made_for_them()
    {
        var (client, _, outfits) = await PersonWithOutfitsAsync();
        var visualization = await VisualizeAsync(client, outfits[0].Id);
        var garment = outfits[0].Items[0].Clothing.Id;

        var response = await client.DeleteAsync($"/api/clothes/{garment}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(factory.Storage.Contains(visualization.ImageKey!));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/visualizations/{visualization.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/outfits/{outfits[0].Id}")).StatusCode);
    }

    [Fact]
    public async Task An_outfit_deleted_while_its_picture_is_being_fetched_leaves_no_file_behind()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        factory.Visualizer.CompletesAfter(async () => Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/outfits/{outfit.Id}")).StatusCode));
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();

        await factory.RunVisualizationAsync(order.Id);

        Assert.False(await factory.WithDatabaseAsync(db => db.Visualizations.AnyAsync(found => found.Id == order.Id)));
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith($"u/{auth.User.Id:N}/viz/", StringComparison.Ordinal));
    }

    [Fact]
    public async Task An_order_whose_outfit_was_deleted_before_the_job_ran_is_forgotten()
    {
        var (client, _, outfit) = await PersonWithOutfitAsync();
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await client.DeleteAsync($"/api/outfits/{outfit.Id}");

        await factory.RunVisualizationAsync(order.Id);

        Assert.Equal(0, factory.Visualizer.SubmitCalls);
    }

    [Fact]
    public async Task The_sweep_for_files_without_a_row_keeps_pictures_and_silhouettes_and_removes_strays()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        var visualization = await VisualizeAsync(client, outfit.Id);
        var stray = $"u/{auth.User.Id:N}/viz/{Guid.NewGuid():N}.jpg";
        factory.Storage.Put(stray, TestApi.Jpeg());

        factory.Clock.Advance(TimeSpan.FromDays(2));
        await factory.WithServicesAsync(services => services.GetRequiredService<FitIt.Infrastructure.Wardrobe.WardrobeMaintenance>().RemoveOrphansAsync());

        Assert.True(factory.Storage.Contains(visualization.ImageKey!));
        Assert.True(factory.Storage.Contains($"u/{auth.User.Id:N}/sil/{auth.User.Avatar.Id:N}.jpg"));
        Assert.False(factory.Storage.Contains(stray));
    }

    // ---- the fake provider -------------------------------------------------------------------------------------------

    [Fact]
    public async Task The_fake_provider_answers_after_the_configured_polls_with_a_real_picture()
    {
        var (client, auth, outfit) = await PersonWithOutfitAsync();
        using var fake = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IOutfitVisualizer>();
            services.AddSingleton<IOutfitVisualizer, FakeOutfitVisualizer>();
        }));
        var phone = fake.CreateClient();
        phone.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        var order = await (await Order(phone, outfit.Id)).ReadAsync<VisualizationResponse>();

        // The default is two polls in the queue, then done: the job runs three times, each run but the last scheduling the next.
        await factory.RunVisualizationAsync(order.Id, fake.Services);
        Assert.Equal(VisualizationStatus.Running, (await Read(phone, order.Id)).Status);
        await factory.RunVisualizationAsync(order.Id, fake.Services);
        Assert.Equal(VisualizationStatus.Running, (await Read(phone, order.Id)).Status);
        await factory.RunVisualizationAsync(order.Id, fake.Services);

        var done = await Read(phone, order.Id);
        Assert.Equal(VisualizationStatus.Completed, done.Status);
        var storage = fake.Services.GetRequiredService<InMemoryImageStorage>();
        var picture = await storage.ReadAsync(done.ImageKey!, null, CancellationToken.None);
        Assert.Equal([0xFF, 0xD8, 0xFF], picture.Take(3).Select(value => (int)value));
        Assert.Equal(await storage.ReadAsync($"u/{auth.User.Id:N}/sil/{auth.User.Avatar.Id:N}.jpg", null, CancellationToken.None), picture);
        Assert.Equal(FakeOutfitVisualizer.FakeModel, (await factory.WithDatabaseAsync(db => db.Visualizations.AsNoTracking().SingleAsync(found => found.Id == order.Id))).Model);
        Assert.Equal(0, factory.Visualizer.SubmitCalls);
    }

    [Fact]
    public async Task The_fake_provider_gives_the_same_order_the_same_id_and_keeps_to_its_own_orders()
    {
        var storage = new InMemoryImageStorage(TimeProvider.System);
        storage.Put("u/sil.jpg", TestApi.Jpeg(300));
        var fake = new FakeOutfitVisualizer(storage, Microsoft.Extensions.Options.Options.Create(new VisualizationOptions { FakePollsBeforeDone = 1 }));
        var input = new VisualizationInput("prompt", new ImageSource("u/sil.jpg", new Uri("https://x.test/sil")), [new ImageSource("u/cut/1.png", new Uri("https://x.test/1"))]);

        var id = await fake.SubmitAsync(input, CancellationToken.None);

        Assert.Equal(id, await fake.SubmitAsync(input, CancellationToken.None));
        Assert.NotEqual(id, await fake.SubmitAsync(input with { Prompt = "another" }, CancellationToken.None));
        Assert.Equal(ProviderJobState.Queued, (await fake.GetStatusAsync(id, CancellationToken.None)).State);
        Assert.Equal(ProviderJobState.Completed, (await fake.GetStatusAsync(id, CancellationToken.None)).State);
        Assert.Equal(TestApi.Jpeg(300), (await fake.GetResultAsync(id, CancellationToken.None)).Content);
        await Assert.ThrowsAsync<ProviderException>(() => fake.SubmitAsync(input with { Garments = [] }, CancellationToken.None));
        await Assert.ThrowsAsync<ProviderException>(() => fake.GetStatusAsync("somebody-elses-1", CancellationToken.None));
        await Assert.ThrowsAsync<ProviderException>(() => fake.GetResultAsync("fake-0123-!!!", CancellationToken.None));
    }

    [Theory]
    [InlineData("Providers:OutfitVisualizer", "Replicate")]
    [InlineData("Providers:Email", "Smtp")]
    public void A_provider_that_does_not_exist_yet_stops_the_application_from_starting(string setting, string value)
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder.UseSetting(setting, value));

        var failure = Assert.Throws<InvalidOperationException>(() => misconfigured.CreateClient());

        Assert.Contains($"{setting} is '{value}'", failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_contract_of_visualizations_is_typed_in_the_openapi_document()
    {
        var document = await factory.CreateClient().GetFromJsonAsync<JsonObject>("/openapi/v1.json");

        var paths = document!["paths"]!;
        var create = paths["/api/outfits/{id}/visualizations"]!["post"]!;
        Assert.Equal("createVisualization", create["operationId"]!.GetValue<string>());
        Assert.Equal(["200", "202", "400", "401", "403", "404", "409", "429", "503"], create["responses"]!.AsObject().Select(response => response.Key).Order());
        var header = Assert.Single(create["parameters"]!.AsArray(), parameter => parameter!["in"]!.GetValue<string>() == "header")!;
        Assert.Equal(("Idempotency-Key", true), (header["name"]!.GetValue<string>(), header["required"]!.GetValue<bool>()));
        Assert.Equal("getVisualization", paths["/api/visualizations/{id}"]!["get"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["200", "401", "404"], paths["/api/visualizations/{id}"]!["get"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        var statuses = document["components"]!["schemas"]!["VisualizationStatus"]!["enum"]!.AsArray().Select(value => value!.GetValue<string>());
        Assert.Equal(["pending", "running", "completed", "failed", "blocked"], statuses);
        Assert.Contains("visualization", document["components"]!["schemas"]!["OutfitResponse"]!["properties"]!.AsObject().Select(property => property.Key));
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private Task<int> SweepAsync() => factory.WithServicesAsync(services => services.GetRequiredService<VisualizationMaintenance>().RequeueStuckAsync());

    private async Task<(HttpClient Client, AuthResponse Auth, OutfitResponse Outfit)> PersonWithOutfitAsync(string? note = null)
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Visualizer.Reset();
        factory.Jobs.Clear();
        return (client, auth, (await client.SuggestedAsync("everyday", note)).Outfits[0]);
    }

    private async Task<(HttpClient Client, AuthResponse Auth, IReadOnlyList<OutfitResponse> Outfits)> PersonWithOutfitsAsync()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Visualizer.Reset();
        factory.Jobs.Clear();
        var outfits = (await client.SuggestedAsync()).Outfits;
        Assert.True(outfits.Count >= 2);
        Assert.True(outfits[0].Items.Select(item => item.Clothing.Id).Intersect(outfits[1].Items.Select(item => item.Clothing.Id)).Count() < outfits[0].Items.Count);
        return (client, auth, outfits);
    }

    private static Task<HttpResponseMessage> Order(HttpClient client, Guid outfitId, string? key = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfitId}/visualizations");
        request.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString("N"));
        return client.SendAsync(request);
    }

    /// <summary>Orders a picture and runs its job to the end.</summary>
    private async Task<VisualizationResponse> VisualizeAsync(HttpClient client, Guid outfitId)
    {
        var order = await (await Order(client, outfitId)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        var done = await Read(client, order.Id);
        Assert.Equal(VisualizationStatus.Completed, done.Status);
        return done;
    }

    private static async Task<VisualizationResponse> Read(HttpClient client, Guid id) => await (await client.GetAsync($"/api/visualizations/{id}")).ReadAsync<VisualizationResponse>();

    private static async Task<OutfitResponse> GetOutfit(HttpClient client, Guid id) => await (await client.GetAsync($"/api/outfits/{id}")).ReadAsync<OutfitResponse>();

    private static async Task<UsageResponse> Usage(HttpClient client) => await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();

    private Task<List<FitIt.Core.Usage.AiUsageEntry>> LogAsync(Guid userId) =>
        factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == userId && entry.Operation == AiOperation.Visualization).ToListAsync());
}
