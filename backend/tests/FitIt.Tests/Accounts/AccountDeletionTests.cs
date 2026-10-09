using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Accounts;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Accounts;

/// <summary>Ending an account from the app (plan 5.1, product spec 12): nothing of the person remains, and the address can be used again.</summary>
[Collection(ApiTests.Name)]
public sealed class AccountDeletionTests(ApiFactory factory)
{
    [Fact]
    public async Task Deleting_the_account_needs_a_signed_in_person()
    {
        var response = await Delete(factory.CreateClient(), TestApi.Password);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Without_the_right_password_nothing_is_deleted()
    {
        var (client, auth) = await factory.SignedInAsync();

        var wrong = await Delete(client, "zle-haslo-123");
        var missing = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = JsonContent.Create(new JsonObject()) });

        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("wrong_password", await wrong.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/me")).StatusCode);
        Assert.True(await factory.WithDatabaseAsync(db => db.Users.AnyAsync(user => user.Id == auth.User.Id)));
    }

    [Fact]
    public async Task Guessing_the_password_through_this_door_is_as_hard_as_at_the_login()
    {
        var (client, auth) = await factory.SignedInAsync();

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await Delete(client, "zle-haslo-123");
        }

        var locked = await Delete(client, TestApi.Password);

        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.Equal("locked_out", await locked.ProblemCodeAsync());
        Assert.True(await factory.WithDatabaseAsync(db => db.Users.AnyAsync(user => user.Id == auth.User.Id)));
    }

    [Fact]
    public async Task Everything_of_the_person_is_gone_and_so_are_their_files()
    {
        var person = await PersonWithEverythingAsync();
        var (stranger, strangerAuth) = await factory.SignedInWithConsentAsync();
        var strangersGarment = await factory.AddProcessedGarmentAsync(stranger);
        var strangersKeys = await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == strangersGarment.Id).Select(item => item.OriginalKey).ToListAsync());
        Assert.NotEmpty(person.FileKeys);
        factory.Jobs.Clear();

        var response = await Delete(person.Client, TestApi.Password);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        // The database is clean at once...
        Assert.Equal(0, await CountRowsAsync(person.Auth.User.Id));
        // ...and the files go in the background job the deletion queued.
        Assert.True(factory.Jobs.PendingCount >= 1);
        Assert.All(person.FileKeys, key => Assert.True(factory.Storage.Contains(key)));
        await factory.Jobs.RunPendingAsync();
        Assert.All(person.FileKeys, key => Assert.False(factory.Storage.Contains(key), key));
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith(ObjectKeys.PrefixOf(person.Auth.User.Id), StringComparison.Ordinal));

        // Nobody else lost anything.
        Assert.True(factory.Storage.Contains(strangersKeys[0]));
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync($"/api/clothes/{strangersGarment.Id}")).StatusCode);
        Assert.True(await factory.WithDatabaseAsync(db => db.Users.AnyAsync(user => user.Id == strangerAuth.User.Id)));
    }

    [Fact]
    public async Task The_cost_log_keeps_its_rows_without_the_person()
    {
        var person = await PersonWithEverythingAsync();
        var before = await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => entry.UserId == person.Auth.User.Id).Select(entry => new { entry.Id, entry.Operation, entry.CostUsd }).ToListAsync());
        Assert.NotEmpty(before);

        await Delete(person.Client, TestApi.Password);

        var after = await factory.WithDatabaseAsync(db => db.AiUsage.AsNoTracking().Where(entry => before.Select(row => row.Id).Contains(entry.Id)).ToListAsync());
        Assert.Equal(before.Count, after.Count);
        Assert.All(after, entry => Assert.Null(entry.UserId));
        Assert.Equal(before.Select(row => (row.Operation, row.CostUsd)).Order(), after.Select(entry => (entry.Operation, entry.CostUsd)).Order());
    }

    [Fact]
    public async Task The_tokens_of_a_deleted_account_stop_working_at_once()
    {
        var (client, auth) = await factory.SignedInAsync();

        await Delete(client, TestApi.Password);

        // The access token is still unexpired and correctly signed; the account behind it is not there.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/clothes")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/uploads", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Delete(client, TestApi.Password)).StatusCode);
        var refreshed = await factory.CreateClient().PostJsonAsync("/api/auth/refresh", new JsonObject { ["refreshToken"] = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, refreshed.StatusCode);
        Assert.Equal("invalid_refresh_token", await refreshed.ProblemCodeAsync());
        var login = await factory.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = auth.User.Email, ["password"] = TestApi.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("invalid_credentials", await login.ProblemCodeAsync());
    }

    [Fact]
    public async Task The_same_address_can_register_again_and_starts_with_nothing()
    {
        var person = await PersonWithEverythingAsync();
        await Delete(person.Client, TestApi.Password);
        await factory.Jobs.RunPendingAsync();

        Assert.True((await (await factory.CreateClient().PostJsonAsync("/api/auth/email-check", new JsonObject { ["email"] = person.Auth.User.Email })).ReadAsync<EmailCheckResponse>()).Available);
        var again = await factory.CreateClient().RegisterAsync(person.Auth.User.Email);

        Assert.NotEqual(person.Auth.User.Id, again.User.Id);
        var client = factory.Authorized(again.AccessToken);
        Assert.Empty(await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>());
        Assert.Empty(await (await client.GetAsync("/api/outfits")).ReadAsync<List<OutfitResponse>>());
        Assert.Equal(0, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
        Assert.NotNull(again.User.AiConsentAt);
        // Nothing of the old account answers to the old garments' ids.
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/clothes/{person.Garment}")).StatusCode);
    }

    [Fact]
    public async Task A_job_that_was_still_waiting_for_a_deleted_account_finds_nothing_to_do()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        await client.AddGarmentAsync(factory.Storage);
        Assert.True(factory.Jobs.PendingCount >= 1);

        await Delete(client, TestApi.Password);
        // The garment's processing job runs after its owner is gone, followed by the cleanup.
        await factory.Jobs.RunPendingAsync();

        Assert.Equal(0, await CountRowsAsync(auth.User.Id));
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith(ObjectKeys.PrefixOf(auth.User.Id), StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_cleanup_deletes_every_file_under_the_prefix_however_many_there_are_and_can_run_again()
    {
        var gone = Guid.NewGuid();
        var kept = Guid.NewGuid();
        for (var index = 0; index < 450; index++)
        {
            factory.Storage.Put($"{ObjectKeys.PrefixOf(gone)}orig/{Guid.NewGuid():N}.jpg", TestApi.Jpeg(16));
        }

        factory.Storage.Put($"{ObjectKeys.PrefixOf(kept)}orig/{Guid.NewGuid():N}.jpg", TestApi.Jpeg(16));

        var removed = await factory.WithServicesAsync(services => services.GetRequiredService<AccountCleanup>().DeleteFilesAsync(gone));
        var again = await factory.WithServicesAsync(services => services.GetRequiredService<AccountCleanup>().DeleteFilesAsync(gone));

        Assert.Equal((450, 0), (removed, again));
        Assert.DoesNotContain(factory.Storage.Keys, key => key.StartsWith(ObjectKeys.PrefixOf(gone), StringComparison.Ordinal));
        Assert.Contains(factory.Storage.Keys, key => key.StartsWith(ObjectKeys.PrefixOf(kept), StringComparison.Ordinal));
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private sealed record Everything(HttpClient Client, AuthResponse Auth, Guid Garment, IReadOnlyList<string> FileKeys);

    /// <summary>A person with consent, a wardrobe, outfits, a finished visualization, a reset code, a rated outfit and usage counters.</summary>
    private async Task<Everything> PersonWithEverythingAsync()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        factory.Visualizer.Reset();
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["rating"] = "like", ["worn"] = true, ["saved"] = true });
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        await factory.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = auth.User.Email });
        var keys = factory.Storage.Keys.Where(key => key.StartsWith(ObjectKeys.PrefixOf(auth.User.Id), StringComparison.Ordinal)).ToList();
        // Cutouts, originals, the silhouette copy and the picture.
        Assert.Contains(keys, key => key.Contains("/orig/", StringComparison.Ordinal));
        Assert.Contains(keys, key => key.Contains("/cut/", StringComparison.Ordinal));
        Assert.Contains(keys, key => key.Contains("/sil/", StringComparison.Ordinal));
        Assert.Contains(keys, key => key.Contains("/viz/", StringComparison.Ordinal));
        Assert.True(await CountRowsAsync(auth.User.Id) > wardrobe.Count);
        return new Everything(client, auth, wardrobe[0].Id, keys);
    }

    private static Task<HttpResponseMessage> Delete(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = JsonContent.Create(new JsonObject { ["password"] = password }) });

    private static Task<HttpResponseMessage> Order(HttpClient client, Guid outfit)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfit}/visualizations");
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        return client.SendAsync(request);
    }

    /// <summary>Every row, in every table that can hold something of the person.</summary>
    private Task<long> CountRowsAsync(Guid userId) => factory.WithDatabaseAsync(async db =>
    {
        var rows = await db.Users.CountAsync(row => row.Id == userId)
            + await db.RefreshTokens.CountAsync(row => row.UserId == userId)
            + await db.Clothes.CountAsync(row => row.UserId == userId)
            + await db.Outfits.CountAsync(row => row.UserId == userId)
            + await db.OutfitItems.CountAsync(row => db.Outfits.Any(outfit => outfit.Id == row.OutfitId && outfit.UserId == userId))
            + await db.Visualizations.CountAsync(row => row.UserId == userId)
            + await db.UsageCounters.CountAsync(row => row.UserId == userId)
            + await db.PasswordResetCodes.CountAsync(row => row.UserId == userId)
            + await db.AiUsage.CountAsync(row => row.UserId == userId);
        return (long)rows;
    });
}
