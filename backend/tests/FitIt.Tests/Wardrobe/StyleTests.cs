using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;

namespace FitIt.Tests.Wardrobe;

public sealed class StyleCatalogTests
{
    private static readonly string[] Order =
        ["casual", "smart", "elegant", "sporty", "streetwear", "minimalist", "old_money", "preppy", "vintage", "y2k", "boho", "grunge", "gorpcore", "business", "romantic", "edgy"];

    [Fact]
    public void The_styles_come_in_the_order_of_the_screen_with_their_exact_codes()
    {
        Assert.Equal(Order, EnumCodes.All<StyleTag>());
        Assert.Equal(StyleTag.Y2k, EnumCodes.Parse<StyleTag>("y2k"));
        Assert.Equal(StyleTag.OldMoney, EnumCodes.Parse<StyleTag>("old_money"));
        Assert.All(Enum.GetValues<StyleTag>(), style => Assert.Equal(style, EnumCodes.Parse<StyleTag>(EnumCodes.ToCode(style))));
    }

    [Fact]
    public void A_person_may_prefer_all_the_styles_there_are() =>
        Assert.Equal(GarmentCatalog.MaxPreferredStyles, Enum.GetValues<StyleTag>().Length);

    [Fact]
    public void Every_style_has_a_label_a_person_can_read()
    {
        Assert.Equal(
            ["Casual", "Smart casual", "Elegant", "Sporty", "Streetwear", "Minimalist", "Old money", "Preppy", "Vintage", "Y2K", "Boho", "Grunge", "Gorpcore", "Business", "Romantic", "Edgy"],
            Enum.GetValues<StyleTag>().Select(GarmentCatalog.Label));
    }

    [Fact]
    public void Every_style_has_both_reference_photos_in_the_static_files()
    {
        var folder = Path.Combine(AppContext.BaseDirectory, "wwwroot", "styles");
        if (!Directory.Exists(folder))
        {
            folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "FitIt.Api", "wwwroot", "styles"));
        }

        Assert.All(Enum.GetValues<StyleTag>(), style =>
        {
            Assert.True(File.Exists(Path.Combine(folder, Path.GetFileName(GarmentCatalog.StylePhotoWoman(style)))), $"{style}: woman");
            Assert.True(File.Exists(Path.Combine(folder, Path.GetFileName(GarmentCatalog.StylePhotoMan(style)))), $"{style}: man");
        });
        Assert.Equal("/styles/old_money-f.jpg", GarmentCatalog.StylePhotoWoman(StyleTag.OldMoney));
        Assert.Equal("/styles/y2k-m.jpg", GarmentCatalog.StylePhotoMan(StyleTag.Y2k));
    }

    [Fact]
    public void Compatibility_is_symmetric_and_a_style_goes_with_itself()
    {
        var styles = Enum.GetValues<StyleTag>();
        Assert.All(styles, first => Assert.All(styles, second => Assert.Equal(StyleAffinity.AreCompatible(first, second), StyleAffinity.AreCompatible(second, first))));
        Assert.All(styles, style => Assert.True(StyleAffinity.AreCompatible(style, style)));
    }

    [Theory]
    [InlineData(StyleTag.OldMoney, StyleTag.Preppy, true)]
    [InlineData(StyleTag.OldMoney, StyleTag.Smart, true)]
    [InlineData(StyleTag.OldMoney, StyleTag.Elegant, true)]
    [InlineData(StyleTag.Preppy, StyleTag.Business, true)]
    [InlineData(StyleTag.Streetwear, StyleTag.Y2k, true)]
    [InlineData(StyleTag.Grunge, StyleTag.Edgy, true)]
    [InlineData(StyleTag.Edgy, StyleTag.Sporty, true)]
    [InlineData(StyleTag.Boho, StyleTag.Romantic, true)]
    [InlineData(StyleTag.Romantic, StyleTag.Vintage, true)]
    [InlineData(StyleTag.Gorpcore, StyleTag.Sporty, true)]
    [InlineData(StyleTag.Gorpcore, StyleTag.Casual, true)]
    [InlineData(StyleTag.Minimalist, StyleTag.Business, true)]
    [InlineData(StyleTag.Minimalist, StyleTag.Streetwear, true)]
    [InlineData(StyleTag.Minimalist, StyleTag.Y2k, false)]
    [InlineData(StyleTag.Grunge, StyleTag.Minimalist, false)]
    [InlineData(StyleTag.OldMoney, StyleTag.Grunge, false)]
    [InlineData(StyleTag.Elegant, StyleTag.Sporty, false)]
    [InlineData(StyleTag.Gorpcore, StyleTag.Elegant, false)]
    [InlineData(StyleTag.Boho, StyleTag.Business, false)]
    public void The_styles_that_go_together_are_the_ones_the_families_say(StyleTag first, StyleTag second, bool expected) =>
        Assert.Equal(expected, StyleAffinity.AreCompatible(first, second));

    [Fact]
    public void The_five_old_styles_keep_going_together_as_they_did()
    {
        Assert.True(StyleAffinity.AreCompatible(StyleTag.Casual, StyleTag.Smart));
        Assert.True(StyleAffinity.AreCompatible(StyleTag.Smart, StyleTag.Elegant));
        Assert.True(StyleAffinity.AreCompatible(StyleTag.Casual, StyleTag.Streetwear));
        Assert.True(StyleAffinity.AreCompatible(StyleTag.Sporty, StyleTag.Streetwear));
        Assert.False(StyleAffinity.AreCompatible(StyleTag.Elegant, StyleTag.Streetwear));
    }

    [Fact]
    public void Nearby_styles_are_those_that_go_with_every_liked_one()
    {
        Assert.Empty(StyleAffinity.Nearby([]));
        Assert.Equal([StyleTag.Minimalist, StyleTag.Preppy], StyleAffinity.Nearby([StyleTag.Casual, StyleTag.Smart]));
        Assert.Empty(StyleAffinity.Nearby([StyleTag.Elegant, StyleTag.Y2k]));
    }
}

[Collection(ApiTests.Name)]
public sealed class StyleApiTests(ApiFactory factory)
{
    [Fact]
    public async Task The_dictionaries_give_each_style_its_label_and_two_photos_that_are_served()
    {
        var client = factory.CreateClient();
        var dictionaries = await (await client.GetAsync("/api/dictionaries")).ReadAsync<DictionariesResponse>();

        Assert.Equal(Enum.GetValues<StyleTag>(), dictionaries.Styles.Select(entry => entry.Code));
        Assert.All(dictionaries.Styles, entry => Assert.Equal(GarmentCatalog.Label(entry.Code), entry.Label));
        foreach (var entry in dictionaries.Styles)
        {
            Assert.EndsWith(GarmentCatalog.StylePhotoWoman(entry.Code), entry.WomanImageUrl, StringComparison.Ordinal);
            Assert.EndsWith(GarmentCatalog.StylePhotoMan(entry.Code), entry.ManImageUrl, StringComparison.Ordinal);
            foreach (var url in new[] { entry.WomanImageUrl, entry.ManImageUrl })
            {
                var photo = await client.GetAsync(new Uri(url).AbsolutePath);
                Assert.Equal(HttpStatusCode.OK, photo.StatusCode);
                Assert.Equal("image/jpeg", photo.Content.Headers.ContentType?.MediaType);
            }
        }

        var raw = await (await client.GetAsync("/api/dictionaries")).Content.ReadAsStringAsync();
        Assert.Contains("\"code\":\"old_money\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"code\":\"y2k\"", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_person_can_prefer_every_style_and_the_codes_come_back_as_they_were_sent()
    {
        var (client, _) = await factory.SignedInAsync();

        var response = await client.PatchJsonAsync("/api/me", new JsonObject { ["styles"] = new JsonArray([.. EnumCodes.All<StyleTag>().Select(code => (JsonNode?)code)]) });

        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var user = await response.ReadAsync<UserResponse>();
        Assert.Equal(Enum.GetValues<StyleTag>(), user.Styles);
        var raw = await (await client.GetAsync("/api/me")).Content.ReadAsStringAsync();
        Assert.Contains("\"old_money\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"y2k\"", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_style_that_is_not_on_the_list_is_still_refused()
    {
        var (client, _) = await factory.SignedInAsync();

        var response = await client.PatchJsonAsync("/api/me", new JsonObject { ["styles"] = new JsonArray("y2k", "old-money") });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_garment_can_carry_the_new_styles()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);

        var response = await client.PatchJsonAsync($"/api/clothes/{garment.Id}", new JsonObject { ["styles"] = new JsonArray("old_money", "y2k") });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.ReadAsync<ClothingResponse>();
        Assert.Equal([StyleTag.OldMoney, StyleTag.Y2k], updated.Styles);
    }
}
