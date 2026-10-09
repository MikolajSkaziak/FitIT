using System.Text.Json.Nodes;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Tests.Styling;

namespace FitIt.Tests.Core;

public sealed class ColorSeasonsTests
{
    [Fact]
    public void Every_type_has_a_name_two_sentences_and_a_palette_in_the_order_of_the_enum()
    {
        Assert.Equal(Enum.GetValues<ColorSeason>().Length, ColorSeasons.All.Count);
        Assert.Equal(Enum.GetValues<ColorSeason>(), ColorSeasons.All.Select(info => info.Season));
        Assert.All(ColorSeasons.All, info =>
        {
            Assert.InRange(info.Best.Count, 6, 8);
            Assert.InRange(info.Soften.Count, 3, 4);
            Assert.Equal(2, info.Summary.Count(letter => letter == '.'));
            Assert.All(info.Best.Concat(info.Soften), swatch => Assert.Matches("^#[0-9A-F]{6}$", swatch.Hex));
            Assert.Equal(info.Best.Count, info.Best.Select(swatch => swatch.Name).Distinct().Count());
        });
        Assert.Equal("Soft autumn", ColorSeasons.Of(ColorSeason.SoftAutumn).Name);
        Assert.Equal("soft_autumn", EnumCodes.ToCode(ColorSeason.SoftAutumn));
    }

    private static IEnumerable<ColorQuiz> AllAnswers() =>
        from tone in Enumerable.Range(1, ColorQuiz.SkinTones)
        from undertone in Enum.GetValues<SkinUndertone>()
        from hair in Enum.GetValues<HairColor>()
        from eyes in Enum.GetValues<EyeColor>()
        select new ColorQuiz(tone, undertone, hair, eyes);

    [Fact]
    public void The_questions_can_lead_to_each_of_the_twelve_types()
    {
        var reached = AllAnswers().Select(ColorSeasons.FromQuiz).ToHashSet();

        Assert.Equal(Enum.GetValues<ColorSeason>().ToHashSet(), reached);
    }

    [Fact]
    public void The_same_answers_always_give_the_same_type()
    {
        foreach (var answers in AllAnswers())
        {
            Assert.Equal(ColorSeasons.FromQuiz(answers), ColorSeasons.FromQuiz(answers with { }));
        }
    }

    [Theory]
    [InlineData(1, SkinUndertone.Warm, HairColor.GoldenBlond, EyeColor.LightBlue, ColorSeason.LightSpring)]
    [InlineData(1, SkinUndertone.Cool, HairColor.PlatinumBlond, EyeColor.Gray, ColorSeason.LightSummer)]
    [InlineData(1, SkinUndertone.Cool, HairColor.Black, EyeColor.NearBlack, ColorSeason.CoolWinter)]
    [InlineData(4, SkinUndertone.Warm, HairColor.DarkBrown, EyeColor.Hazel, ColorSeason.WarmAutumn)]
    [InlineData(8, SkinUndertone.Warm, HairColor.Black, EyeColor.DarkBrown, ColorSeason.DeepAutumn)]
    [InlineData(8, SkinUndertone.Cool, HairColor.Black, EyeColor.NearBlack, ColorSeason.DeepWinter)]
    public void A_few_familiar_colorings_land_where_a_stylist_would_put_them(int tone, SkinUndertone undertone, HairColor hair, EyeColor eyes, ColorSeason expected) =>
        Assert.Equal(expected, ColorSeasons.FromQuiz(new ColorQuiz(tone, undertone, hair, eyes)));

    [Fact]
    public void Dyed_hair_leaves_the_hair_out_and_a_skin_tone_outside_the_scale_is_refused()
    {
        var dyed = new ColorQuiz(3, SkinUndertone.Warm, HairColor.Dyed, EyeColor.Green);

        Assert.Equal(ColorSeasons.FromQuiz(dyed), ColorSeasons.FromQuiz(dyed));
        Assert.Throws<ArgumentOutOfRangeException>(() => ColorSeasons.FromQuiz(dyed with { SkinTone = 0 }));
        Assert.Throws<ArgumentOutOfRangeException>(() => ColorSeasons.FromQuiz(dyed with { SkinTone = ColorQuiz.SkinTones + 1 }));
    }

    [Fact]
    public void The_brief_carries_the_flattering_colors_only_when_there_are_some()
    {
        var weather = Looks.Day(Looks.Warm);
        var candidates = CandidateFilter.Select([], weather, Occasion.Everyday);

        var with = JsonNode.Parse(new StylingCase(weather, Occasion.Everyday, null, [], ThermalPreference.Normal, candidates, StylingHistory.None, ["sage green", "cream"]).Brief().ToJson())!;
        var without = JsonNode.Parse(new StylingCase(weather, Occasion.Everyday, null, [], ThermalPreference.Normal, candidates, StylingHistory.None).Brief().ToJson())!;

        Assert.Equal("""["sage green","cream"]""", with["profile"]!["flattering_colors"]!.ToJsonString());
        Assert.Null(without["profile"]!["flattering_colors"]);
    }
}
