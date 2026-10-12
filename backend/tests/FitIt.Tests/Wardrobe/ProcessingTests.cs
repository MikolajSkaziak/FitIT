using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Wardrobe;
using FitIt.Tests.Support;
using SkiaSharp;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Wardrobe;

/// <summary>The background job behind every new garment, driven with scripted AI providers (product spec 5.1 and 13).</summary>
[Collection(ApiTests.Name)]
public sealed class ProcessingTests(ApiFactory factory)
{
    [Fact]
    public async Task The_job_stores_a_cutout_tags_the_garment_and_makes_it_ready()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);

        await factory.ProcessAsync(added.Id);

        var garment = await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Ready, garment.Status);
        Assert.Equal("Navy oxford shirt", garment.Name);
        Assert.Equal(Category.Top, garment.Category);
        Assert.Equal(Subcategory.Shirt, garment.Subcategory);
        Assert.Equal([Color.Navy], garment.Colors);
        Assert.Equal(Pattern.Plain, garment.Pattern);
        Assert.Equal(Material.Cotton, garment.Material);
        Assert.Equal(4, garment.Formality);
        Assert.Equal(2, garment.Warmth);
        Assert.False(garment.RainOk);
        Assert.Equal([StyleTag.Smart, StyleTag.Elegant], garment.Styles);
        Assert.Equal($"u/{auth.User.Id:N}/cut/{added.Id:N}-tight.png", garment.ImageKey);
        Assert.Contains(garment.ImageKey!, garment.ImageUrl, StringComparison.Ordinal);
        Assert.Equal(ScriptedAi.Cutout, await factory.Storage.ReadAsync(garment.ImageKey!, null, CancellationToken.None));

        var stored = await factory.WithDatabaseAsync(db => db.Clothes.SingleAsync(item => item.Id == added.Id));
        Assert.Equal("navy blue oxford cotton shirt, button-down collar", stored.Description);
        Assert.True(factory.Storage.Contains(stored.OriginalKey));

        // The remover gets the photo, the tagger gets the cutout, each through an address of its own.
        Assert.Equal([stored.OriginalKey, stored.CutoutKey], factory.Ai.Seen.Select(source => source.Key));
        Assert.All(factory.Ai.Seen, source => Assert.Contains(source.Key, source.Url.AbsoluteUri, StringComparison.Ordinal));

        var log = await factory.WithDatabaseAsync(db => db.AiUsage.Where(entry => entry.UserId == auth.User.Id).OrderBy(entry => entry.CreatedAt).ThenBy(entry => entry.Operation).ToListAsync());
        Assert.Equal([AiOperation.BackgroundRemoval, AiOperation.Tagging], log.Select(entry => entry.Operation).Order());
        Assert.All(log, entry => Assert.True(entry.Success));
    }

    [Fact]
    public async Task A_garment_described_by_the_tagger_says_so_until_the_person_changes_its_tags()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        Assert.True(garment.DescribedByAi);

        var flagged = await (await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["inLaundry"] = true })).ReadAsync<ClothingResponse>();
        var renamed = await (await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["name"] = "My favourite" })).ReadAsync<ClothingResponse>();

        Assert.True(flagged.DescribedByAi);
        Assert.Equal("My favourite", renamed.Name);
        Assert.False(renamed.DescribedByAi);
    }

    [Fact]
    public async Task A_cutout_is_stored_cropped_to_the_garment()
    {
        factory.Ai.Reset().RemovalReturns(Pictures.Padded(640, 640, new SKRectI(200, 100, 400, 500)));
        var (client, _) = await factory.SignedInWithConsentAsync();

        var garment = await factory.AddProcessedGarmentAsync(client);

        using var stored = SKBitmap.Decode(await factory.Storage.ReadAsync(garment.ImageKey!, null, CancellationToken.None));
        Assert.Equal((216, 416), (stored.Width, stored.Height));
    }

    [Fact]
    public async Task Running_the_job_again_calls_no_provider_and_changes_nothing()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);
        await factory.ProcessAsync(added.Id);
        var before = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == added.Id));

        await factory.ProcessAsync(added.Id);
        await factory.ProcessAsync(Guid.NewGuid());

        Assert.Equal(1, factory.Ai.RemoverCalls);
        Assert.Equal(1, factory.Ai.TaggerCalls);
        var after = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == added.Id));
        Assert.Equal(before.UpdatedAt, after.UpdatedAt);
    }

    [Fact]
    public async Task A_job_interrupted_after_the_cutout_does_not_remove_the_background_twice()
    {
        factory.Ai.Reset().TaggingFails();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);

        // First run: the cutout is stored, tagging fails, the worker will retry.
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await factory.ProcessAsync(added.Id);

        Assert.Equal(1, factory.Ai.RemoverCalls);
        Assert.Equal(2, factory.Ai.TaggerCalls);
        Assert.Equal(ClothingStatus.Ready, (await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>()).Status);
    }

    [Fact]
    public async Task When_background_removal_keeps_failing_the_photo_itself_becomes_the_cutout()
    {
        factory.Ai.Reset().RemovalFails(3);
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);

        // Two failures are handed back to the worker for a retry; the third is the last and is absorbed.
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        Assert.Equal(ClothingStatus.Processing, (await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>()).Status);
        await factory.ProcessAsync(added.Id);

        var stored = await factory.WithDatabaseAsync(db => db.Clothes.SingleAsync(item => item.Id == added.Id));
        Assert.Equal(ClothingStatus.Ready, stored.Status);
        Assert.Equal(stored.OriginalKey, stored.CutoutKey);
        Assert.Equal(3, factory.Ai.RemoverCalls);
        Assert.Equal(1, factory.Ai.TaggerCalls);
        Assert.Equal(stored.OriginalKey, factory.Ai.Seen[^1].Key);
        var failures = await factory.WithDatabaseAsync(db => db.AiUsage.CountAsync(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.BackgroundRemoval && !entry.Success));
        Assert.Equal(3, failures);
    }

    [Fact]
    public async Task When_tagging_keeps_failing_the_garment_waits_for_tags_from_the_person()
    {
        factory.Ai.Reset().TaggingFails(3);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);

        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await factory.ProcessAsync(added.Id);

        var garment = await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Failed, garment.Status);
        Assert.Null(garment.Name);
        Assert.NotNull(garment.ImageUrl);
        Assert.Equal(1, factory.Ai.RemoverCalls);
        Assert.Equal(3, factory.Ai.TaggerCalls);

        // It is listed, so the person can see it and fill the tags in.
        Assert.Contains(await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>(), item => item.Id == added.Id);
    }

    [Fact]
    public async Task A_failed_garment_becomes_usable_once_all_tags_are_given_by_hand()
    {
        factory.Ai.Reset().TaggingFails(3);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await factory.ProcessAsync(added.Id);

        var partial = await client.PatchJsonAsync($"/api/clothes/{added.Id}", new JsonObject { ["name"] = "Black jeans", ["category"] = "bottom" });
        Assert.Equal(HttpStatusCode.BadRequest, partial.StatusCode);
        Assert.Equal("tags_incomplete", await partial.ProblemCodeAsync());

        var complete = await client.PatchJsonAsync($"/api/clothes/{added.Id}", new JsonObject
        {
            ["category"] = "bottom",
            ["subcategory"] = "jeans",
            ["name"] = "Black jeans",
            ["colors"] = new JsonArray("black"),
            ["pattern"] = "plain",
            ["material"] = "denim",
            ["formality"] = 2,
            ["warmth"] = 3,
            ["rainOk"] = false,
        });

        Assert.Equal(HttpStatusCode.OK, complete.StatusCode);
        var garment = await complete.ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Ready, garment.Status);
        Assert.Empty(garment.Styles);
        Assert.Equal("black denim jeans", await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == added.Id).Select(item => item.Description).SingleAsync()));
    }

    [Fact]
    public async Task An_answer_outside_the_dictionaries_is_treated_as_no_answer()
    {
        factory.Ai.Reset()
            .TaggingReturns(ScriptedAi.Shirt with { Subcategory = Subcategory.Jeans })
            .TaggingReturns(ScriptedAi.Shirt with { Formality = 9 });
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);

        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await factory.ProcessAsync(added.Id);

        var garment = await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Ready, garment.Status);
        Assert.Equal(Subcategory.Shirt, garment.Subcategory);
        var tagging = await factory.WithDatabaseAsync(db => db.AiUsage.Where(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.Tagging).Select(entry => entry.Success).ToListAsync());
        Assert.Equal(2, tagging.Count(success => !success));
        Assert.Equal(1, tagging.Count(success => success));
    }

    [Theory]
    [InlineData(RejectReason.NoGarment, "no_garment")]
    [InlineData(RejectReason.SeveralGarments, "several_garments")]
    [InlineData(RejectReason.UnderwearOrSwimwear, "underwear_or_swimwear")]
    public async Task A_photo_that_is_not_one_wearable_garment_never_enters_the_wardrobe(RejectReason reason, string code)
    {
        factory.Ai.Reset().TaggingRefuses(reason);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);
        var originalKey = await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == added.Id).Select(item => item.OriginalKey).SingleAsync());

        await factory.ProcessAsync(added.Id);

        // Not in the wardrobe, its statistics or its searches...
        Assert.Empty(await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>());
        Assert.Equal(0, (await (await client.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>()).Total);

        // ...but the upload queue can still ask what happened to it.
        var asked = Assert.Single(await (await client.GetAsync($"/api/clothes?ids={added.Id}")).ReadAsync<List<ClothingResponse>>());
        Assert.Equal(ClothingStatus.Rejected, asked.Status);
        Assert.Equal(reason, asked.RejectReason);
        Assert.Null(asked.ImageUrl);
        var raw = await (await client.GetAsync($"/api/clothes/{added.Id}")).Content.ReadAsStringAsync();
        Assert.Contains($"\"rejectReason\":\"{code}\"", raw, StringComparison.Ordinal);

        // The pictures are gone at once; the day's allowance is not given back.
        Assert.DoesNotContain(factory.Storage.Keys, key => key == originalKey || key.Contains($"{added.Id:N}", StringComparison.Ordinal));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);

        // It cannot be edited into a garment or tried again.
        Assert.Equal(HttpStatusCode.NotFound, (await client.PatchJsonAsync($"/api/clothes/{added.Id}", new JsonObject { ["inLaundry"] = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/clothes/{added.Id}/reprocess", null)).StatusCode);
    }

    [Fact]
    public async Task Consent_withdrawn_while_a_photo_waits_stops_anything_from_being_sent_out()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);
        await client.GiveConsentAsync(false);

        await factory.ProcessAsync(added.Id);

        Assert.Equal(0, factory.Ai.RemoverCalls);
        Assert.Equal(0, factory.Ai.TaggerCalls);
        Assert.Equal(ClothingStatus.Failed, (await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>()).Status);

        // Trying again needs the consent back.
        var refused = await client.PostAsync($"/api/clothes/{added.Id}/reprocess", null);
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal("consent_required", await refused.ProblemCodeAsync());
    }

    [Fact]
    public async Task Another_try_can_be_asked_for_and_puts_the_garment_back_in_the_queue()
    {
        factory.Ai.Reset().TaggingFails(3);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var added = await client.AddGarmentAsync(factory.Storage);
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(added.Id));
        await factory.ProcessAsync(added.Id);
        factory.Jobs.Clear();

        var response = await client.PostAsync($"/api/clothes/{added.Id}/reprocess", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ClothingStatus.Processing, (await response.ReadAsync<ClothingResponse>()).Status);
        Assert.Equal(1, factory.Jobs.PendingCount);
        Assert.Equal(1, await factory.Jobs.RunPendingAsync());
        var garment = await (await client.GetAsync($"/api/clothes/{added.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Ready, garment.Status);

        // The cutout from the first attempt was good, so the background was not removed a second time.
        Assert.Equal(1, factory.Ai.RemoverCalls);
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
    }

    [Fact]
    public async Task With_the_days_ai_budget_spent_the_garment_waits_and_is_finished_the_next_day()
    {
        // Other tests may have spent on this fake day already; a new day gives this one a clean ledger.
        factory.Clock.Advance(TimeSpan.FromDays(1));
        factory.Ai.Reset();
        using var tight = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:AiBudgetUsdPerDay", "0.5"));
        var storage = tight.Services.GetRequiredService<InMemoryImageStorage>();
        var auth = await tight.CreateClient().RegisterAsync();
        var client = tight.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();

        factory.Ai.TaggingReturns(ScriptedAi.Shirt, cost: 0.3m).TaggingReturns(ScriptedAi.Shirt, cost: 0.3m);
        var first = await client.AddGarmentAsync(storage);
        var second = await client.AddGarmentAsync(storage);
        var third = await client.AddGarmentAsync(storage);
        await factory.ProcessAsync(first.Id, tight.Services);
        await factory.ProcessAsync(second.Id, tight.Services);
        var callsBefore = (factory.Ai.RemoverCalls, factory.Ai.TaggerCalls);

        // 0.6 USD spent of 0.5: the third photo is not sent anywhere today.
        await factory.ProcessAsync(third.Id, tight.Services);

        Assert.Equal(callsBefore, (factory.Ai.RemoverCalls, factory.Ai.TaggerCalls));
        var waiting = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == third.Id));
        Assert.Equal(ClothingStatus.Processing, waiting.Status);
        Assert.NotNull(waiting.DeferredUntil);
        Assert.True(waiting.DeferredUntil > factory.Clock.GetUtcNow());
        Assert.True(waiting.DeferredUntil <= factory.Clock.GetUtcNow().AddDays(1));

        // The sweep leaves it alone until its time comes...
        await using (var scope = tight.Services.CreateAsyncScope())
        {
            Assert.Equal(0, await RequeuedOf(scope, third.Id));
        }

        // ...and picks it up once the next day's budget opens.
        factory.Clock.SetUtcNow(waiting.DeferredUntil.Value.AddMinutes(1));
        var jobs = tight.Services.GetRequiredService<FitIt.Infrastructure.Jobs.RecordingBackgroundJobs>();
        jobs.Clear();
        await using (var scope = tight.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<WardrobeMaintenance>().RequeueWaitingAsync();
        }

        await jobs.RunPendingAsync();
        var done = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == third.Id));
        Assert.Equal(ClothingStatus.Ready, done.Status);
        Assert.Null(done.DeferredUntil);

        async Task<int> RequeuedOf(AsyncServiceScope scope, Guid id)
        {
            jobs = tight.Services.GetRequiredService<FitIt.Infrastructure.Jobs.RecordingBackgroundJobs>();
            jobs.Clear();
            await scope.ServiceProvider.GetRequiredService<WardrobeMaintenance>().RequeueWaitingAsync();
            await jobs.RunPendingAsync();
            return (await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == id))).Status == ClothingStatus.Ready ? 1 : 0;
        }
    }
}
