using FitIt.Core.Common;
using FitIt.Core.Wardrobe;

namespace FitIt.Tests.Core;

public sealed class WardrobeRulesTests
{
    private static readonly GarmentTags Shirt = new(
        Category.Top, Subcategory.Shirt, "Navy oxford shirt", [Color.Navy], Pattern.Plain, Material.Cotton, 4, 2, false, [StyleTag.Smart]);

    private static readonly DateTimeOffset Now = new(2026, 10, 6, 8, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(1, new[] { Season.Spring, Season.Summer })]
    [InlineData(2, new[] { Season.Spring, Season.Summer })]
    [InlineData(3, new[] { Season.Spring, Season.Fall })]
    [InlineData(4, new[] { Season.Fall, Season.Winter })]
    [InlineData(5, new[] { Season.Fall, Season.Winter })]
    public void Warmth_suggests_the_seasons_when_nobody_gave_any(int warmth, Season[] expected) =>
        Assert.Equal(expected, GarmentCatalog.SeasonsFor(warmth));

    [Fact]
    public void Seasons_are_optional_but_may_not_repeat()
    {
        Assert.Null((Shirt with { Seasons = [] }).Check());
        Assert.Null((Shirt with { Seasons = [Season.Spring, Season.Summer, Season.Fall, Season.Winter] }).Check());
        Assert.Equal("seasons_invalid", (Shirt with { Seasons = [Season.Fall, Season.Fall] }).Check()?.Code);
        Assert.Equal(["Spring", "Summer", "Fall", "Winter"], Enum.GetValues<Season>().Select(GarmentCatalog.Label));
        Assert.Equal(["spring", "summer", "fall", "winter"], Enum.GetValues<Season>().Select(EnumCodes.ToCode));
    }

    [Fact]
    public void Every_colour_has_a_hex_for_its_swatch() =>
        Assert.All(Enum.GetValues<Color>(), color => Assert.Matches("^#[0-9A-F]{6}$", GarmentCatalog.Hex(color)));

    [Fact]
    public void Every_type_belongs_to_a_category_and_has_both_names()
    {
        foreach (var type in Enum.GetValues<Subcategory>())
        {
            Assert.True(Enum.IsDefined(GarmentCatalog.CategoryOf(type)));
            Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.Label(type)));
            Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.English(type)));
        }

        // No category is left without a type to choose.
        Assert.All(Enum.GetValues<Category>(), category => Assert.NotEmpty(GarmentCatalog.TypesOf(category)));
        Assert.Equal(Enum.GetValues<Subcategory>().Length, Enum.GetValues<Category>().Sum(category => GarmentCatalog.TypesOf(category).Count()));
    }

    [Fact]
    public void Every_type_belongs_to_exactly_one_group_and_every_group_has_a_type()
    {
        var groups = Enum.GetValues<GarmentGroup>();

        foreach (var type in Enum.GetValues<Subcategory>())
        {
            Assert.Single(groups, group => GarmentCatalog.TypesOf(group).Contains(type));
            Assert.Contains(type, GarmentCatalog.TypesOf(GarmentCatalog.GroupOf(type)));
        }

        Assert.All(groups, group => Assert.NotEmpty(GarmentCatalog.TypesOf(group)));
        Assert.All(groups, group => Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.Label(group))));
        Assert.Equal(groups.Length, groups.Select(GarmentCatalog.Label).Distinct().Count());
        Assert.Equal(Enum.GetValues<Subcategory>().Length, groups.Sum(group => GarmentCatalog.TypesOf(group).Count()));
    }

    [Fact]
    public void The_clothing_groups_follow_a_familiar_shop_in_this_order()
    {
        Assert.Equal(
            [
                "T-shirts and tops", "Shirts and blouses", "Sweaters and hoodies", "Jackets and coats", "Jeans", "Pants and shorts", "Skirts",
                "Dresses and jumpsuits", "Suits and blazers", "Tracksuits and sweats", "Shoes", "Bags", "Accessories",
            ],
            Enum.GetValues<GarmentGroup>().Select(GarmentCatalog.Label));

        Assert.Equal([Subcategory.TShirt, Subcategory.Polo, Subcategory.TankTop, Subcategory.Longsleeve], GarmentCatalog.TypesOf(GarmentGroup.TShirtsAndTops));
        Assert.Equal([Subcategory.Shirt, Subcategory.Blouse], GarmentCatalog.TypesOf(GarmentGroup.ShirtsAndBlouses));
        Assert.Equal([Subcategory.Jeans], GarmentCatalog.TypesOf(GarmentGroup.Jeans));
        Assert.Equal([Subcategory.Trousers, Subcategory.Chinos, Subcategory.Shorts, Subcategory.Leggings], GarmentCatalog.TypesOf(GarmentGroup.Pants));
        Assert.Equal(11, GarmentCatalog.TypesOf(GarmentGroup.Shoes).Count());
        Assert.Equal([Subcategory.Skirt], GarmentCatalog.TypesOf(GarmentGroup.Skirts));
        Assert.Equal([Subcategory.Blazer, Subcategory.SuitJacket, Subcategory.Vest], GarmentCatalog.TypesOf(GarmentGroup.SuitsAndBlazers));
        Assert.Equal([Subcategory.TrackJacket, Subcategory.Sweatpants, Subcategory.Tracksuit], GarmentCatalog.TypesOf(GarmentGroup.TracksuitsAndSweats));
    }

    [Fact]
    public void The_dictionaries_have_the_sizes_the_product_spec_names()
    {
        Assert.Equal(7, Enum.GetValues<Category>().Length);
        Assert.Equal(17, Enum.GetValues<Color>().Length);
        Assert.Equal(6, Enum.GetValues<Pattern>().Length);
        Assert.Equal(11, Enum.GetValues<Material>().Length);
        Assert.Equal(5, GarmentCatalog.FormalityLabels.Count);
        Assert.Equal(5, GarmentCatalog.WarmthLabels.Count);
        Assert.All(Enum.GetValues<Color>(), color => Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.Label(color))));
        Assert.All(Enum.GetValues<Pattern>(), pattern => Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.Label(pattern))));
        Assert.All(Enum.GetValues<Material>(), material => Assert.False(string.IsNullOrWhiteSpace(GarmentCatalog.Label(material))));
    }

    [Fact]
    public void Seven_colours_are_neutral()
    {
        var neutral = Enum.GetValues<Color>().Where(GarmentCatalog.IsNeutral);

        Assert.Equal([Color.White, Color.Cream, Color.Beige, Color.Grey, Color.Black, Color.Navy, Color.Brown], neutral);
    }

    [Fact]
    public void Codes_are_lower_snake_case_ascii()
    {
        Assert.Equal("t_shirt", EnumCodes.ToCode(Subcategory.TShirt));
        Assert.Equal("flip_flops", EnumCodes.ToCode(Subcategory.FlipFlops));
        Assert.Equal("mid_layer", EnumCodes.ToCode(Category.MidLayer));
        Assert.Equal("one_piece", EnumCodes.ToCode(Category.OnePiece));
        Assert.Equal("light_blue", EnumCodes.ToCode(Color.LightBlue));
        Assert.All(EnumCodes.All<Subcategory>(), code => Assert.Matches("^[a-z]+(_[a-z]+)*$", code));
    }

    [Fact]
    public void Complete_and_consistent_tags_pass()
    {
        Assert.Null(Shirt.Check());
        Assert.Null((Shirt with { Colors = [Color.LightBlue, Color.White], Styles = [] }).Check());
    }

    [Theory]
    [MemberData(nameof(BrokenTags))]
    public void Tags_that_break_a_rule_are_named_by_the_rule(GarmentTags tags, string code)
    {
        Assert.Equal(code, tags.Check()?.Code);
    }

    public static TheoryData<GarmentTags, string> BrokenTags => new()
    {
        { Shirt with { Subcategory = Subcategory.Jeans }, "subcategory_mismatch" },
        { Shirt with { Name = "   " }, "name_invalid" },
        { Shirt with { Name = new string('a', 61) }, "name_invalid" },
        { Shirt with { Colors = [] }, "colors_invalid" },
        { Shirt with { Colors = [Color.Navy, Color.Navy] }, "colors_invalid" },
        { Shirt with { Colors = [Color.Navy, Color.White, Color.Red] }, "colors_invalid" },
        { Shirt with { Formality = 0 }, "formality_invalid" },
        { Shirt with { Formality = 6 }, "formality_invalid" },
        { Shirt with { Warmth = 0 }, "warmth_invalid" },
        { Shirt with { Warmth = 6 }, "warmth_invalid" },
        { Shirt with { Styles = [StyleTag.Smart, StyleTag.Smart] }, "styles_invalid" },
    };

    [Fact]
    public void The_description_for_the_models_is_built_from_the_tags()
    {
        Assert.Equal("navy blue cotton shirt", Shirt.Describe());
        Assert.Equal("light blue and white striped cotton shirt", (Shirt with { Colors = [Color.LightBlue, Color.White], Pattern = Pattern.Stripes }).Describe());

        // "denim denim jacket" and "leather leather jacket" would read as mistakes; an unknown material is simply left out.
        var jacket = new GarmentTags(Category.Outerwear, Subcategory.DenimJacket, "Denim jacket", [Color.Blue], Pattern.Plain, Material.Denim, 2, 2, false, []);
        Assert.Equal("blue denim jacket", jacket.Describe());
        Assert.Equal("black leather jacket", (jacket with { Subcategory = Subcategory.LeatherJacket, Colors = [Color.Black], Material = Material.Leather }).Describe());
        Assert.Equal("black sneakers", new GarmentTags(Category.Shoes, Subcategory.Sneakers, "Black sneakers", [Color.Black], Pattern.Plain, Material.Other, 2, 2, false, []).Describe());
    }

    [Fact]
    public void A_new_garment_has_no_tags_and_shows_its_photo()
    {
        var item = NewItem();

        Assert.Equal(ClothingStatus.Processing, item.Status);
        Assert.Null(item.Tags);
        Assert.Equal(item.OriginalKey, item.ImageKey);
    }

    [Fact]
    public void Tagging_makes_it_ready_and_the_tags_read_back_the_same()
    {
        var item = NewItem();
        item.AttachCutout("u/x/cut/1.png", Now);

        item.MarkReady(Shirt with { Name = "  Navy oxford shirt " }, "navy blue oxford shirt", Now);

        Assert.Equal(ClothingStatus.Ready, item.Status);
        Assert.Equal("u/x/cut/1.png", item.ImageKey);
        Assert.Equal("navy blue oxford shirt", item.Description);
        Assert.Equal(["navy"], item.Colors);
        Assert.Equal(["smart"], item.Styles);
        Assert.Equal(["spring", "summer"], item.Seasons);
        Assert.Equivalent(Shirt with { Seasons = [Season.Spring, Season.Summer] }, item.Tags);
    }

    [Fact]
    public void Tags_given_by_hand_rebuild_the_description_and_rescue_a_failed_garment()
    {
        var item = NewItem();
        item.MarkFailed(Now);

        item.Retag(Shirt, Now);

        Assert.Equal(ClothingStatus.Ready, item.Status);
        Assert.Equal("navy blue cotton shirt", item.Description);
    }

    [Fact]
    public void The_step_counter_starts_again_once_the_picture_is_settled()
    {
        var item = NewItem();
        item.BeginAttempt(Now);
        item.BeginAttempt(Now);
        Assert.Equal(2, item.Attempts);

        item.AttachCutout(item.OriginalKey, Now);

        Assert.Equal(0, item.Attempts);
    }

    [Fact]
    public void Another_try_keeps_a_real_cutout_but_drops_the_photo_standing_in_for_one()
    {
        var withCutout = NewItem();
        withCutout.AttachCutout("u/x/cut/1.png", Now);
        withCutout.MarkFailed(Now);
        withCutout.Restart(Now);
        Assert.Equal("u/x/cut/1.png", withCutout.CutoutKey);
        Assert.Equal(ClothingStatus.Processing, withCutout.Status);

        var standIn = NewItem();
        standIn.AttachCutout(standIn.OriginalKey, Now);
        standIn.MarkFailed(Now);
        standIn.Restart(Now);
        Assert.Null(standIn.CutoutKey);
    }

    [Theory]
    [InlineData(29, false)]
    [InlineData(30, true)]
    [InlineData(31, true)]
    public void A_garment_is_forgotten_thirty_days_after_it_was_last_worn(int daysSinceWorn, bool forgotten)
    {
        var item = NewItem();
        var today = new DateOnly(2026, 12, 1);
        item.RecordWear(today.AddDays(-daysSinceWorn), Now);

        Assert.Equal(forgotten, item.IsForgotten(today, TimeZoneInfo.Utc));
    }

    [Fact]
    public void A_never_worn_garment_counts_from_the_day_it_was_added_and_the_flag_wins_at_once()
    {
        var item = NewItem();
        var added = DateOnly.FromDateTime(Now.UtcDateTime);

        Assert.False(item.IsForgotten(added.AddDays(29), TimeZoneInfo.Utc));
        Assert.True(item.IsForgotten(added.AddDays(30), TimeZoneInfo.Utc));

        item.SetFlags(inLaundry: null, rarelyWorn: true, Now);
        Assert.True(item.IsForgotten(added, TimeZoneInfo.Utc));
    }

    [Fact]
    public void Wearing_is_counted_once_a_day_and_never_moves_the_last_day_back()
    {
        var item = NewItem();
        var day = new DateOnly(2026, 10, 6);

        item.RecordWear(day, Now);
        item.RecordWear(day, Now);
        Assert.Equal(1, item.WearCount);

        item.RecordWear(day.AddDays(-3), Now);
        Assert.Equal(2, item.WearCount);
        Assert.Equal(day, item.LastWornOn);
    }

    [Fact]
    public void Keys_carry_their_owner()
    {
        var owner = Guid.NewGuid();
        var key = ObjectKeys.NewOriginal(owner);

        Assert.StartsWith($"u/{owner:N}/orig/", key, StringComparison.Ordinal);
        Assert.True(ObjectKeys.IsOriginalOf(owner, key));
        Assert.False(ObjectKeys.IsOriginalOf(Guid.NewGuid(), key));
        Assert.False(ObjectKeys.IsOriginalOf(owner, null));
        Assert.False(ObjectKeys.IsOriginalOf(owner, $"u/{owner:N}/orig/../../other.jpg"));
        Assert.False(ObjectKeys.IsOriginalOf(owner, $"u/{owner:N}/cut/{Guid.NewGuid():N}.jpg"));
        Assert.False(ObjectKeys.IsOriginalOf(owner, key + "x"));
        Assert.NotEqual(key, ObjectKeys.NewOriginal(owner));
        Assert.Equal($"u/{owner:N}/cut/{owner:N}-tight.png", ObjectKeys.Cutout(owner, owner, "png"));
    }

    private static ClothingItem NewItem() => new() { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), OriginalKey = "u/x/orig/1.jpg", CreatedAt = Now };
}
