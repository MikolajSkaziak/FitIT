using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Persistence;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Accounts;

[Collection(ApiTests.Name)]
public sealed class RegistrationTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Avatars_are_public_and_come_five_per_gender_with_loadable_pictures()
    {
        var all = await (await _client.GetAsync("/api/avatars")).ReadAsync<List<AvatarResponse>>();
        var women = await (await _client.GetAsync("/api/avatars?gender=female")).ReadAsync<List<AvatarResponse>>();
        var men = await (await _client.GetAsync("/api/avatars?gender=male")).ReadAsync<List<AvatarResponse>>();

        Assert.Equal(10, all.Count);
        Assert.Equal(["Hourglass", "Pear", "Apple", "Column", "Goblet"], women.Select(a => a.Label));
        Assert.Equal(["Triangle", "Inverted triangle", "Rectangle", "Oval", "Trapezoid"], men.Select(a => a.Label));
        Assert.All(women, a => Assert.Equal(Gender.Female, a.Gender));

        var picture = await _client.GetAsync(new Uri(women[0].ThumbUrl).PathAndQuery);
        Assert.Equal(HttpStatusCode.OK, picture.StatusCode);
        Assert.Equal("image/jpeg", picture.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Every_avatar_comes_with_its_figure_to_draw_outfits_on()
    {
        var all = await (await _client.GetAsync("/api/avatars")).ReadAsync<List<AvatarResponse>>();

        Assert.Equal(10, all.Select(avatar => avatar.FigureUrl).Distinct().Count());
        foreach (var avatar in all)
        {
            Assert.Contains("/avatars/figure/", avatar.FigureUrl, StringComparison.Ordinal);
            var figure = await _client.GetAsync(new Uri(avatar.FigureUrl).PathAndQuery);
            Assert.Equal(HttpStatusCode.OK, figure.StatusCode);
            Assert.Equal("image/png", figure.Content.Headers.ContentType?.MediaType);
        }
    }

    [Theory]
    [InlineData("non_binary")]
    [InlineData("unspecified")]
    public async Task Avatars_for_the_open_genders_are_all_ten(string gender)
    {
        var listed = await (await _client.GetAsync($"/api/avatars?gender={gender}")).ReadAsync<List<AvatarResponse>>();

        Assert.Equal(10, listed.Count);
        Assert.Equal(AvatarCatalog.All.Select(a => a.Id).Order(), listed.Select(a => a.Id).Order());
    }

    [Fact]
    public async Task Avatars_reject_a_gender_that_is_not_on_the_list()
    {
        var response = await _client.GetAsync("/api/avatars?gender=other");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("gender_invalid", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Seeding_twice_does_not_duplicate_the_silhouettes()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();

        await initializer.SeedAvatarsAsync(CancellationToken.None);
        await initializer.SeedAvatarsAsync(CancellationToken.None);

        // Other tests add rows of their own, so count the seeded ids only.
        var seeded = AvatarCatalog.All.Select(a => a.Id).ToList();
        Assert.Equal(10, await factory.WithDatabaseAsync(db => db.Avatars.CountAsync(a => seeded.Contains(a.Id))));
    }

    [Fact]
    public async Task Registration_creates_the_account_and_signs_the_person_in()
    {
        var email = TestApi.NewEmail();

        var auth = await _client.RegisterAsync(email.ToUpperInvariant());

        Assert.Equal(email, auth.User.Email);
        Assert.Equal("Ola", auth.User.DisplayName);
        Assert.Equal(new DateOnly(1999, 3, 14), auth.User.BirthDate);
        Assert.Equal(Gender.Female, auth.User.Gender);
        Assert.Equal(TestApi.FemaleAvatar, auth.User.Avatar.Id);
        Assert.Equal([StyleTag.Casual, StyleTag.Smart], auth.User.Styles);
        Assert.Equal(ThermalPreference.Normal, auth.User.ThermalPreference);
        // Creating the account is the agreement to AI processing; the flow after it starts from the first step.
        Assert.NotNull(auth.User.AiConsentAt);
        Assert.Equal(0, auth.User.OnboardingStep);
        Assert.Null(auth.User.OnboardingDoneAt);
        Assert.Null(auth.User.ColorAnalysis);
        Assert.Equal(900, auth.ExpiresIn);
        Assert.NotEmpty(auth.AccessToken);
        Assert.NotEmpty(auth.RefreshToken);

        var me = await factory.Authorized(auth.AccessToken).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Registration_stores_the_place_rounded_to_a_tenth_of_a_degree()
    {
        var auth = await _client.RegisterAsync();

        Assert.NotNull(auth.User.Location);
        Assert.Equal(LocationSource.Device, auth.User.Location.Source);
        Assert.Equal("Gliwice", auth.User.Location.Name);
        Assert.Equal(50.3, auth.User.Location.Lat);
        Assert.Equal(18.7, auth.User.Location.Lon);
    }

    [Fact]
    public async Task Registration_works_without_styles_thermal_preference_and_place()
    {
        var auth = await _client.RegisterAsync(change: body =>
        {
            body.Remove("styles");
            body.Remove("thermalPreference");
            body.Remove("location");
        });

        Assert.Empty(auth.User.Styles);
        Assert.Equal(ThermalPreference.Normal, auth.User.ThermalPreference);
        Assert.Null(auth.User.Location);
    }

    [Fact]
    public async Task Registration_takes_size_and_leg_length_when_given_and_works_without_them()
    {
        var given = await _client.RegisterAsync(change: body =>
        {
            body["clothingSize"] = "l";
            body["legLength"] = "average";
        });
        var without = await _client.RegisterAsync();

        Assert.Equal((ClothingSize.L, LegLength.Average), (given.User.ClothingSize, given.User.LegLength));
        Assert.Equal((null, null), (without.User.ClothingSize, without.User.LegLength));
    }

    [Theory]
    [InlineData("avatarId")]
    [InlineData("birthDate")]
    [InlineData("gender")]
    [InlineData("displayName")]
    [InlineData("email")]
    [InlineData("password")]
    public async Task Registration_without_a_required_member_is_rejected_and_names_it(string member)
    {
        var body = TestApi.RegistrationBody();
        var email = body["email"]!.GetValue<string>();
        body.Remove(member);

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.ReadAsync<JsonObject>();
        Assert.Equal("validation_failed", problem["code"]!.GetValue<string>());
        Assert.NotNull(problem["errors"]![member]);
        if (member != "email")
        {
            await AssertNoAccountAsync(email);
        }
    }

    [Fact]
    public async Task Registration_with_an_unknown_silhouette_is_rejected()
    {
        var body = TestApi.RegistrationBody();
        body["avatarId"] = Guid.NewGuid().ToString();

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("avatar_invalid", await response.ProblemCodeAsync());
        await AssertNoAccountAsync(body["email"]!.GetValue<string>());
    }

    [Fact]
    public async Task Registration_with_an_inactive_silhouette_is_rejected()
    {
        var inactive = Guid.NewGuid();
        await factory.WithDatabaseAsync(async db =>
        {
            db.Avatars.Add(new Avatar { Id = inactive, Gender = Gender.Female, BodyType = $"test-{inactive:N}"[..20], Label = "Wycofana", ImagePath = "/avatars/x.jpg", ThumbPath = "/avatars/x.jpg", SortOrder = 99, IsActive = false });
            return await db.SaveChangesAsync();
        });
        var body = TestApi.RegistrationBody();
        body["avatarId"] = inactive.ToString();

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal("avatar_invalid", await response.ProblemCodeAsync());
        var listed = await (await _client.GetAsync("/api/avatars?gender=female")).ReadAsync<List<AvatarResponse>>();
        Assert.DoesNotContain(listed, a => a.Id == inactive);
    }

    [Fact]
    public async Task Registration_with_a_silhouette_of_the_other_gender_is_rejected()
    {
        var body = TestApi.RegistrationBody();
        body["avatarId"] = TestApi.MaleAvatar.ToString();

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("avatar_gender_mismatch", await response.ProblemCodeAsync());
    }

    [Theory]
    [InlineData("non_binary", true)]
    [InlineData("non_binary", false)]
    [InlineData("unspecified", true)]
    [InlineData("unspecified", false)]
    public async Task Registration_with_an_open_gender_accepts_a_silhouette_of_either_set(string gender, bool male)
    {
        var auth = await _client.RegisterAsync(change: body =>
        {
            body["gender"] = gender;
            body["avatarId"] = (male ? TestApi.MaleAvatar : TestApi.FemaleAvatar).ToString();
        });

        Assert.Equal(gender == "non_binary" ? Gender.NonBinary : Gender.Unspecified, auth.User.Gender);
        Assert.Equal(male ? TestApi.MaleAvatar : TestApi.FemaleAvatar, auth.User.Avatar.Id);
    }

    [Fact]
    public async Task The_post_registration_flow_is_remembered_on_the_account_and_only_moves_forward()
    {
        var auth = await _client.RegisterAsync();
        var client = factory.Authorized(auth.AccessToken);
        Assert.Equal((0, null), (auth.User.OnboardingStep, auth.User.OnboardingDoneAt));

        var second = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["onboardingStep"] = 2 })).ReadAsync<UserResponse>();
        var back = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["onboardingStep"] = 1 })).ReadAsync<UserResponse>();
        var tooFar = await client.PatchJsonAsync("/api/me", new JsonObject { ["onboardingStep"] = 3 });
        Assert.Equal((2, 2), (second.OnboardingStep, back.OnboardingStep));
        Assert.Equal(HttpStatusCode.BadRequest, tooFar.StatusCode);
        Assert.Null(back.OnboardingDoneAt);

        var done = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["onboardingDone"] = true })).ReadAsync<UserResponse>();
        Assert.NotNull(done.OnboardingDoneAt);

        // A second phone signing in sees the same, and the mark does not move once set.
        factory.Clock.Advance(TimeSpan.FromHours(1));
        var login = await (await _client.PostJsonAsync("/api/auth/login", new JsonObject { ["email"] = auth.User.Email, ["password"] = TestApi.Password })).ReadAsync<AuthResponse>();
        var again = await (await factory.Authorized(login.AccessToken).PatchJsonAsync("/api/me", new JsonObject { ["onboardingDone"] = true })).ReadAsync<UserResponse>();
        Assert.Equal(done.OnboardingDoneAt, login.User.OnboardingDoneAt);
        Assert.Equal(done.OnboardingDoneAt, again.OnboardingDoneAt);
    }

    [Fact]
    public async Task Registration_needs_the_sixteenth_birthday_to_have_passed()
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw")).DateTime);

        var dayTooYoung = TestApi.RegistrationBody();
        dayTooYoung["birthDate"] = today.AddYears(-16).AddDays(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var rejected = await _client.PostJsonAsync("/api/auth/register", dayTooYoung);

        var sixteenToday = TestApi.RegistrationBody();
        sixteenToday["birthDate"] = today.AddYears(-16).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var accepted = await _client.PostJsonAsync("/api/auth/register", sixteenToday);

        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Equal("underage", await rejected.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
    }

    [Theory]
    [InlineData("2999-01-01")]
    [InlineData("1850-01-01")]
    public async Task Registration_rejects_an_impossible_birth_date(string birthDate)
    {
        var body = TestApi.RegistrationBody();
        body["birthDate"] = birthDate;

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal("birth_date_invalid", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Registration_with_a_taken_email_returns_conflict_whatever_the_letter_case()
    {
        var email = TestApi.NewEmail();
        await _client.RegisterAsync(email);

        var response = await _client.PostJsonAsync("/api/auth/register", TestApi.RegistrationBody(email.ToUpperInvariant()));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("email_taken", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Registration_rejects_a_password_shorter_than_eight_characters()
    {
        var body = TestApi.RegistrationBody();
        body["password"] = "krotkie";

        var response = await _client.PostJsonAsync("/api/auth/register", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull((await response.ReadAsync<JsonObject>())["errors"]!["password"]);
    }

    [Fact]
    public async Task Registration_accepts_a_long_passphrase_without_digits_or_capitals()
    {
        var auth = await _client.RegisterAsync(change: body => body["password"] = "zielona szafa pelna ubran");

        Assert.NotEmpty(auth.AccessToken);
    }

    [Fact]
    public async Task Registration_rejects_a_style_or_a_place_that_is_not_valid()
    {
        var badStyle = TestApi.RegistrationBody();
        badStyle["styles"] = new JsonArray("casual", "gotycki");
        var badPlace = TestApi.RegistrationBody();
        badPlace["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Nigdzie", ["lat"] = 123.0, ["lon"] = 18.7 };

        var styleResponse = await _client.PostJsonAsync("/api/auth/register", badStyle);
        var placeResponse = await _client.PostJsonAsync("/api/auth/register", badPlace);

        Assert.Equal(HttpStatusCode.BadRequest, styleResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, placeResponse.StatusCode);
        Assert.NotNull((await placeResponse.ReadAsync<JsonObject>())["errors"]!["location.lat"]);
    }

    [Fact]
    public async Task Email_check_tells_whether_an_address_is_free()
    {
        var email = TestApi.NewEmail();
        await _client.RegisterAsync(email);

        var taken = await (await _client.PostJsonAsync("/api/auth/email-check", new JsonObject { ["email"] = email.ToUpperInvariant() })).ReadAsync<EmailCheckResponse>();
        var free = await (await _client.PostJsonAsync("/api/auth/email-check", new JsonObject { ["email"] = TestApi.NewEmail() })).ReadAsync<EmailCheckResponse>();

        Assert.False(taken.Available);
        Assert.True(free.Available);
    }

    [Fact]
    public async Task Place_search_finds_a_city_by_the_start_of_its_name_without_diacritics()
    {
        var found = await (await _client.GetAsync("/api/locations?query=lod")).ReadAsync<List<PlaceResponse>>();
        var tooShort = await _client.GetAsync("/api/locations?query=l");

        Assert.Equal("Łódź", Assert.Single(found).Name);
        Assert.Equal("query_invalid", await tooShort.ProblemCodeAsync());
    }

    private async Task AssertNoAccountAsync(string email)
    {
        var check = await (await _client.PostJsonAsync("/api/auth/email-check", new JsonObject { ["email"] = email })).ReadAsync<EmailCheckResponse>();
        Assert.True(check.Available, "A rejected registration must not leave an account behind.");
    }
}
