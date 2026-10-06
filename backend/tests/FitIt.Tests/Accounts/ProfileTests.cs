using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;

namespace FitIt.Tests.Accounts;

[Collection(ApiTests.Name)]
public sealed class ProfileTests(ApiFactory factory)
{
    [Fact]
    public async Task The_profile_needs_a_signed_in_person()
    {
        var client = factory.CreateClient();

        var get = await client.GetAsync("/api/me");
        var patch = await client.PatchJsonAsync("/api/me", new JsonObject { ["displayName"] = "Kto" });

        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
        Assert.Equal("unauthorized", await get.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, patch.StatusCode);
    }

    [Fact]
    public async Task A_patch_changes_only_what_it_names()
    {
        var (client, auth) = await factory.SignedInAsync();

        var response = await client.PatchJsonAsync("/api/me", new JsonObject
        {
            ["displayName"] = "  Aleksandra ",
            ["styles"] = new JsonArray("elegant"),
            ["thermalPreference"] = "runs_cold",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await response.ReadAsync<UserResponse>();
        Assert.Equal("Aleksandra", user.DisplayName);
        Assert.Equal([StyleTag.Elegant], user.Styles);
        Assert.Equal(ThermalPreference.RunsCold, user.ThermalPreference);
        Assert.Equal(auth.User.BirthDate, user.BirthDate);
        Assert.Equal(auth.User.Avatar.Id, user.Avatar.Id);
        Assert.Equal(auth.User.Location, user.Location);

        var reloaded = await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>();
        Assert.Equal("Aleksandra", reloaded.DisplayName);
    }

    [Fact]
    public async Task The_silhouette_can_be_changed_within_the_same_gender_only()
    {
        var (client, _) = await factory.SignedInAsync();
        var otherFemale = AvatarCatalog.All.First(a => a.Gender == Gender.Female && a.Id != TestApi.FemaleAvatar).Id;

        var changed = await client.PatchJsonAsync("/api/me", new JsonObject { ["avatarId"] = otherFemale.ToString() });
        var wrongGender = await client.PatchJsonAsync("/api/me", new JsonObject { ["avatarId"] = TestApi.MaleAvatar.ToString() });
        var unknown = await client.PatchJsonAsync("/api/me", new JsonObject { ["avatarId"] = Guid.NewGuid().ToString() });

        Assert.Equal(otherFemale, (await changed.ReadAsync<UserResponse>()).Avatar.Id);
        Assert.Equal("avatar_gender_mismatch", await wrongGender.ProblemCodeAsync());
        Assert.Equal("avatar_invalid", await unknown.ProblemCodeAsync());
        Assert.Equal(otherFemale, (await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>()).Avatar.Id);
    }

    [Fact]
    public async Task Changing_the_gender_needs_a_silhouette_of_that_gender_in_the_same_request()
    {
        var (client, _) = await factory.SignedInAsync();

        var alone = await client.PatchJsonAsync("/api/me", new JsonObject { ["gender"] = "male" });
        var together = await client.PatchJsonAsync("/api/me", new JsonObject { ["gender"] = "male", ["avatarId"] = TestApi.MaleAvatar.ToString() });

        Assert.Equal("avatar_gender_mismatch", await alone.ProblemCodeAsync());
        var user = await together.ReadAsync<UserResponse>();
        Assert.Equal(Gender.Male, user.Gender);
        Assert.Equal(TestApi.MaleAvatar, user.Avatar.Id);
    }

    [Fact]
    public async Task Consent_is_dated_when_given_keeps_its_date_and_can_be_withdrawn()
    {
        var (client, _) = await factory.SignedInAsync();

        var given = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["aiConsent"] = true })).ReadAsync<UserResponse>();
        factory.Clock.Advance(TimeSpan.FromMinutes(5));
        var repeated = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["aiConsent"] = true })).ReadAsync<UserResponse>();
        var withdrawn = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["aiConsent"] = false })).ReadAsync<UserResponse>();

        Assert.NotNull(given.AiConsentAt);
        Assert.Equal(given.AiConsentAt, repeated.AiConsentAt);
        Assert.Null(withdrawn.AiConsentAt);
    }

    [Fact]
    public async Task The_weather_place_can_be_replaced_by_a_typed_city_and_cleared()
    {
        var (client, _) = await factory.SignedInAsync();

        var manual = await (await client.PatchJsonAsync("/api/me", new JsonObject
        {
            ["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Kraków", ["lat"] = 50.0614, ["lon"] = 19.9366 },
        })).ReadAsync<UserResponse>();
        var cleared = await (await client.PatchJsonAsync("/api/me", new JsonObject { ["clearLocation"] = true })).ReadAsync<UserResponse>();

        Assert.Equal(new LocationResponse(LocationSource.Manual, "Kraków", 50.1, 19.9), manual.Location);
        Assert.Null(cleared.Location);
    }

    [Fact]
    public async Task A_patch_with_invalid_values_is_rejected_and_changes_nothing()
    {
        var (client, auth) = await factory.SignedInAsync();

        var emptyName = await client.PatchJsonAsync("/api/me", new JsonObject { ["displayName"] = "" });
        var tooYoung = await client.PatchJsonAsync("/api/me", new JsonObject { ["birthDate"] = "2020-01-01" });

        Assert.Equal(HttpStatusCode.BadRequest, emptyName.StatusCode);
        Assert.Equal("underage", await tooYoung.ProblemCodeAsync());
        var user = await (await client.GetAsync("/api/me")).ReadAsync<UserResponse>();
        Assert.Equal(auth.User.DisplayName, user.DisplayName);
        Assert.Equal(auth.User.BirthDate, user.BirthDate);
    }
}
