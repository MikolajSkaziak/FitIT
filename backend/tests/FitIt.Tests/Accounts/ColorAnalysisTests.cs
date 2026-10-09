using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Usage;
using FitIt.Infrastructure.Wardrobe;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Accounts;

[Collection(ApiTests.Name)]
public sealed class ColorAnalysisTests(ApiFactory factory)
{
    private static JsonObject Answers(int skinTone, string undertone, string hair, string eyes) =>
        new() { ["answers"] = new JsonObject { ["skinTone"] = skinTone, ["undertone"] = undertone, ["hair"] = hair, ["eyes"] = eyes } };

    /// <summary>Very fair, warm, golden blond, light blue eyes: light spring.</summary>
    private static JsonObject Fair() => Answers(1, "warm", "golden_blond", "light_blue");

    /// <summary>Deep, warm, black hair, dark brown eyes: deep autumn.</summary>
    private static JsonObject DeepWarm() => Answers(8, "warm", "black", "dark_brown");

    private static async Task<UploadResponse> TicketAsync(HttpClient client)
    {
        var response = await client.PostAsync("/api/me/color-analysis/upload", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<UploadResponse>();
    }

    private static IEnumerable<string> SelfiesOf(ApiFactory factory, Guid userId) =>
        factory.Storage.Keys.Where(key => key.StartsWith($"u/{userId:N}/selfie/", StringComparison.Ordinal));

    [Fact]
    public async Task A_selfie_gives_a_type_and_a_palette_and_is_gone_from_storage_when_the_answer_arrives()
    {
        factory.Colors.Reset();
        var (client, auth) = await factory.SignedInAsync();
        var ticket = await TicketAsync(client);
        Assert.StartsWith($"u/{auth.User.Id:N}/selfie/", ticket.Key, StringComparison.Ordinal);
        factory.Storage.Put(ticket.Key, TestApi.Jpeg(4096));

        var response = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadAsync<ColorAnalysisResponse>();
        Assert.Equal(ColorAnalysisSource.Photo, result.Source);
        Assert.InRange(result.Best.Count, 6, 8);
        Assert.InRange(result.Soften.Count, 3, 4);
        Assert.Equal(ColorSeasons.Of(result.Season).Name, result.Name);
        Assert.All(result.Best.Concat(result.Soften), swatch => Assert.Matches("^#[0-9A-F]{6}$", swatch.Hex));

        // The analyst saw the photo, and nothing of it is left afterwards.
        Assert.Equal(1, factory.Colors.Calls);
        Assert.True(factory.Colors.PhotoWasThere);
        Assert.False(factory.Storage.Contains(ticket.Key));
        Assert.Empty(SelfiesOf(factory, auth.User.Id));

        // The result is on the profile and can be read, and its call is in the ledger.
        var me = await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>();
        Assert.Equal(result.Season, me.ColorAnalysis!.Season);
        Assert.Equal(result.Season, (await (await client.GetAsync("/api/me/color-analysis")).ReadAsync<ColorAnalysisResponse>()).Season);
        var log = await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.ColorAnalysis).ToListAsync());
        Assert.Equal((FakeColorAnalyst.Model, true), Assert.Single(log) is var entry ? (entry.Model, entry.Success) : default);
    }

    [Fact]
    public async Task The_same_photo_always_gets_the_same_type()
    {
        factory.Colors.Reset();
        var (client, _) = await factory.SignedInAsync();
        var bytes = TestApi.Jpeg(3000);
        bytes[100] = 42;

        var seasons = new List<ColorSeason>();
        for (var round = 0; round < 2; round++)
        {
            var ticket = await TicketAsync(client);
            factory.Storage.Put(ticket.Key, bytes);
            seasons.Add((await (await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key })).ReadAsync<ColorAnalysisResponse>()).Season);
        }

        Assert.Equal(seasons[0], seasons[1]);
    }

    [Theory]
    [InlineData(1, "warm", "golden_blond", "light_blue", ColorSeason.LightSpring)]
    [InlineData(8, "warm", "black", "dark_brown", ColorSeason.DeepAutumn)]
    [InlineData(5, "cool", "light_brown", "gray", ColorSeason.SoftSummer)]
    [InlineData(1, "cool", "black", "near_black", ColorSeason.CoolWinter)]
    [InlineData(1, "neutral", "dyed", "green", ColorSeason.LightSpring)]
    public async Task The_four_answers_go_through_a_fixed_table_and_no_ai_call_is_made(int tone, string undertone, string hair, string eyes, ColorSeason expected)
    {
        factory.Colors.Reset();
        var (client, auth) = await factory.SignedInAsync();

        var result = await (await client.PostJsonAsync("/api/me/color-analysis", Answers(tone, undertone, hair, eyes))).ReadAsync<ColorAnalysisResponse>();

        Assert.Equal((expected, ColorAnalysisSource.Quiz), (result.Season, result.Source));
        Assert.Null(factory.Colors.PhotoWasThere);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.AiUsage.CountAsync(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.ColorAnalysis)));
    }

    [Fact]
    public async Task Redoing_replaces_the_result_and_removing_it_leaves_nothing_and_can_be_said_twice()
    {
        factory.Colors.Reset();
        var (client, _) = await factory.SignedInAsync();
        await client.PostJsonAsync("/api/me/color-analysis", Fair());
        var second = await (await client.PostJsonAsync("/api/me/color-analysis", Answers(8, "cool", "black", "near_black"))).ReadAsync<ColorAnalysisResponse>();

        Assert.Equal(ColorSeason.DeepWinter, (await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>()).ColorAnalysis!.Season);
        Assert.Equal(ColorSeason.DeepWinter, second.Season);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me/color-analysis")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me/color-analysis")).StatusCode);
        Assert.Null((await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>()).ColorAnalysis);
        var missing = await client.GetAsync("/api/me/color-analysis");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("color_analysis_missing", await missing.ProblemCodeAsync());
    }

    [Fact]
    public async Task When_the_provider_fails_the_selfie_is_still_deleted_and_the_try_is_given_back()
    {
        factory.Colors.Reset().Fails();
        var (client, auth) = await factory.SignedInAsync();
        var ticket = await TicketAsync(client);
        factory.Storage.Put(ticket.Key, TestApi.Jpeg());

        var failed = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal("color_analysis_unavailable", await failed.ProblemCodeAsync());
        Assert.Empty(SelfiesOf(factory, auth.User.Id));
        Assert.Null((await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>()).ColorAnalysis);
        var log = await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == auth.User.Id && entry.Operation == AiOperation.ColorAnalysis).ToListAsync());
        Assert.False(Assert.Single(log).Success);

        // The failed try did not count: all three of today's are still there.
        for (var round = 0; round < 3; round++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.PostJsonAsync("/api/me/color-analysis", Fair())).StatusCode);
        }
    }

    [Fact]
    public async Task Three_selfie_analyses_a_day_then_the_usual_limit_answer_and_a_refused_selfie_is_deleted_too()
    {
        factory.Colors.Reset();
        var (client, auth) = await factory.SignedInAsync();
        for (var round = 0; round < 3; round++)
        {
            var ticket = await TicketAsync(client);
            factory.Storage.Put(ticket.Key, TestApi.Jpeg());
            Assert.Equal(HttpStatusCode.OK, (await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key })).StatusCode);
        }

        // No ticket is handed out any more, and a selfie that arrives anyway is not kept.
        var refused = await client.PostAsync("/api/me/color-analysis/upload", null);
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal("limit_reached", await refused.ProblemCodeAsync());
        var key = $"u/{auth.User.Id:N}/selfie/{Guid.NewGuid():N}.jpg";
        factory.Storage.Put(key, TestApi.Jpeg());
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = key })).StatusCode);
        Assert.False(factory.Storage.Contains(key));

        // Tomorrow it starts again.
        factory.Clock.Advance(TimeSpan.FromDays(1));
        var again = await factory.SignInAgainAsync(auth);
        var next = await TicketAsync(again);
        factory.Storage.Put(next.Key, TestApi.Jpeg());
        Assert.Equal(HttpStatusCode.OK, (await again.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = next.Key })).StatusCode);
    }

    [Fact]
    public async Task The_three_answers_do_not_use_up_the_daily_allowance_of_selfies()
    {
        factory.Colors.Reset();
        var (client, _) = await factory.SignedInAsync();
        for (var round = 0; round < 6; round++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.PostJsonAsync("/api/me/color-analysis", Fair())).StatusCode);
        }

        // All three selfies of the day are still there.
        for (var round = 0; round < 3; round++)
        {
            var ticket = await TicketAsync(client);
            factory.Storage.Put(ticket.Key, TestApi.Jpeg());
            Assert.Equal(HttpStatusCode.OK, (await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key })).StatusCode);
        }

        // And once they are gone, the three questions still answer.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync("/api/me/color-analysis/upload", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostJsonAsync("/api/me/color-analysis", Answers(8, "cool", "black", "near_black"))).StatusCode);
    }

    [Fact]
    public async Task Without_consent_a_selfie_is_not_analyzed_and_is_deleted_but_the_three_answers_still_work()
    {
        factory.Colors.Reset();
        var (client, auth) = await factory.SignedInAsync();
        var ticket = await TicketAsync(client);
        factory.Storage.Put(ticket.Key, TestApi.Jpeg());
        await client.GiveConsentAsync(false);

        var photo = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key });
        var upload = await client.PostAsync("/api/me/color-analysis/upload", null);

        Assert.All(new[] { photo, upload }, response => Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode));
        Assert.Equal("consent_required", await photo.ProblemCodeAsync());
        Assert.Equal(0, factory.Colors.Calls);
        Assert.Empty(SelfiesOf(factory, auth.User.Id));

        var quiz = await client.PostJsonAsync("/api/me/color-analysis", Fair());
        Assert.Equal(HttpStatusCode.OK, quiz.StatusCode);
        Assert.Equal(ColorAnalysisSource.Quiz, (await quiz.ReadAsync<ColorAnalysisResponse>()).Source);
    }

    [Fact]
    public async Task Another_persons_key_is_refused_and_their_selfie_is_left_alone()
    {
        factory.Colors.Reset();
        var (client, _) = await factory.SignedInAsync();
        var (other, otherAuth) = await factory.SignedInAsync();
        var theirs = await TicketAsync(other);
        factory.Storage.Put(theirs.Key, TestApi.Jpeg());
        var garment = $"u/{otherAuth.User.Id:N}/orig/{Guid.NewGuid():N}.jpg";
        factory.Storage.Put(garment, TestApi.Jpeg());

        foreach (var key in new[] { theirs.Key, garment, "somewhere/else.jpg" })
        {
            var response = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = key });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("key_invalid", await response.ProblemCodeAsync());
        }

        Assert.True(factory.Storage.Contains(theirs.Key));
        Assert.True(factory.Storage.Contains(garment));
        Assert.Equal(0, factory.Colors.Calls);
    }

    [Fact]
    public async Task A_request_needs_exactly_one_of_a_photo_and_the_answers_and_a_bad_file_is_deleted()
    {
        factory.Colors.Reset();
        var (client, auth) = await factory.SignedInAsync();
        var ticket = await TicketAsync(client);
        var both = Fair();
        both["key"] = ticket.Key;

        foreach (var body in new[] { new JsonObject(), both })
        {
            var response = await client.PostJsonAsync("/api/me/color-analysis", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("analysis_input_invalid", await response.ProblemCodeAsync());
        }

        var missing = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key });
        Assert.Equal("upload_missing", await missing.ProblemCodeAsync());

        factory.Storage.Put(ticket.Key, [1, 2, 3, 4]);
        var notJpeg = await client.PostJsonAsync("/api/me/color-analysis", new JsonObject { ["key"] = ticket.Key });
        Assert.Equal("upload_not_jpeg", await notJpeg.ProblemCodeAsync());
        Assert.Empty(SelfiesOf(factory, auth.User.Id));

        var unknown = await client.PostJsonAsync("/api/me/color-analysis", Answers(1, "green", "golden_blond", "light_blue"));
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        foreach (var tone in new[] { 0, 9 })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJsonAsync("/api/me/color-analysis", Answers(tone, "warm", "golden_blond", "light_blue"))).StatusCode);
        }

        var oldShape = new JsonObject { ["answers"] = new JsonObject { ["undertone"] = "warm", ["hair"] = "light", ["eyes"] = "light" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJsonAsync("/api/me/color-analysis", oldShape)).StatusCode);
        Assert.Equal(0, factory.Colors.Calls);
    }

    [Fact]
    public async Task A_selfie_left_behind_by_a_crash_is_swept_within_the_hour_while_other_files_wait_a_day()
    {
        var (client, auth) = await factory.SignedInAsync();
        var selfie = $"u/{auth.User.Id:N}/selfie/{Guid.NewGuid():N}.jpg";
        factory.Storage.Put(selfie, TestApi.Jpeg());
        var photo = await client.UploadPhotoAsync(factory.Storage);

        factory.Clock.Advance(TimeSpan.FromMinutes(30));
        await SweepAsync();
        Assert.True(factory.Storage.Contains(selfie));

        factory.Clock.Advance(TimeSpan.FromMinutes(45));
        await SweepAsync();
        Assert.False(factory.Storage.Contains(selfie));
        Assert.True(factory.Storage.Contains(photo));
    }

    [Fact]
    public async Task The_four_routes_need_a_signed_in_person()
    {
        var anonymous = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/api/me/color-analysis/upload", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostJsonAsync("/api/me/color-analysis", Fair())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/color-analysis")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync("/api/me/color-analysis")).StatusCode);
    }

    [Fact]
    public async Task The_stylist_is_told_the_best_colors_as_a_soft_preference_once_there_is_an_analysis()
    {
        var (client, auth) = await factory.SignedInAsync();
        var before = await factory.WithDatabaseAsync(db => db.Users.AsNoTracking().Where(user => user.Id == auth.User.Id).Select(user => user.ColorAnalysis).SingleAsync());
        Assert.Null(before);
        await client.PostJsonAsync("/api/me/color-analysis", DeepWarm());

        var stored = await factory.WithDatabaseAsync(db => db.Users.AsNoTracking().Where(user => user.Id == auth.User.Id).Select(user => user.ColorAnalysis).SingleAsync());

        Assert.Equal(ColorSeason.DeepAutumn, stored!.Season);
        Assert.Equal(ColorSeasons.Of(ColorSeason.DeepAutumn).Best.Select(swatch => swatch.Name), stored.Best.Select(swatch => swatch.Name));
    }

    private Task<int> SweepAsync() => factory.WithServicesAsync(services => services.GetRequiredService<WardrobeMaintenance>().RemoveOrphansAsync());
}
