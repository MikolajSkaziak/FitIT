using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Accounts;
using FitIt.Tests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FitIt.Tests.Accounts;

/// <summary>Resetting a forgotten password with a code from an e-mail (plan 5.2), and changing it while signed in.</summary>
[Collection(ApiTests.Name)]
public sealed partial class PasswordResetTests(ApiFactory factory)
{
    private const string NewPassword = "nowe-tajne-haslo-1";

    [GeneratedRegex(@"(?<![0-9])[0-9]{6}(?![0-9])")]
    private static partial Regex SixDigits();

    // ---- asking for a code -----------------------------------------------------------------------------------------

    [Fact]
    public async Task A_code_is_sent_to_an_address_that_has_an_account()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();

        var response = await RequestAsync(auth.User.Email);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var message = Assert.Single(factory.Email.Sent);
        Assert.Equal(auth.User.Email, message.To);
        Assert.Equal(PasswordResetMessage.Subject, message.Subject);
        Assert.Matches(SixDigits(), message.Body);
        Assert.Contains("15 minut", message.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_message_is_plain_english_without_dashes_or_markup()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);

        var message = Assert.Single(factory.Email.Sent);

        Assert.DoesNotContain('—', message.Body);
        Assert.DoesNotContain('–', message.Body);
        Assert.DoesNotContain("<", message.Body, StringComparison.Ordinal);
        Assert.Contains("password reset code", message.Subject, StringComparison.Ordinal);
        Assert.Contains("If you did not ask for this", message.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_answer_does_not_tell_whether_an_address_has_an_account()
    {
        var (_, known) = await factory.SignedInAsync();
        factory.Email.Clear();

        var existing = await RequestAsync(known.User.Email);
        var unknown = await RequestAsync(TestApi.NewEmail());
        var otherCase = await RequestAsync("  " + known.User.Email.ToUpperInvariant() + " ".Trim());

        Assert.Equal(HttpStatusCode.NoContent, existing.StatusCode);
        Assert.Equal(existing.StatusCode, unknown.StatusCode);
        Assert.Equal(existing.StatusCode, otherCase.StatusCode);
        Assert.Equal(await existing.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Equal(existing.Content.Headers.ContentLength, unknown.Content.Headers.ContentLength);
        Assert.Equal(existing.Headers.Select(header => header.Key).Order(), unknown.Headers.Select(header => header.Key).Order());
        // Only the address that has an account got a message.
        Assert.All(factory.Email.Sent, message => Assert.Equal(known.User.Email, message.To));
    }

    [Fact]
    public async Task Confirming_a_code_for_an_address_that_has_no_account_fails_like_a_wrong_code()
    {
        var (_, known) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(known.User.Email);

        var unknown = await ConfirmAsync(TestApi.NewEmail(), "123456");
        var wrong = await ConfirmAsync(known.User.Email, "000000" == CodeFor(known.User.Email) ? "000001" : "000000");

        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        var seen = await ProblemAsync(unknown);
        Assert.Equal(await ProblemAsync(wrong), seen);
        Assert.Contains("invalid_reset_code", seen, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-address")]
    public async Task A_malformed_address_is_refused_as_such_and_sends_nothing(string address)
    {
        factory.Email.Clear();

        var response = await RequestAsync(address);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ProblemCodeAsync());
        Assert.Empty(factory.Email.Sent);
    }

    [Fact]
    public async Task The_code_is_stored_only_as_a_keyed_hash()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);

        var stored = await factory.WithDatabaseAsync(db => db.PasswordResetCodes.AsNoTracking().SingleAsync(entry => entry.UserId == auth.User.Id));

        Assert.Matches("^[0-9a-f]{64}$", stored.CodeHash);
        Assert.DoesNotContain(code, stored.CodeHash, StringComparison.Ordinal);
        Assert.NotEqual(Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code))), stored.CodeHash);
        Assert.Equal(factory.Clock.GetUtcNow().AddMinutes(15), stored.ExpiresAt);
        Assert.Equal((0, null), (stored.Attempts, stored.UsedAt));
    }

    [Fact]
    public async Task A_code_that_was_asked_for_again_cancels_the_one_before()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var first = CodeFor(auth.User.Email);
        await RequestAsync(auth.User.Email);
        var second = CodeFor(auth.User.Email);

        // Two draws of six digits are the same one time in a million; then the test has nothing to say.
        if (first != second)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await ConfirmAsync(auth.User.Email, first)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, second)).StatusCode);
    }

    [Fact]
    public async Task Beyond_three_requests_an_hour_for_one_address_nothing_more_is_sent_and_nothing_is_said()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();

        var statuses = new List<HttpStatusCode>();
        for (var request = 0; request < 5; request++)
        {
            statuses.Add((await RequestAsync(auth.User.Email)).StatusCode);
        }

        // To the person asking, the fourth request looks like the first.
        Assert.All(statuses, status => Assert.Equal(HttpStatusCode.NoContent, status));
        Assert.Equal(3, factory.Email.Sent.Count);

        factory.Clock.Advance(TimeSpan.FromMinutes(61));
        Assert.Equal(HttpStatusCode.NoContent, (await RequestAsync(auth.User.Email)).StatusCode);
        Assert.Equal(4, factory.Email.Sent.Count);
    }

    [Fact]
    public async Task One_caller_may_only_ask_so_often_whoever_they_ask_about()
    {
        using var host = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimits:PasswordResetPer15Minutes", "3");
            builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter, Api.PeerAddressFilter>());
        });
        var client = host.CreateClient();

        async Task<HttpStatusCode> AskAsync(string path, string peer, JsonObject body)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
            request.Headers.Add("X-Test-Peer", peer);
            return (await client.SendAsync(request)).StatusCode;
        }

        // Asking and trying share one allowance for the caller, so guessing codes cannot be done faster than asking for them.
        var request = new JsonObject { ["email"] = TestApi.NewEmail() };
        var confirm = new JsonObject { ["email"] = TestApi.NewEmail(), ["code"] = "123456", ["newPassword"] = NewPassword };
        Assert.Equal(HttpStatusCode.NoContent, await AskAsync("/api/auth/password-reset/request", "198.51.100.1", request));
        Assert.Equal(HttpStatusCode.BadRequest, await AskAsync("/api/auth/password-reset/confirm", "198.51.100.1", confirm));
        Assert.Equal(HttpStatusCode.NoContent, await AskAsync("/api/auth/password-reset/request", "198.51.100.1", request));
        var refused = await client.SendAsync(WithPeer("/api/auth/password-reset/confirm", "198.51.100.1", confirm));
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal("rate_limited", await refused.ProblemCodeAsync());

        // Somebody at another address is not held up by it.
        Assert.Equal(HttpStatusCode.NoContent, await AskAsync("/api/auth/password-reset/request", "198.51.100.2", request));

        HttpRequestMessage WithPeer(string path, string peer, JsonObject body)
        {
            var message = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
            message.Headers.Add("X-Test-Peer", peer);
            return message;
        }
    }

    [Fact]
    public async Task A_mail_service_that_fails_is_not_visible_to_the_caller()
    {
        var (_, auth) = await factory.SignedInAsync();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender, BrokenMail>();
        }));

        var existing = await host.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = auth.User.Email });
        var unknown = await host.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = TestApi.NewEmail() });

        Assert.Equal(HttpStatusCode.NoContent, existing.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, unknown.StatusCode);
    }

    // ---- using the code --------------------------------------------------------------------------------------------

    [Fact]
    public async Task The_right_code_sets_the_new_password_and_ends_every_session()
    {
        var (_, auth) = await factory.SignedInAsync();
        var otherSession = await Login(auth.User.Email);
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);

        var response = await ConfirmAsync(auth.User.Email, CodeFor(auth.User.Email));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
        foreach (var refreshToken in new[] { auth.RefreshToken, otherSession.RefreshToken })
        {
            var refreshed = await factory.CreateClient().PostJsonAsync("/api/auth/refresh", new JsonObject { ["refreshToken"] = refreshToken });
            Assert.Equal(HttpStatusCode.Unauthorized, refreshed.StatusCode);
            Assert.Equal("invalid_refresh_token", await refreshed.ProblemCodeAsync());
        }

        // The session that starts now is a new one and works. (Asked after the old ones: presenting a dead token ends every session.)
        var signedIn = await LoginResponse(auth.User.Email, NewPassword);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        var fresh = await signedIn.ReadAsync<AuthResponse>();
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().PostJsonAsync("/api/auth/refresh", new JsonObject { ["refreshToken"] = fresh.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task A_code_works_once()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);
        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, code)).StatusCode);

        var again = await ConfirmAsync(auth.User.Email, code, "ten-trzeci-pomysl-3");

        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Equal("invalid_reset_code", await again.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, NewPassword)).StatusCode);
        Assert.NotNull((await factory.WithDatabaseAsync(db => db.PasswordResetCodes.SingleAsync(entry => entry.UserId == auth.User.Id))).UsedAt);
    }

    [Fact]
    public async Task Two_requests_with_the_right_code_at_once_set_only_one_password()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(index => ConfirmAsync(auth.User.Email, code, $"haslo-numer-{index}-ok")));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.NoContent));
        Assert.All(responses.Where(response => response.StatusCode != HttpStatusCode.NoContent), response => Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode));
    }

    [Fact]
    public async Task A_code_expires_after_fifteen_minutes()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);

        factory.Clock.Advance(TimeSpan.FromMinutes(15).Add(TimeSpan.FromSeconds(1)));
        var late = await ConfirmAsync(auth.User.Email, code);

        Assert.Equal(HttpStatusCode.BadRequest, late.StatusCode);
        Assert.Equal("invalid_reset_code", await late.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
    }

    [Fact]
    public async Task A_code_still_works_just_before_it_expires()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);

        factory.Clock.Advance(TimeSpan.FromMinutes(14).Add(TimeSpan.FromSeconds(59)));

        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, code)).StatusCode);
    }

    [Fact]
    public async Task After_five_wrong_guesses_even_the_right_code_is_dead()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);
        var wrong = code == "000000" ? "000001" : "000000";

        for (var guess = 0; guess < 5; guess++)
        {
            var response = await ConfirmAsync(auth.User.Email, wrong);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("invalid_reset_code", await response.ProblemCodeAsync());
        }

        var right = await ConfirmAsync(auth.User.Email, code);

        Assert.Equal(HttpStatusCode.BadRequest, right.StatusCode);
        Assert.Equal("invalid_reset_code", await right.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);

        // A new code is a new start.
        await RequestAsync(auth.User.Email);
        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, CodeFor(auth.User.Email))).StatusCode);
    }

    [Fact]
    public async Task Guesses_made_at_the_same_moment_cannot_get_around_the_limit()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);
        var wrong = Enumerable.Range(0, 30).Select(number => number.ToString("D6", System.Globalization.CultureInfo.InvariantCulture)).Where(guess => guess != code);

        await Task.WhenAll(wrong.Select(guess => ConfirmAsync(auth.User.Email, guess)));

        var attempts = await factory.WithDatabaseAsync(db => db.PasswordResetCodes.Where(entry => entry.UserId == auth.User.Id).Select(entry => entry.Attempts).SingleAsync());
        Assert.Equal(5, attempts);
        Assert.Equal(HttpStatusCode.BadRequest, (await ConfirmAsync(auth.User.Email, code)).StatusCode);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12 456")]
    [InlineData("abcdef")]
    [InlineData("")]
    public async Task A_code_that_is_not_six_digits_is_refused_before_it_is_weighed(string code)
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);

        var response = await ConfirmAsync(auth.User.Email, code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ProblemCodeAsync());
        Assert.Equal(0, (await factory.WithDatabaseAsync(db => db.PasswordResetCodes.SingleAsync(entry => entry.UserId == auth.User.Id))).Attempts);
    }

    [Fact]
    public async Task A_password_that_is_too_short_is_refused_and_does_not_use_up_the_code()
    {
        var (_, auth) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);
        var code = CodeFor(auth.User.Email);

        var weak = await ConfirmAsync(auth.User.Email, code, "krotkie");

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal("validation_failed", await weak.ProblemCodeAsync());
        var stored = await factory.WithDatabaseAsync(db => db.PasswordResetCodes.SingleAsync(entry => entry.UserId == auth.User.Id));
        Assert.Equal((0, null), (stored.Attempts, stored.UsedAt));
        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, code)).StatusCode);
    }

    [Fact]
    public async Task A_reset_lifts_a_lockout()
    {
        var (_, auth) = await factory.SignedInAsync();
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await LoginResponse(auth.User.Email, "zle-haslo-123");
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
        factory.Email.Clear();
        await RequestAsync(auth.User.Email);

        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(auth.User.Email, CodeFor(auth.User.Email))).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task A_code_for_one_person_does_not_open_another_persons_account()
    {
        var (_, ola) = await factory.SignedInAsync();
        var (_, ala) = await factory.SignedInAsync();
        factory.Email.Clear();
        await RequestAsync(ola.User.Email);
        await RequestAsync(ala.User.Email);

        var mixedUp = await ConfirmAsync(ala.User.Email, CodeFor(ola.User.Email));

        // The codes differ unless the draw coincided; the test has something to say only when it did not.
        if (CodeFor(ola.User.Email) != CodeFor(ala.User.Email))
        {
            Assert.Equal(HttpStatusCode.BadRequest, mixedUp.StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(ola.User.Email, TestApi.Password)).StatusCode);
    }

    // ---- changing the password while signed in ---------------------------------------------------------------------

    [Fact]
    public async Task Changing_the_password_needs_a_signed_in_person()
    {
        var response = await factory.CreateClient().PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = TestApi.Password, ["newPassword"] = NewPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_ends_the_other_sessions_and_keeps_the_one_that_asked()
    {
        var (client, auth) = await factory.SignedInAsync();
        var other = await Login(auth.User.Email);

        var response = await client.PostJsonAsync("/api/me/password", new JsonObject
        {
            ["currentPassword"] = TestApi.Password,
            ["newPassword"] = NewPassword,
            ["refreshToken"] = auth.RefreshToken,
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, NewPassword)).StatusCode);
        // The session that asked goes on; asked first, because presenting a dead token ends every session.
        Assert.Equal(HttpStatusCode.OK, (await Refresh(auth.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(other.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Without_naming_a_session_to_keep_every_session_ends()
    {
        var (client, auth) = await factory.SignedInAsync();

        var response = await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = TestApi.Password, ["newPassword"] = NewPassword });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(auth.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task A_refresh_token_of_somebody_else_cannot_be_named_as_the_session_to_keep()
    {
        var (client, auth) = await factory.SignedInAsync();
        var (_, stranger) = await factory.SignedInAsync();

        await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = TestApi.Password, ["newPassword"] = NewPassword, ["refreshToken"] = stranger.RefreshToken });

        // Naming it keeps nothing of this person's, and takes nothing from theirs.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(auth.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(stranger.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task A_wrong_current_password_changes_nothing_and_counts_toward_the_lockout()
    {
        var (client, auth) = await factory.SignedInAsync();

        var wrong = await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = "zle-haslo-123", ["newPassword"] = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("wrong_password", await wrong.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(auth.RefreshToken)).StatusCode);

        // The login above was right and so cleared the count; five wrong ones in a row lock the account.
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = "zle-haslo-123", ["newPassword"] = NewPassword });
        }

        // Guessing the password through a stolen access token is as hard as guessing it at the login.
        var locked = await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = TestApi.Password, ["newPassword"] = NewPassword });
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.Equal("locked_out", await locked.ProblemCodeAsync());
    }

    [Theory]
    [InlineData("krotkie")]
    [InlineData("")]
    public async Task A_new_password_that_is_too_short_is_refused(string newPassword)
    {
        var (client, auth) = await factory.SignedInAsync();

        var response = await client.PostJsonAsync("/api/me/password", new JsonObject { ["currentPassword"] = TestApi.Password, ["newPassword"] = newPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, (await LoginResponse(auth.User.Email, TestApi.Password)).StatusCode);
    }

    [Fact]
    public async Task The_contract_of_the_password_routes_is_typed_in_the_openapi_document()
    {
        var document = await factory.CreateClient().GetFromJsonAsync<JsonObject>("/openapi/v1.json");

        var paths = document!["paths"]!;
        Assert.Equal("requestPasswordReset", paths["/api/auth/password-reset/request"]!["post"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["204", "400", "429"], paths["/api/auth/password-reset/request"]!["post"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        Assert.Equal("confirmPasswordReset", paths["/api/auth/password-reset/confirm"]!["post"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["204", "400", "429"], paths["/api/auth/password-reset/confirm"]!["post"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        Assert.Equal("changePassword", paths["/api/me/password"]!["post"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["204", "400", "401", "429"], paths["/api/me/password"]!["post"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        Assert.Equal("deleteAccount", paths["/api/me"]!["delete"]!["operationId"]!.GetValue<string>());
        Assert.Equal(["204", "400", "401", "429"], paths["/api/me"]!["delete"]!["responses"]!.AsObject().Select(response => response.Key).Order());
        Assert.NotNull(paths["/api/me"]!["delete"]!["requestBody"]);
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private Task<HttpResponseMessage> RequestAsync(string email) =>
        factory.CreateClient().PostJsonAsync("/api/auth/password-reset/request", new JsonObject { ["email"] = email });

    private Task<HttpResponseMessage> ConfirmAsync(string email, string code, string newPassword = NewPassword) =>
        factory.CreateClient().PostJsonAsync("/api/auth/password-reset/confirm", new JsonObject { ["email"] = email, ["code"] = code, ["newPassword"] = newPassword });

    /// <summary>The code of the newest message to the address: what the person would read in their mail.</summary>
    private string CodeFor(string email) =>
        SixDigits().Match(factory.Email.Sent.Last(message => message.To == email).Body).Value;

    private Task<HttpResponseMessage> LoginResponse(string email, string password) =>
        factory.CreateClient().PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = email, ["password"] = password });

    private async Task<AuthResponse> Login(string email)
    {
        var response = await LoginResponse(email, TestApi.Password);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<AuthResponse>();
    }

    private Task<HttpResponseMessage> Refresh(string refreshToken) =>
        factory.CreateClient().PostJsonAsync("/api/auth/refresh", new JsonObject { ["refreshToken"] = refreshToken });

    private static async Task<string> ProblemAsync(HttpResponseMessage response)
    {
        var problem = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        // Only what the app can see: the code and the words, not the per-request trace id.
        return $"{response.StatusCode} {problem["code"]} {problem["title"]} {problem["status"]}";
    }

    private sealed class BrokenMail : IEmailSender
    {
        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken) => throw new ProviderException("The mail service is down.");
    }
}
