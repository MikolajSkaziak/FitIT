using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Storage;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Wardrobe;

[Collection(ApiTests.Name)]
public sealed class WardrobeApiTests(ApiFactory factory)
{
    [Fact]
    public async Task The_wardrobe_needs_a_signed_in_person()
    {
        var client = factory.CreateClient();

        foreach (var response in new[]
                 {
                     await client.PostAsync("/api/uploads", null),
                     await client.GetAsync("/api/clothes"),
                     await client.GetAsync("/api/clothes/stats"),
                     await client.GetAsync($"/api/clothes/{Guid.NewGuid()}"),
                     await client.DeleteAsync($"/api/clothes/{Guid.NewGuid()}"),
                     await client.GetAsync("/api/me/usage"),
                 })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task Creating_the_account_is_the_consent_and_withdrawing_it_closes_the_door_until_it_is_given_again()
    {
        var (client, _) = await factory.SignedInAsync();

        // No separate step: a new account can add photos at once.
        var key = await client.UploadPhotoAsync(factory.Storage);

        await client.GiveConsentAsync(false);
        var add = await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key });
        Assert.Equal(HttpStatusCode.Forbidden, add.StatusCode);
        Assert.Equal("consent_required", await add.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/uploads", null)).StatusCode);

        await client.GiveConsentAsync();
        Assert.Equal(HttpStatusCode.Created, (await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key })).StatusCode);
    }

    [Fact]
    public async Task An_upload_address_is_for_one_jpeg_under_the_callers_own_prefix_for_five_minutes()
    {
        var (client, auth) = await factory.SignedInWithConsentAsync();

        var ticket = await (await client.PostAsync("/api/uploads", null)).ReadAsync<UploadResponse>();

        Assert.StartsWith($"u/{auth.User.Id:N}/orig/", ticket.Key, StringComparison.Ordinal);
        Assert.EndsWith(".jpg", ticket.Key, StringComparison.Ordinal);
        Assert.Equal("PUT", ticket.Method);
        Assert.Equal("image/jpeg", ticket.Headers["Content-Type"]);
        Assert.Equal(factory.Clock.GetUtcNow().AddMinutes(5), ticket.ExpiresAt);
        Assert.Equal(2_000_000, ticket.MaxBytes);
        Assert.Contains(ticket.Key, ticket.Url, StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_uploaded_photo_becomes_a_garment_in_processing_with_a_job_behind_it()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        factory.Jobs.Clear();

        var added = await client.AddGarmentAsync(factory.Storage);

        Assert.Equal(ClothingStatus.Processing, added.Status);
        Assert.Null(added.Name);
        Assert.Null(added.Category);
        Assert.Empty(added.Colors);
        Assert.NotNull(added.ImageUrl);
        Assert.Equal(1, factory.Jobs.PendingCount);
        var usage = await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();
        Assert.Equal(new UsageLineResponse(1, 50), usage.Items);
    }

    [Fact]
    public async Task The_same_key_sent_twice_is_one_garment_counted_once()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var key = await client.UploadPhotoAsync(factory.Storage);
        factory.Jobs.Clear();

        var first = await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key });
        var second = await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal((await first.ReadAsync<ClothingResponse>()).Id, (await second.ReadAsync<ClothingResponse>()).Id);
        Assert.Equal(1, factory.Jobs.PendingCount);
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
    }

    [Fact]
    public async Task The_same_key_sent_many_times_at_once_is_still_one_garment()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var key = await client.UploadPhotoAsync(factory.Storage);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key })));

        Assert.All(responses, response => Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
        Assert.Single(await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>());
    }

    [Fact]
    public async Task A_key_that_was_not_issued_to_this_account_is_refused()
    {
        var (owner, _) = await factory.SignedInWithConsentAsync();
        var (other, otherAuth) = await factory.SignedInWithConsentAsync();
        var foreignKey = await owner.UploadPhotoAsync(factory.Storage);

        foreach (var key in new[] { foreignKey, "whatever.jpg", $"u/{otherAuth.User.Id:N}/cut/{Guid.NewGuid():N}.jpg", $"u/{otherAuth.User.Id:N}/orig/../x.jpg" })
        {
            var response = await other.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("key_invalid", await response.ProblemCodeAsync());
        }

        Assert.True(factory.Storage.Contains(foreignKey));
    }

    [Theory]
    [InlineData("missing", "upload_missing")]
    [InlineData("too_large", "upload_too_large")]
    [InlineData("png", "upload_not_jpeg")]
    [InlineData("empty", "upload_not_jpeg")]
    public async Task What_was_really_uploaded_is_checked_and_a_refusal_costs_nothing(string what, string code)
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var ticket = await (await client.PostAsync("/api/uploads", null)).ReadAsync<UploadResponse>();
        switch (what)
        {
            case "too_large":
                factory.Storage.Put(ticket.Key, TestApi.Jpeg(2_000_001));
                break;
            case "png":
                factory.Storage.Put(ticket.Key, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
                break;
            case "empty":
                factory.Storage.Put(ticket.Key, []);
                break;
        }

        var response = await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = ticket.Key });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
        Assert.False(factory.Storage.Contains(ticket.Key));
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
        Assert.Empty(await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>());
    }

    [Fact]
    public async Task A_photo_of_exactly_the_limit_is_accepted()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var key = await client.UploadPhotoAsync(factory.Storage, TestApi.Jpeg(2_000_000));

        Assert.Equal(HttpStatusCode.Created, (await client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key })).StatusCode);
    }

    [Fact]
    public async Task The_daily_limit_holds_however_many_requests_arrive_at_once()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:ItemsPerDay", "5"));
        var storage = limited.Services.GetRequiredService<InMemoryImageStorage>();
        var auth = await limited.CreateClient().RegisterAsync();
        var client = limited.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        var keys = new List<string>();
        for (var i = 0; i < 15; i++)
        {
            keys.Add(await client.UploadPhotoAsync(storage));
        }

        var responses = await Task.WhenAll(keys.Select(key => client.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = key })));

        Assert.Equal(5, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        var refused = responses.Where(response => response.StatusCode == HttpStatusCode.TooManyRequests).ToList();
        Assert.Equal(10, refused.Count);
        var problem = await refused[0].Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("limit_reached", problem!["code"]!.GetValue<string>());
        Assert.Equal("item_added", problem["kind"]!.GetValue<string>());
        Assert.Equal(5, problem["limit"]!.GetValue<int>());
        Assert.True(problem["resetsAt"]!.GetValue<DateTimeOffset>() > factory.Clock.GetUtcNow());

        Assert.Equal(new UsageLineResponse(5, 5), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items);
        Assert.Equal(5, await factory.WithDatabaseAsync(db => db.Clothes.CountAsync(item => item.UserId == auth.User.Id)));

        // With the day's allowance gone, even asking for an upload address is refused, so no photo is sent in vain.
        var upload = await client.PostAsync("/api/uploads", null);
        Assert.Equal(HttpStatusCode.TooManyRequests, upload.StatusCode);
        Assert.Equal("limit_reached", await upload.ProblemCodeAsync());
    }

    [Fact]
    public async Task The_limit_starts_again_the_next_day()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:ItemsPerDay", "1"));
        var storage = limited.Services.GetRequiredService<InMemoryImageStorage>();
        var auth = await limited.CreateClient().RegisterAsync();
        var client = limited.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        await client.AddGarmentAsync(storage);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync("/api/uploads", null)).StatusCode);

        factory.Clock.Advance(TimeSpan.FromDays(1));
        var login = await limited.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = auth.User.Email, ["password"] = TestApi.Password });
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await login.ReadAsync<AuthResponse>()).AccessToken);

        var usage = await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();
        Assert.Equal(new UsageLineResponse(0, 1), usage.Items);
        await client.AddGarmentAsync(storage);
    }

    [Fact]
    public async Task Usage_shows_all_three_limits_and_when_they_start_again()
    {
        var (client, _) = await factory.SignedInAsync();

        var usage = await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();

        Assert.Equal(new UsageLineResponse(0, 50), usage.Items);
        Assert.Equal(new UsageLineResponse(0, 20), usage.Suggestions);
        Assert.Equal(new UsageLineResponse(0, 5), usage.Visualizations);
        Assert.True(usage.ResetsAt > factory.Clock.GetUtcNow());
        Assert.True(usage.ResetsAt <= factory.Clock.GetUtcNow().AddDays(1));
    }

    [Theory]
    [InlineData("Tokio", 35.7, 139.7, "Asia/Tokyo")]
    [InlineData("Lima", -12.0, -77.0, "America/Lima")]
    [InlineData("Gliwice", 50.3, 18.7, "Europe/Warsaw")]
    public async Task The_day_of_the_limits_is_the_day_where_the_person_is(string name, double lat, double lon, string zoneId)
    {
        var (client, _) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = name, ["lat"] = lat, ["lon"] = lon });

        var usage = await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>();

        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var there = TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), zone);
        var nextMidnight = there.Date.AddDays(1);
        Assert.Equal(new DateTimeOffset(nextMidnight, zone.GetUtcOffset(nextMidnight)).ToUniversalTime(), usage.ResetsAt);
    }

    [Fact]
    public async Task A_person_sees_only_their_own_garments_newest_first()
    {
        factory.Ai.Reset();
        var (mine, _) = await factory.SignedInWithConsentAsync();
        var (theirs, _) = await factory.SignedInWithConsentAsync();
        var first = await factory.AddProcessedGarmentAsync(mine);
        factory.Clock.Advance(TimeSpan.FromSeconds(5));
        var second = await factory.AddProcessedGarmentAsync(mine);
        await factory.AddProcessedGarmentAsync(theirs);

        var listed = await (await mine.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();

        Assert.Equal([second.Id, first.Id], listed.Select(item => item.Id));
        Assert.All(listed, item => Assert.Equal(ClothingStatus.Ready, item.Status));
    }

    [Fact]
    public async Task Somebody_elses_garment_looks_as_if_it_did_not_exist()
    {
        factory.Ai.Reset();
        var (owner, _) = await factory.SignedInWithConsentAsync();
        var (stranger, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(owner);

        var responses = new[]
        {
            await stranger.GetAsync($"/api/clothes/{garment.Id}"),
            await stranger.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["inLaundry"] = true }),
            await stranger.PostAsync($"/api/clothes/{garment.Id}/reprocess", null),
            await stranger.DeleteAsync($"/api/clothes/{garment.Id}"),
        };

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        Assert.Empty(await (await stranger.GetAsync($"/api/clothes?ids={garment.Id}")).ReadAsync<List<ClothingResponse>>());
        var untouched = await (await owner.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>();
        Assert.False(untouched.InLaundry);
        Assert.Equal(ClothingStatus.Ready, untouched.Status);
    }

    [Fact]
    public async Task The_list_can_be_searched_by_name_and_narrowed_to_a_category()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        factory.Ai.TaggingReturns(ScriptedAi.Shirt with { Name = "Navy oxford shirt" });
        var shirt = await factory.AddProcessedGarmentAsync(client);
        factory.Ai.TaggingReturns(new GarmentTags(Category.Bottom, Subcategory.Jeans, "Jeans 100% cotton_slim", [Color.Blue], Pattern.Plain, Material.Denim, 2, 3, false, []));
        var jeans = await factory.AddProcessedGarmentAsync(client);

        async Task<List<Guid>> Find(string query) =>
            [.. (await (await client.GetAsync("/api/clothes" + query)).ReadAsync<List<ClothingResponse>>()).Select(item => item.Id)];

        Assert.Equal([shirt.Id], await Find("?q=SHIRT"));
        Assert.Equal([shirt.Id], await Find("?q=%20oxford%20"));
        Assert.Equal([jeans.Id], await Find("?category=bottom"));
        Assert.Empty(await Find("?category=shoes"));
        Assert.Equal([jeans.Id], await Find("?group=jeans"));
        Assert.Equal([shirt.Id], await Find("?group=shirts_and_blouses"));
        Assert.Empty(await Find("?group=shoes"));
        Assert.Equal(new[] { jeans.Id, shirt.Id }.Order(), (await Find("?group=jeans,shirts_and_blouses,shoes")).Order());
        Assert.Equal([jeans.Id], await Find("?group=jeans&category=bottom"));
        Assert.Empty(await Find("?group=jeans&category=top"));
        Assert.Empty(await Find("?q=shirt&category=bottom"));

        // The wildcard characters of SQL are ordinary letters to a person searching.
        Assert.Equal([jeans.Id], await Find("?q=100%25"));
        Assert.Equal([jeans.Id], await Find("?q=n_s"));
        Assert.Empty(await Find("?q=navy%25oxford"));

        var invalid = await client.GetAsync("/api/clothes?category=hats");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("category_invalid", await invalid.ProblemCodeAsync());
        var invalidGroup = await client.GetAsync("/api/clothes?group=hats");
        Assert.Equal(HttpStatusCode.BadRequest, invalidGroup.StatusCode);
        Assert.Equal("group_invalid", await invalidGroup.ProblemCodeAsync());
        Assert.Equal("ids_invalid", await (await client.GetAsync("/api/clothes?ids=abc")).ProblemCodeAsync());
    }

    [Fact]
    public async Task Tags_and_flags_can_be_corrected_by_hand()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);

        var response = await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject
        {
            ["name"] = "  Work shirt ",
            ["colors"] = new JsonArray("light_blue", "white"),
            ["pattern"] = "stripes",
            ["formality"] = 3,
            ["rainOk"] = true,
            ["styles"] = new JsonArray("casual"),
            ["inLaundry"] = true,
            ["rarelyWorn"] = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.ReadAsync<ClothingResponse>();
        Assert.Equal("Work shirt", updated.Name);
        Assert.Equal([Color.LightBlue, Color.White], updated.Colors);
        Assert.Equal(Pattern.Stripes, updated.Pattern);
        Assert.Equal(3, updated.Formality);
        Assert.Equal(2, updated.Warmth);
        Assert.True(updated.RainOk);
        Assert.Equal([StyleTag.Casual], updated.Styles);
        Assert.True(updated.InLaundry);
        Assert.True(updated.RarelyWorn);
        Assert.True(updated.IsForgotten);
        Assert.Equal(Subcategory.Shirt, updated.Subcategory);
        Assert.Equal(GarmentGroup.ShirtsAndBlouses, updated.Group);

        // What the models read follows the corrected tags, not the old answer of the tagging model.
        var description = await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == garment.Id).Select(item => item.Description).SingleAsync());
        Assert.Equal("light blue and white striped cotton shirt", description);
    }

    [Theory]
    [InlineData("""{"subcategory":"jeans"}""", "subcategory_mismatch")]
    [InlineData("""{"category":"shoes"}""", "subcategory_mismatch")]
    [InlineData("""{"colors":["navy","navy"]}""", "colors_invalid")]
    [InlineData("""{"styles":["smart","smart"]}""", "styles_invalid")]
    [InlineData("""{"name":"   "}""", "name_invalid")]
    [InlineData("""{"colors":[]}""", "validation_failed")]
    [InlineData("""{"colors":["navy","white","red"]}""", "validation_failed")]
    [InlineData("""{"formality":6}""", "validation_failed")]
    [InlineData("""{"warmth":0}""", "validation_failed")]
    [InlineData("""{"name":""}""", "validation_failed")]
    [InlineData("""{"pattern":"zigzag"}""", "bad_request")]
    [InlineData("""{"colors":["teal"]}""", "bad_request")]
    public async Task A_change_that_breaks_the_dictionaries_is_refused_and_changes_nothing(string body, string code)
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);

        var response = await client.PatchAsync($"/api/clothes/{garment.Id}", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
        Assert.Equivalent(garment with { ImageUrl = null }, await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>() with { ImageUrl = null });
    }

    [Fact]
    public async Task While_a_garment_is_being_described_only_its_flags_can_change()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await client.AddGarmentAsync(factory.Storage);

        var tags = await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["name"] = "Shirt" });
        var flags = await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["rarelyWorn"] = true });

        Assert.Equal(HttpStatusCode.Conflict, tags.StatusCode);
        Assert.Equal("still_processing", await tags.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, flags.StatusCode);
        Assert.True((await flags.ReadAsync<ClothingResponse>()).RarelyWorn);
    }

    [Fact]
    public async Task A_change_moves_the_last_changed_time_and_leaves_the_creation_time_alone()
    {
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await client.AddGarmentAsync(factory.Storage);
        var created = factory.Clock.GetUtcNow();

        factory.Clock.Advance(TimeSpan.FromMinutes(2));
        await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["inLaundry"] = true });

        // Read back through the model, the way the sweep for stuck garments reads it.
        var stored = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().SingleAsync(item => item.Id == garment.Id));
        Assert.Equal(created, stored.CreatedAt);
        Assert.Equal(created.AddMinutes(2), stored.UpdatedAt);
    }

    [Fact]
    public async Task Deleting_a_garment_removes_its_row_and_both_pictures()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var keys = await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == garment.Id).Select(item => new { item.OriginalKey, item.CutoutKey }).SingleAsync());
        Assert.NotEqual(keys.OriginalKey, keys.CutoutKey);
        Assert.True(factory.Storage.Contains(keys.OriginalKey));
        Assert.True(factory.Storage.Contains(keys.CutoutKey!));

        var response = await client.DeleteAsync($"/api/clothes/{garment.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/clothes/{garment.Id}")).StatusCode);
        Assert.False(factory.Storage.Contains(keys.OriginalKey));
        Assert.False(factory.Storage.Contains(keys.CutoutKey!));
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/clothes/{garment.Id}")).StatusCode);
    }

    [Fact]
    public async Task Forgotten_garments_are_those_flagged_or_untouched_for_thirty_days()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var old = await factory.AddProcessedGarmentAsync(client);
        var flagged = await factory.AddProcessedGarmentAsync(client);
        await client.PatchJsonAsync($"/api/clothes/{flagged.Id}", new JsonObject { ["rarelyWorn"] = true });

        async Task<List<Guid>> Forgotten(HttpClient http) =>
            [.. (await (await http.GetAsync("/api/clothes?forgotten=true")).ReadAsync<List<ClothingResponse>>()).Select(item => item.Id)];

        Assert.Equal([flagged.Id], await Forgotten(client));
        Assert.False(old.IsForgotten);

        factory.Clock.Advance(TimeSpan.FromDays(29));
        client = await factory.SignInAgainAsync(auth);
        Assert.Equal([flagged.Id], await Forgotten(client));

        factory.Clock.Advance(TimeSpan.FromDays(1));
        client = await factory.SignInAgainAsync(auth);
        var fresh = await factory.AddProcessedGarmentAsync(client);

        Assert.Equal(new[] { flagged.Id, old.Id }.Order(), (await Forgotten(client)).Order());
        var all = await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();
        Assert.True(all.Single(item => item.Id == old.Id).IsForgotten);
        Assert.False(all.Single(item => item.Id == fresh.Id).IsForgotten);

        var stats = await (await client.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>();
        Assert.Equal(new WardrobeStatsResponse(Total: 3, WornLast30Days: 0, Forgotten: 2, Processing: 0, NeedsTags: 0), stats);
    }

    [Fact]
    public async Task The_statistics_count_what_is_ready_waiting_and_in_need_of_tags()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var worn = await factory.AddProcessedGarmentAsync(client);
        await factory.AddProcessedGarmentAsync(client);
        await client.AddGarmentAsync(factory.Storage);
        factory.Ai.TaggingFails(3);
        var failing = await client.AddGarmentAsync(factory.Storage);
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(failing.Id));
        await Assert.ThrowsAsync<ProviderException>(() => factory.ProcessAsync(failing.Id));
        await factory.ProcessAsync(failing.Id);
        await factory.WithDatabaseAsync(async db =>
        {
            var item = await db.Clothes.SingleAsync(found => found.Id == worn.Id);
            item.RecordWear(DateOnly.FromDateTime(factory.Clock.GetUtcNow().UtcDateTime), factory.Clock.GetUtcNow());
            return await db.SaveChangesAsync();
        });

        var stats = await (await client.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>();

        Assert.Equal(new WardrobeStatsResponse(Total: 2, WornLast30Days: 1, Forgotten: 0, Processing: 1, NeedsTags: 1), stats);
        Assert.Equal(4, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
        Assert.Equal(UsageKind.ItemAdded, await factory.WithDatabaseAsync(db => db.UsageCounters.Where(counter => counter.UserId == auth.User.Id).Select(counter => counter.Kind).SingleAsync()));
    }

    [Fact]
    public async Task The_dictionaries_are_public_and_complete()
    {
        var response = await factory.CreateClient().GetAsync("/api/dictionaries");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dictionaries = await response.ReadAsync<DictionariesResponse>();
        Assert.Equal(Enum.GetValues<Category>(), dictionaries.Categories.Select(entry => entry.Code));
        Assert.Equal(Enum.GetValues<Subcategory>().Length, dictionaries.Categories.Sum(entry => entry.Types.Count));
        Assert.Contains(dictionaries.Categories.Single(entry => entry.Code == Category.MidLayer).Types, type => type is { Code: Subcategory.Blazer, Label: "Blazer" });
        Assert.Equal(Enum.GetValues<GarmentGroup>(), dictionaries.Groups.Select(entry => entry.Code));
        Assert.Equal(Enum.GetValues<Subcategory>().Length, dictionaries.Groups.Sum(entry => entry.Types.Count));
        Assert.All(dictionaries.Groups, entry => Assert.All(entry.Types, type => Assert.Equal(entry.Code, GarmentCatalog.GroupOf(type.Code))));
        var sweaters = dictionaries.Groups.Single(entry => entry.Code == GarmentGroup.SweatersAndHoodies);
        Assert.Equal("Sweaters and hoodies", sweaters.Label);
        Assert.Equal([Subcategory.Turtleneck, Subcategory.Sweater, Subcategory.Sweatshirt, Subcategory.Hoodie, Subcategory.Cardigan], sweaters.Types.Select(type => type.Code));
        Assert.Equal("Warm layers", dictionaries.Categories.Single(entry => entry.Code == Category.MidLayer).Label);
        Assert.Equal(17, dictionaries.Colors.Count);
        Assert.Equal(7, dictionaries.Colors.Count(color => color.Neutral));
        Assert.Equal(new ColorEntry(Color.Navy, "navy", true, "#1F2A44"), dictionaries.Colors.Single(color => color.Code == Color.Navy));
        Assert.All(dictionaries.Colors, color => Assert.Matches("^#[0-9A-F]{6}$", color.Hex));
        Assert.Equal([Season.Spring, Season.Summer, Season.Fall, Season.Winter], dictionaries.Seasons.Select(entry => entry.Code));
        Assert.Equal(["Spring", "Summer", "Fall", "Winter"], dictionaries.Seasons.Select(entry => entry.Label));
        Assert.Equal(6, dictionaries.Patterns.Count);
        Assert.Equal(11, dictionaries.Materials.Count);
        Assert.Equal(Enum.GetValues<StyleTag>(), dictionaries.Styles.Select(entry => entry.Code));
        Assert.Equal(16, dictionaries.Styles.Count);
        Assert.Equal([1, 2, 3, 4, 5], dictionaries.Formality.Select(entry => entry.Value));
        Assert.Equal(new ScaleEntry(5, "freezing weather"), dictionaries.Warmth[^1]);

        // Codes travel as text in the JSON itself, not as numbers.
        var raw = await (await factory.CreateClient().GetAsync("/api/dictionaries")).Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"one_piece\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"code\":\"t_shirt\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"code\":\"sweaters_and_hoodies\"", raw, StringComparison.Ordinal);
    }
}
