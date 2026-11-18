using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Weather;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

[Collection(ApiTests.Name)]
public sealed class StylistChatApiTests(ApiFactory factory)
{
    [Fact]
    public async Task An_outfit_request_is_answered_by_the_rules_with_the_persons_own_garments_and_counted_once()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);

        var response = await client.ChatAsync("What should I wear on a date tonight?");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"source\":\"rules\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"followUps\":[", raw, StringComparison.Ordinal);
        var reply = System.Text.Json.JsonSerializer.Deserialize<StylistReplyResponse>(raw, TestApi.Json)!;
        Assert.Equal(StylistReplySource.Rules, reply.Source);
        Assert.StartsWith("Here is an outfit for date or evening out", reply.Text, StringComparison.Ordinal);
        Assert.NotNull(reply.Outfit);
        Assert.Equal(Occasion.Date, reply.Outfit.Occasion);
        var owned = wardrobe.Select(garment => garment.Id).ToHashSet();
        Assert.Contains(reply.Outfit.Items, item => item.Slot == Category.Shoes);
        Assert.All(reply.Outfit.Items, item =>
        {
            Assert.Equal(item.Slot, item.Clothing.Category);
            Assert.Contains(item.Clothing.Id, owned);
            Assert.StartsWith("http", item.Clothing.ImageUrl, StringComparison.Ordinal);
        });
        Assert.Equal(reply.Outfit.Items.Select(item => item.Clothing.Id), reply.Mentioned.Select(garment => garment.Id));
        Assert.NotEmpty(reply.FollowUps);
        Assert.Empty(reply.Shopping);

        Assert.Equal(new UsageLineResponse(1, 30), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat);
        Assert.Empty(await SpendAsync(auth.User.Id));
    }

    [Fact]
    public async Task A_question_about_gaps_gets_the_facts_and_generic_purchases_and_no_outfit()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Shirt, Jeans]);

        var response = await client.ChatAsync("What is missing from my wardrobe?", history: [("person", "Hi"), ("stylist", "Hello, how can I help?")]);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"outfit\":null", raw, StringComparison.Ordinal);
        Assert.Contains("\"category\":\"shoes\"", raw, StringComparison.Ordinal);
        var reply = System.Text.Json.JsonSerializer.Deserialize<StylistReplyResponse>(raw, TestApi.Json)!;
        Assert.Contains("No shoes", reply.Text, StringComparison.Ordinal);
        Assert.InRange(reply.Shopping.Count, 1, 3);
        Assert.All(reply.Shopping, idea => Assert.NotEmpty(idea.Colors));
        Assert.Empty(reply.Mentioned);
    }

    [Fact]
    public async Task An_empty_wardrobe_gets_a_helpful_answer_that_costs_nothing_and_is_not_counted()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInAsync();

        var reply = await (await client.ChatAsync("What should I wear?")).ReadAsync<StylistReplyResponse>();

        Assert.StartsWith("Your wardrobe is empty", reply.Text, StringComparison.Ordinal);
        Assert.Equal(StylistReplySource.Rules, reply.Source);
        Assert.Equal(3, reply.Shopping.Count);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat.Used);
    }

    public static TheoryData<string> InvalidBodies() => new()
    {
        """{}""",
        """{"messages":[]}""",
        """{"messages":[{"role":"person","text":"   "}]}""",
        """{"messages":[{"role":"person"}]}""",
        """{"messages":[{"text":"Hi"}]}""",
        """{"messages":[{"role":"customer","text":"Hi"}]}""",
        $$"""{"messages":[{"role":"person","text":"{{new string('a', 1001)}}"}]}""",
        """{"messages":[{"role":"person","text":"Hi"},{"role":"stylist","text":"Hello"}]}""",
        $$"""{"messages":[{{string.Join(',', Enumerable.Repeat("""{"role":"person","text":"Hi"}""", 17))}}]}""",
        """{"messages":[{"role":"person","text":"Hi"}],"occasion":"funeral"}""",
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task A_request_outside_the_contract_is_refused_and_not_counted(string body)
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var response = await client.PostAsync("/api/stylist/chat", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(await response.ProblemCodeAsync(), (string?[])["validation_failed", "bad_request"]);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat.Used);
    }

    [Fact]
    public async Task The_contract_names_what_is_wrong_with_the_conversation()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var tooLong = await client.ChatAsync(new string('a', 1001));
        var lastIsStylist = await client.PostJsonAsync("/api/stylist/chat", new JsonObject
        {
            ["messages"] = new JsonArray(new JsonObject { ["role"] = "person", ["text"] = "Hi" }, new JsonObject { ["role"] = "stylist", ["text"] = "Hello" }),
        });
        // Padding is not text: a message of 1000 characters with spaces around it is fine.
        var padded = await client.ChatAsync($"   {new string('a', 1000)}   ");

        var tooLongProblem = await tooLong.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("validation_failed", (string?)tooLongProblem!["code"]);
        Assert.Contains("messages[0].text", tooLongProblem["errors"]!.AsObject().Select(entry => entry.Key));
        var lastProblem = await lastIsStylist.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("validation_failed", (string?)lastProblem!["code"]);
        Assert.Contains("messages", lastProblem["errors"]!.AsObject().Select(entry => entry.Key));
        Assert.Equal(HttpStatusCode.OK, padded.StatusCode);
    }

    [Fact]
    public async Task A_day_beyond_the_forecast_is_refused()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);

        var response = await client.ChatAsync("What should I wear?", date: factory.DayIn().AddDays(7));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("date_out_of_range", await response.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await client.ChatAsync("What should I wear?", date: factory.DayIn().AddDays(6))).StatusCode);
    }

    [Fact]
    public async Task The_daily_limit_refuses_further_messages()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Limits:StylistMessagesPerDay", "2"));
        var (client, _) = await DressedInAsync(limited, Tee, Jeans, Sneakers);

        Assert.Equal(HttpStatusCode.OK, (await client.ChatAsync("Hi")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.ChatAsync("Hi again")).StatusCode);
        var refused = await client.ChatAsync("And again");

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(("limit_reached", "stylist_chat", 2), (problem!["code"]!.GetValue<string>(), problem["kind"]!.GetValue<string>(), problem["limit"]!.GetValue<int>()));
        Assert.Equal(new UsageLineResponse(2, 2), (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat);
    }

    [Fact]
    public async Task A_reply_that_fails_outright_gives_the_message_back()
    {
        var chat = new ScriptedChat(_ => throw new InvalidOperationException("Something broke."));
        using var host = WithChat(chat);
        var (client, _) = await DressedInAsync(host, Tee, Jeans, Sneakers);

        var response = await client.ChatAsync("Hi");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(1, chat.Calls);
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat.Used);
    }

    [Fact]
    public async Task The_models_reply_is_shown_as_ai_and_its_cost_goes_to_the_ledger()
    {
        var chat = new ScriptedChat(chat => chat.Resolve(
            new ChatAnswer("Your white tee and blue jeans are a classic pair.", null, null, ["T1", "B1", "Q7"], [], ["What shoes would work with it?"]),
            new AiCost("gemini-main", 0.004m, 2000, 300, 100)));
        using var host = WithChat(chat);
        var (client, userId) = await DressedInAsync(host, Tee, Jeans, Sneakers);

        var reply = await (await client.ChatAsync("Do my tee and jeans go together?")).ReadAsync<StylistReplyResponse>();

        Assert.Equal(StylistReplySource.Ai, reply.Source);
        Assert.Equal(["White T-shirt", "Blue jeans"], reply.Mentioned.Select(garment => garment.Name));
        Assert.Null(reply.Outfit);
        var entry = Assert.Single(await SpendAsync(userId));
        Assert.Equal(("gemini-main", 0.004m, true, 2000), (entry.Model, entry.CostUsd, entry.Success, entry.InputTokens));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat.Used);
    }

    [Fact]
    public async Task A_model_that_fails_hands_over_to_the_rules_and_its_cost_is_still_recorded()
    {
        var chat = new ScriptedChat(_ => throw new ProviderException("Gemini is not answering.") { Cost = new AiCost("gemini-main", 0.001m) });
        using var host = WithChat(chat);
        var (client, userId) = await DressedInAsync(host, Tee, Jeans, Sneakers);

        var reply = await (await client.ChatAsync("What should I wear?")).ReadAsync<StylistReplyResponse>();

        Assert.Equal(StylistReplySource.Rules, reply.Source);
        Assert.NotNull(reply.Outfit);
        var entry = Assert.Single(await SpendAsync(userId));
        Assert.Equal((0.001m, false), (entry.CostUsd, entry.Success));
        Assert.Equal(1, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).StylistChat.Used);
    }

    [Fact]
    public async Task With_the_days_ai_budget_spent_the_model_is_not_asked_and_the_rules_answer()
    {
        var chat = new ScriptedChat(_ => throw new InvalidOperationException("The model must not be asked."));
        using var broke = WithChat(chat, ("Limits:AiBudgetUsdPerDay", "0"));
        var (client, userId) = await DressedInAsync(broke, Tee, Jeans, Sneakers);

        var reply = await (await client.ChatAsync("What should I buy next?")).ReadAsync<StylistReplyResponse>();

        Assert.Equal(StylistReplySource.Rules, reply.Source);
        Assert.NotEmpty(reply.Shopping);
        Assert.Equal(0, chat.Calls);
        Assert.Empty(await SpendAsync(userId));
    }

    [Fact]
    public async Task Messages_are_limited_per_person_per_minute()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimits:StylistChatPerMinute", "2"));
        var (first, _) = await DressedInAsync(limited, Tee, Jeans, Sneakers);
        var (second, _) = await DressedInAsync(limited, Tee, Jeans, Sneakers);

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            statuses.Add((await first.ChatAsync("Hi")).StatusCode);
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], statuses);
        Assert.Equal("rate_limited", await (await first.ChatAsync("Hi")).ProblemCodeAsync());
        // The other person, from the same address, has an allowance of their own.
        Assert.Equal(HttpStatusCode.OK, (await second.ChatAsync("Hi")).StatusCode);
    }

    [Fact]
    public async Task Without_a_session_the_chat_is_closed()
    {
        var response = await factory.CreateClient().ChatAsync("Hi");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---- helpers ----------------------------------------------------------------------------------------------------

    private Task<List<FitIt.Core.Usage.AiUsageEntry>> SpendAsync(Guid userId) =>
        factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == userId && entry.Operation == AiOperation.StylistChat).OrderBy(entry => entry.Id).ToListAsync());

    private WebApplicationFactory<Program> WithChat(IStylistChat chat, params (string Key, string Value)[] settings) =>
        factory.WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in settings)
            {
                builder.UseSetting(key, value);
            }

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IStylistChat>();
                services.AddSingleton(chat);
            });
        });

    /// <summary>A new person with consent and the given garments, ready, in another host built from the factory, on a warm day.</summary>
    private async Task<(HttpClient Client, Guid UserId)> DressedInAsync(WebApplicationFactory<Program> host, params GarmentTags[] wardrobe)
    {
        factory.Ai.Reset();
        var weather = host.Services.GetRequiredService<FakeWeather>();
        (weather.Low, weather.High) = (Warm, Warm);
        var auth = await host.CreateClient().RegisterAsync();
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", auth.AccessToken);
        await client.GiveConsentAsync();
        foreach (var tags in wardrobe)
        {
            var added = await client.AddGarmentAsync(host.Services.GetRequiredService<InMemoryImageStorage>());
            // Described by hand, as the person would: the host's AI budget may be spent, and tagging would wait for it.
            await using var scope = host.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var item = await db.Clothes.SingleAsync(found => found.Id == added.Id);
            item.MarkReady(tags, tags.Describe(), factory.Clock.GetUtcNow());
            await db.SaveChangesAsync();
        }

        return (client, auth.User.Id);
    }

    private sealed class ScriptedChat(Func<StylistChatCase, StylistChatReply> answer) : IStylistChat
    {
        public int Calls { get; private set; }

        public Task<StylistChatReply> ReplyAsync(StylistChatCase chat, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(answer(chat));
        }
    }
}

internal static class StylistChatRequests
{
    public static Task<HttpResponseMessage> ChatAsync(
        this HttpClient client, string text, IReadOnlyList<(string Role, string Text)>? history = null, string? occasion = null, DateOnly? date = null)
    {
        var messages = new JsonArray();
        foreach (var (role, said) in history ?? [])
        {
            messages.Add(new JsonObject { ["role"] = role, ["text"] = said });
        }

        messages.Add(new JsonObject { ["role"] = "person", ["text"] = text });
        var body = new JsonObject { ["messages"] = messages };
        if (occasion is not null)
        {
            body["occasion"] = occasion;
        }

        if (date is { } day)
        {
            body["date"] = day.Iso();
        }

        return client.PostJsonAsync("/api/stylist/chat", body);
    }
}
