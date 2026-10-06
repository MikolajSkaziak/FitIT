using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Infrastructure.Accounts;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Tests.Accounts;

[Collection(ApiTests.Name)]
public sealed class SessionTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    private static JsonObject Credentials(string email, string password = TestApi.Password) => new() { ["email"] = email, ["password"] = password };

    private static JsonObject Token(string refreshToken) => new() { ["refreshToken"] = refreshToken };

    [Fact]
    public async Task Login_returns_tokens_and_the_profile()
    {
        var email = TestApi.NewEmail();
        await _client.RegisterAsync(email);

        var response = await _client.PostJsonAsync("/api/auth/login", Credentials(email.ToUpperInvariant()));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.ReadAsync<AuthResponse>();
        Assert.Equal(email, auth.User.Email);
        Assert.Equal(TestApi.FemaleAvatar, auth.User.Avatar.Id);
    }

    [Fact]
    public async Task Login_gives_the_same_answer_for_a_wrong_password_and_an_unknown_address()
    {
        var email = TestApi.NewEmail();
        await _client.RegisterAsync(email);

        var wrongPassword = await _client.PostJsonAsync("/api/auth/login", Credentials(email, "inne-haslo-123"));
        var unknown = await _client.PostJsonAsync("/api/auth/login", Credentials(TestApi.NewEmail()));

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal("invalid_credentials", await wrongPassword.ProblemCodeAsync());
        Assert.Equal("invalid_credentials", await unknown.ProblemCodeAsync());
    }

    [Fact]
    public async Task Five_failed_logins_lock_the_account_even_for_the_right_password()
    {
        var email = TestApi.NewEmail();
        await _client.RegisterAsync(email);

        for (var attempt = 0; attempt < 4; attempt++)
        {
            var failed = await _client.PostJsonAsync("/api/auth/login", Credentials(email, "zle-haslo-123"));
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        }

        var fifth = await _client.PostJsonAsync("/api/auth/login", Credentials(email, "zle-haslo-123"));
        var correct = await _client.PostJsonAsync("/api/auth/login", Credentials(email));

        Assert.Equal(HttpStatusCode.TooManyRequests, fifth.StatusCode);
        Assert.Equal("locked_out", await fifth.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.TooManyRequests, correct.StatusCode);
    }

    [Fact]
    public async Task Refresh_returns_a_new_pair_and_the_used_token_stops_working()
    {
        var auth = await _client.RegisterAsync();

        var first = await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken));
        var replay = await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken));

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var pair = await first.ReadAsync<TokenResponse>();
        Assert.NotEqual(auth.RefreshToken, pair.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, (await factory.Authorized(pair.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal("invalid_refresh_token", await replay.ProblemCodeAsync());
    }

    [Fact]
    public async Task Replaying_a_used_refresh_token_ends_every_session_of_that_person()
    {
        var auth = await _client.RegisterAsync();
        var rotated = await (await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken))).ReadAsync<TokenResponse>();

        await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken));
        var afterTheft = await _client.PostJsonAsync("/api/auth/refresh", Token(rotated.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, afterTheft.StatusCode);
    }

    [Fact]
    public async Task Only_the_hash_of_a_refresh_token_is_stored()
    {
        var auth = await _client.RegisterAsync();

        var hashes = await factory.WithDatabaseAsync(db => db.RefreshTokens.Where(t => t.UserId == auth.User.Id).Select(t => t.TokenHash).ToListAsync());

        var stored = Assert.Single(hashes);
        Assert.NotEqual(auth.RefreshToken, stored);
        Assert.Equal(TokenService.Hash(auth.RefreshToken), stored);
        Assert.Equal(64, stored.Length);
    }

    [Fact]
    public async Task An_unknown_or_malformed_refresh_token_is_refused()
    {
        var unknown = await _client.PostJsonAsync("/api/auth/refresh", Token(TokenService.NewRefreshToken()));
        var empty = await _client.PostJsonAsync("/api/auth/refresh", Token(""));

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var auth = await _client.RegisterAsync();

        var logout = await factory.Authorized(auth.AccessToken).PostJsonAsync("/api/auth/logout", Token(auth.RefreshToken));
        var refresh = await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken));

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Logout_needs_a_signed_in_person_and_cannot_revoke_someone_elses_token()
    {
        var victim = await _client.RegisterAsync();
        var other = await _client.RegisterAsync();

        var anonymous = await _client.PostJsonAsync("/api/auth/logout", Token(victim.RefreshToken));
        await factory.Authorized(other.AccessToken).PostJsonAsync("/api/auth/logout", Token(victim.RefreshToken));
        var victimRefresh = await _client.PostJsonAsync("/api/auth/refresh", Token(victim.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.OK, victimRefresh.StatusCode);
    }

    [Fact]
    public async Task The_access_token_expires_after_fifteen_minutes_and_refresh_brings_the_session_back()
    {
        var auth = await _client.RegisterAsync();
        var signedIn = factory.Authorized(auth.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await signedIn.GetAsync("/api/me")).StatusCode);

        factory.Clock.Advance(TimeSpan.FromMinutes(14));
        var stillValid = await signedIn.GetAsync("/api/me");
        factory.Clock.Advance(TimeSpan.FromMinutes(2));
        var expired = await signedIn.GetAsync("/api/me");
        var pair = await (await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken))).ReadAsync<TokenResponse>();
        var renewed = await factory.Authorized(pair.AccessToken).GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, stillValid.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, expired.StatusCode);
        Assert.Equal(HttpStatusCode.OK, renewed.StatusCode);
    }

    [Fact]
    public async Task The_refresh_token_expires_after_thirty_days()
    {
        var auth = await _client.RegisterAsync();

        factory.Clock.Advance(TimeSpan.FromDays(30) + TimeSpan.FromMinutes(1));
        var response = await _client.PostJsonAsync("/api/auth/refresh", Token(auth.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_token_signed_with_another_key_is_refused()
    {
        var forged = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMWExMTAxYi1iZTQ2LTc1NzYtYmI1OC0xMGQxZGViOGQyNDIiLCJpc3MiOiJmaXRpdCIsImF1ZCI6ImZpdGl0LWFwcCIsImV4cCI6NDEwMjQ0NDgwMH0.c2lnbmF0dXJlLXRoYXQtZG9lcy1ub3QtbWF0Y2g";

        var response = await factory.Authorized(forged).GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
