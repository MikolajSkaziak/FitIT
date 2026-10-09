using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using static FitIt.Tests.Styling.Looks;

namespace FitIt.Tests.Styling;

/// <summary>The validator of the hard rules, the check of the kind label and the coherence score (product spec 6.6).</summary>
public sealed class OutfitRulesTests
{
    private static readonly Garment Tee = Garment(Subcategory.TShirt, warmth: 1);
    private static readonly Garment Shirt = Garment(Subcategory.Shirt);
    private static readonly Garment Sweater = Garment(Subcategory.Sweater, warmth: 3);
    private static readonly Garment Cardigan = Garment(Subcategory.Cardigan, warmth: 3);
    private static readonly Garment Jeans = Garment(Subcategory.Jeans, warmth: 3);
    private static readonly Garment Chinos = Garment(Subcategory.Chinos);
    private static readonly Garment Dress = Garment(Subcategory.Dress);
    private static readonly Garment Coat = Garment(Subcategory.Coat, warmth: 4);
    private static readonly Garment Parka = Garment(Subcategory.Parka, warmth: 4, rainOk: true);
    private static readonly Garment Sneakers = Garment(Subcategory.Sneakers);
    private static readonly Garment Boots = Garment(Subcategory.Boots, warmth: 3);
    private static readonly Garment Belt = Garment(Subcategory.Belt);
    private static readonly Garment Scarf = Garment(Subcategory.Scarf, warmth: 4);

    private static readonly Garment[] Wardrobe = [Tee, Shirt, Sweater, Cardigan, Jeans, Chinos, Dress, Coat, Parka, Sneakers, Boots, Belt, Scarf];

    private static readonly IReadOnlySet<(Guid, Guid)> NothingWorn = new HashSet<(Guid, Guid)>();

    [Fact]
    public void A_complete_outfit_from_the_candidates_passes_and_comes_back_as_garments()
    {
        var candidates = Candidates(Warm);

        var separates = Assert.Single(OutfitValidator.Check([Named(candidates, top: Tee, mid: Sweater, bottom: Jeans, outerwear: Coat, shoes: Sneakers, accessories: [Belt, Scarf])], candidates));
        var onePiece = Assert.Single(OutfitValidator.Check([Named(candidates, onePiece: Dress, shoes: Boots)], candidates));

        Assert.True(separates.IsValid);
        Assert.Empty(separates.Violations);
        Assert.Equal([Tee, Sweater, Jeans, Coat, Sneakers, Belt, Scarf], separates.Draft!.Items);
        Assert.True(onePiece.IsValid);
        Assert.Equal([Dress, Boots], onePiece.Draft!.Items);
    }

    [Fact]
    public void An_alias_that_is_not_among_the_candidates_is_refused()
    {
        var candidates = Candidates(Warm);

        var result = Check(candidates, Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers) with { Bottom = "B9", Accessories = ["A7"] });

        Assert.Equal([new Violation(ViolationCode.UnknownAlias, "B9"), new Violation(ViolationCode.UnknownAlias, "A7")], result.Violations);
        Assert.Null(result.Draft);
    }

    [Fact]
    public void A_garment_in_a_slot_of_another_role_is_refused()
    {
        var candidates = Candidates(Warm);
        var outfit = Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers);

        // A sweater as the top, the top again as the mid layer, a belt as shoes.
        Assert.Equal([new Violation(ViolationCode.WrongRole, candidates.Alias(Sweater))], Check(candidates, outfit with { Top = candidates.Alias(Sweater) }).Violations);
        Assert.Equal(
            [new Violation(ViolationCode.WrongRole, candidates.Alias(Tee)), new Violation(ViolationCode.Repeated, candidates.Alias(Tee))],
            Check(candidates, outfit with { Mid = candidates.Alias(Tee) }).Violations);
        Assert.Equal([new Violation(ViolationCode.WrongRole, candidates.Alias(Belt))], Check(candidates, outfit with { Shoes = candidates.Alias(Belt) }).Violations);
        Assert.Equal([new Violation(ViolationCode.WrongRole, candidates.Alias(Coat))], Check(candidates, outfit with { Accessories = [candidates.Alias(Coat)] }).Violations);
    }

    [Fact]
    public void An_outfit_needs_a_top_and_a_bottom_or_a_one_piece_but_not_both()
    {
        var candidates = Candidates(Warm);

        Assert.Equal([new Violation(ViolationCode.NoBody)], Check(candidates, Named(candidates, top: Tee, shoes: Sneakers)).Violations);
        Assert.Equal([new Violation(ViolationCode.NoBody)], Check(candidates, Named(candidates, bottom: Jeans, shoes: Sneakers)).Violations);
        Assert.Equal([new Violation(ViolationCode.NoBody)], Check(candidates, Named(candidates, mid: Sweater, shoes: Sneakers)).Violations);
        Assert.Equal([new Violation(ViolationCode.MixedBody)], Check(candidates, Named(candidates, top: Tee, onePiece: Dress, shoes: Sneakers)).Violations);
        Assert.Equal([new Violation(ViolationCode.MixedBody)], Check(candidates, Named(candidates, top: Tee, bottom: Jeans, onePiece: Dress, shoes: Sneakers)).Violations);
    }

    [Fact]
    public void An_outfit_needs_shoes()
    {
        var candidates = Candidates(Warm);

        Assert.Equal([new Violation(ViolationCode.NoShoes)], Check(candidates, Named(candidates, top: Tee, bottom: Jeans)).Violations);
    }

    [Fact]
    public void No_garment_may_appear_twice()
    {
        var candidates = Candidates(Warm);

        var result = Check(candidates, Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers, accessories: [Belt, Belt]));

        Assert.Equal([new Violation(ViolationCode.Repeated, candidates.Alias(Belt))], result.Violations);
    }

    [Fact]
    public void What_the_weather_requires_must_be_in_the_outfit()
    {
        var mild = Candidates(Mild);
        var cold = Candidates(Cold);
        var freezing = Candidates(Freezing);

        Assert.Equal([new Violation(ViolationCode.MissingLayer)], Check(mild, Named(mild, top: Tee, bottom: Jeans, shoes: Sneakers)).Violations);
        Assert.True(Check(mild, Named(mild, top: Tee, mid: Sweater, bottom: Jeans, shoes: Sneakers)).IsValid);
        Assert.True(Check(mild, Named(mild, top: Tee, bottom: Jeans, outerwear: Coat, shoes: Sneakers)).IsValid);

        Assert.Equal([new Violation(ViolationCode.MissingOuterwear)], Check(cold, Named(cold, top: Tee, mid: Sweater, bottom: Jeans, shoes: Sneakers)).Violations);
        Assert.True(Check(cold, Named(cold, top: Tee, bottom: Jeans, outerwear: Coat, shoes: Sneakers)).IsValid);

        Assert.Equal(
            [new Violation(ViolationCode.MissingOuterwear), new Violation(ViolationCode.MissingMidLayer)],
            Check(freezing, Named(freezing, top: Tee, bottom: Jeans, shoes: Boots)).Violations);
        Assert.Equal([new Violation(ViolationCode.MissingMidLayer)], Check(freezing, Named(freezing, top: Tee, bottom: Jeans, outerwear: Coat, shoes: Boots)).Violations);
        Assert.True(Check(freezing, Named(freezing, top: Tee, mid: Sweater, bottom: Jeans, outerwear: Coat, shoes: Boots)).IsValid);
    }

    [Fact]
    public void In_rain_the_outerwear_must_stand_it_when_the_wardrobe_has_such()
    {
        var rainy = CandidateFilter.Select(Wardrobe, Day(Warm, rain: true), Occasion.Everyday);

        // The woollen coat is not even a candidate any more, and going without is not allowed either.
        Assert.Equal([Parka], rainy.In(Category.Outerwear));
        Assert.Equal([new Violation(ViolationCode.MissingOuterwear)], Check(rainy, Named(rainy, top: Tee, bottom: Jeans, shoes: Sneakers)).Violations);
        Assert.True(Check(rainy, Named(rainy, top: Tee, bottom: Jeans, outerwear: Parka, shoes: Sneakers)).IsValid);
        Assert.Equal(
            [new Violation(ViolationCode.NoRainOuterwear)],
            OutfitValidator.Check(new OutfitDraft(Tee, null, Jeans, null, Coat, Sneakers, []), rainy));
    }

    [Fact]
    public void The_base_garment_must_be_in_every_proposal()
    {
        var candidates = CandidateFilter.Select(Wardrobe, Day(Warm), Occasion.Everyday, Belt.Id);

        Assert.Equal(
            [new Violation(ViolationCode.MissingBaseItem, candidates.Alias(Belt))],
            Check(candidates, Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers, accessories: [Scarf])).Violations);
        Assert.True(Check(candidates, Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers, accessories: [Scarf, Belt])).IsValid);
    }

    [Fact]
    public void Proposals_must_differ_from_each_other_in_at_least_two_places()
    {
        var candidates = Candidates(Warm);
        var first = Named(candidates, top: Tee, bottom: Jeans, shoes: Sneakers);

        var results = OutfitValidator.Check(
            [
                first,
                // Only the shoes differ.
                Named(candidates, top: Tee, bottom: Jeans, shoes: Boots),
                // Top and bottom differ from the first.
                Named(candidates, top: Shirt, bottom: Chinos, shoes: Sneakers),
                // One place away from the third, which was accepted; the second, which was not, does not count.
                Named(candidates, top: Shirt, bottom: Chinos, shoes: Boots),
                // Shoes and an added accessory.
                Named(candidates, top: Tee, bottom: Jeans, shoes: Boots, accessories: [Belt]),
                first,
            ],
            candidates);

        Assert.Equal([true, false, true, false, true, false], results.Select(result => result.IsValid));
        Assert.All(results.Where(result => !result.IsValid), result => Assert.Equal([new Violation(ViolationCode.TooSimilar)], result.Violations));
    }

    [Fact]
    public void A_wardrobe_with_one_place_of_choice_asks_for_one_difference_and_never_accepts_the_same_outfit_twice()
    {
        var oneChoice = CandidateFilter.Select([Tee, Jeans, Sneakers, Boots], Day(Warm), Occasion.Everyday);
        var noChoice = CandidateFilter.Select([Tee, Jeans, Sneakers], Day(Warm), Occasion.Everyday);

        var differing = OutfitValidator.Check(
            [Named(oneChoice, top: Tee, bottom: Jeans, shoes: Sneakers), Named(oneChoice, top: Tee, bottom: Jeans, shoes: Boots)], oneChoice);
        var same = OutfitValidator.Check(
            [Named(noChoice, top: Tee, bottom: Jeans, shoes: Sneakers), Named(noChoice, top: Tee, bottom: Jeans, shoes: Sneakers)], noChoice);

        Assert.All(differing, result => Assert.True(result.IsValid));
        Assert.Equal([true, false], same.Select(result => result.IsValid));
    }

    [Fact]
    public void Every_violation_can_be_told_to_the_model_in_a_sentence()
    {
        Assert.All(Enum.GetValues<ViolationCode>(), code => Assert.False(string.IsNullOrWhiteSpace(new Violation(code, "T1").Describe())));
        Assert.Equal("T9 is not among the candidates.", new Violation(ViolationCode.UnknownAlias, "T9").Describe());
    }

    [Fact]
    public void A_kind_label_stays_only_on_an_outfit_that_meets_it()
    {
        var dusty = Garment(Subcategory.Shirt, forgotten: true);
        var plain = new OutfitDraft(Tee, null, Jeans, null, null, Sneakers, []);
        var withForgotten = new OutfitDraft(dusty, null, Jeans, null, null, Sneakers, []);
        var dressed = new OutfitDraft(null, null, null, Dress, null, Sneakers, []);
        var worn = new HashSet<(Guid, Guid)> { (Tee.Id, Jeans.Id) };

        Assert.Equal(OutfitKind.SureBet, plain.Confirm(OutfitKind.SureBet, NothingWorn));
        Assert.Null(withForgotten.Confirm(OutfitKind.SureBet, NothingWorn));

        Assert.Equal(OutfitKind.Discovery, withForgotten.Confirm(OutfitKind.Discovery, NothingWorn));
        Assert.Null(plain.Confirm(OutfitKind.Discovery, NothingWorn));

        Assert.Equal(OutfitKind.NewPairing, plain.Confirm(OutfitKind.NewPairing, NothingWorn));
        Assert.Null(plain.Confirm(OutfitKind.NewPairing, worn));
        Assert.Equal(OutfitKind.NewPairing, withForgotten.Confirm(OutfitKind.NewPairing, worn));
        // A one-piece pairs nothing with nothing.
        Assert.Null(dressed.Confirm(OutfitKind.NewPairing, NothingWorn));

        Assert.Null(plain.Confirm(null, NothingWorn));
    }

    [Fact]
    public void A_coherent_outfit_dressed_for_the_weather_scores_a_hundred()
    {
        var outfit = new OutfitDraft(Tee, Sweater, Jeans, null, null, Sneakers, [Belt]);

        Assert.Equal(100, CoherenceScore.Of(outfit, BandRule.For(TemperatureBand.Mild)));
    }

    [Theory]
    // Top 1 + mid 3 + outerwear 4 = 8 against the range of each band.
    [InlineData(TemperatureBand.Hot, 10)]
    [InlineData(TemperatureBand.Warm, 25)]
    [InlineData(TemperatureBand.Mild, 70)]
    [InlineData(TemperatureBand.Cold, 100)]
    [InlineData(TemperatureBand.Freezing, 85)]
    public void Each_point_of_warmth_outside_the_bands_range_costs_fifteen(TemperatureBand band, int score)
    {
        // The bottom and the shoes are not part of the sum, however warm they are.
        var outfit = new OutfitDraft(Tee, Sweater, Garment(Subcategory.Jeans, warmth: 5), null, Coat, Garment(Subcategory.WinterBoots, warmth: 5), []);

        Assert.Equal(score, CoherenceScore.Of(outfit, BandRule.For(band)));
    }

    [Fact]
    public void A_one_piece_counts_towards_warmth_where_a_top_would()
    {
        var woollenDress = Garment(Subcategory.Dress, warmth: 4);

        Assert.Equal(100, CoherenceScore.Of(new OutfitDraft(null, null, null, woollenDress, null, Sneakers, []), BandRule.For(TemperatureBand.Mild)));
        Assert.Equal(85, CoherenceScore.Of(new OutfitDraft(null, null, null, woollenDress, null, Sneakers, []), BandRule.For(TemperatureBand.Warm)));
    }

    [Theory]
    [InlineData(1, 3, 100)]
    [InlineData(1, 4, 90)]
    [InlineData(1, 5, 80)]
    [InlineData(5, 2, 90)]
    public void Each_point_of_formality_spread_beyond_two_costs_ten(int topFormality, int shoeFormality, int score)
    {
        var outfit = new OutfitDraft(Garment(Subcategory.TShirt, formality: topFormality), null, Garment(Subcategory.Jeans, formality: 3), null, null, Garment(Subcategory.Loafers, formality: shoeFormality), []);

        Assert.Equal(score, CoherenceScore.Of(outfit, BandRule.For(TemperatureBand.Warm)));
    }

    [Theory]
    [InlineData(new[] { Color.Red, Color.Green, Color.Blue }, 100)]
    [InlineData(new[] { Color.Red, Color.Green, Color.Blue, Color.Yellow }, 90)]
    [InlineData(new[] { Color.Red, Color.Green, Color.Blue, Color.Yellow, Color.Pink }, 80)]
    // The same colour twice is one colour; neutrals never count.
    [InlineData(new[] { Color.Red, Color.Red, Color.Green, Color.Blue, Color.Navy, Color.White, Color.Black, Color.Grey, Color.Beige, Color.Cream, Color.Brown }, 100)]
    public void Each_colour_beyond_three_that_is_not_neutral_costs_ten(Color[] colours, int score)
    {
        var accessories = colours.Select(colour => Garment(Subcategory.Scarf, colors: [colour])).ToList();
        var outfit = new OutfitDraft(Tee, null, Chinos, null, null, Sneakers, accessories);

        Assert.Equal(score, CoherenceScore.Of(outfit, BandRule.For(TemperatureBand.Warm)));
    }

    [Fact]
    public void A_second_colour_of_one_garment_counts_too()
    {
        var loud = Garment(Subcategory.Shirt, colors: [Color.Red, Color.Yellow]);
        var louder = Garment(Subcategory.Chinos, colors: [Color.Green, Color.Purple]);

        Assert.Equal(90, CoherenceScore.Of(new OutfitDraft(loud, null, louder, null, null, Sneakers, []), BandRule.For(TemperatureBand.Warm)));
    }

    [Theory]
    [InlineData(new[] { Pattern.Plain, Pattern.Plain, Pattern.Plain }, 100)]
    [InlineData(new[] { Pattern.Stripes, Pattern.Plain, Pattern.Plain }, 100)]
    [InlineData(new[] { Pattern.Stripes, Pattern.Check, Pattern.Plain }, 90)]
    [InlineData(new[] { Pattern.Stripes, Pattern.Stripes, Pattern.Floral }, 80)]
    [InlineData(new[] { Pattern.Print, Pattern.Other, Pattern.Plain }, 90)]
    public void Each_pattern_beyond_the_first_costs_ten(Pattern[] patterns, int score)
    {
        var outfit = new OutfitDraft(
            Garment(Subcategory.Shirt, pattern: patterns[0]), null, Garment(Subcategory.Chinos, pattern: patterns[1]), null, null, Garment(Subcategory.Sneakers, pattern: patterns[2]), []);

        Assert.Equal(score, CoherenceScore.Of(outfit, BandRule.For(TemperatureBand.Warm)));
    }

    [Fact]
    public void Each_garment_worn_in_the_last_two_days_costs_five()
    {
        var wornTee = Garment(Subcategory.TShirt, warmth: 1, recentlyWorn: true);
        var wornJeans = Garment(Subcategory.Jeans, recentlyWorn: true);
        var wornBelt = Garment(Subcategory.Belt, recentlyWorn: true);

        Assert.Equal(95, CoherenceScore.Of(new OutfitDraft(wornTee, null, Chinos, null, null, Sneakers, []), BandRule.For(TemperatureBand.Warm)));
        Assert.Equal(85, CoherenceScore.Of(new OutfitDraft(wornTee, null, wornJeans, null, null, Sneakers, [wornBelt]), BandRule.For(TemperatureBand.Warm)));
    }

    [Fact]
    public void Penalties_add_up_and_the_score_never_goes_below_zero()
    {
        var gala = Garment(Subcategory.Shirt, formality: 5, colors: [Color.Red, Color.Yellow], pattern: Pattern.Floral, recentlyWorn: true);
        var joggers = Garment(Subcategory.Sweatpants, formality: 1, colors: [Color.Green, Color.Purple], pattern: Pattern.Stripes);
        var puffer = Garment(Subcategory.DownJacket, warmth: 5);

        // Formality 5 against 1: 20. Four colours: 10. Two patterns: 10. Worn lately: 5.
        Assert.Equal(55, CoherenceScore.Of(new OutfitDraft(gala, null, joggers, null, null, Sneakers, []), BandRule.For(TemperatureBand.Warm)));
        // And 2 + 3 + 5 on a hot day is eight points of warmth too many.
        Assert.Equal(0, CoherenceScore.Of(new OutfitDraft(gala, Sweater, joggers, null, puffer, Sneakers, []), BandRule.For(TemperatureBand.Hot)));
    }

    [Fact]
    public void Outfits_are_compared_slot_by_slot_with_the_accessories_as_one()
    {
        var one = new OutfitDraft(Tee, null, Jeans, null, null, Sneakers, [Belt, Scarf]);

        Assert.Equal(0, one.DifferenceFrom(one with { Accessories = [Scarf, Belt] }));
        Assert.Equal(1, one.DifferenceFrom(one with { Accessories = [Belt] }));
        Assert.Equal(1, one.DifferenceFrom(one with { MidLayer = Sweater }));
        Assert.Equal(2, one.DifferenceFrom(one with { Top = Shirt, Shoes = Boots }));
        Assert.Equal(3, one.DifferenceFrom(new OutfitDraft(null, null, null, Dress, null, Sneakers, [Belt, Scarf])));
    }

    private static CandidateSet Candidates(double feels) => CandidateFilter.Select(Wardrobe, Day(feels), Occasion.Everyday);

    private static CheckedOutfit Check(CandidateSet candidates, StylistOutfit outfit) => Assert.Single(OutfitValidator.Check([outfit], candidates));

    private static StylistOutfit Named(
        CandidateSet candidates,
        Garment? top = null,
        Garment? mid = null,
        Garment? bottom = null,
        Garment? onePiece = null,
        Garment? outerwear = null,
        Garment? shoes = null,
        Garment[]? accessories = null)
    {
        string? Alias(Garment? garment) => garment is null ? null : candidates.Alias(garment);
        return new StylistOutfit(
            null, Alias(top), Alias(mid), Alias(bottom), Alias(onePiece), Alias(outerwear), Alias(shoes), [.. (accessories ?? []).Select(garment => candidates.Alias(garment))], "Bo pasuje.", null);
    }
}
