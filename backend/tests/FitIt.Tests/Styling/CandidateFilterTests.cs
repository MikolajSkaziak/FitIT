using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using static FitIt.Tests.Styling.Looks;

namespace FitIt.Tests.Styling;

public sealed class CandidateFilterTests
{
    private static readonly Garment Tee = Garment(Subcategory.TShirt, warmth: 1);
    private static readonly Garment Jeans = Garment(Subcategory.Jeans, warmth: 3);
    private static readonly Garment Sneakers = Garment(Subcategory.Sneakers);

    [Theory]
    [InlineData(Occasion.Everyday, 1, 3, null, null, null)]
    [InlineData(Occasion.Work, 2, 4, StyleTag.Sporty, null, null)]
    [InlineData(Occasion.Business, 4, 5, null, null, null)]
    [InlineData(Occasion.Date, 2, 4, null, null, StyleTag.Elegant)]
    [InlineData(Occasion.Friends, 1, 3, null, null, null)]
    [InlineData(Occasion.Workout, 1, 1, null, StyleTag.Sporty, null)]
    public void Each_occasion_has_the_range_and_the_style_rule_of_the_spec(Occasion occasion, int from, int to, StyleTag? without, StyleTag? only, StyleTag? prefers)
    {
        var rule = OccasionRule.For(occasion);

        Assert.Equal((from, to, without, only, prefers), (rule.FormalityMin, rule.FormalityMax, rule.Without, rule.Only, rule.Prefers));
        Assert.False(string.IsNullOrWhiteSpace(rule.Label));
        Assert.Equal(6, Enum.GetValues<Occasion>().Length);
    }

    [Fact]
    public void A_garment_in_the_laundry_is_not_a_candidate()
    {
        var dirty = Garment(Subcategory.Shirt, inLaundry: true);

        var candidates = CandidateFilter.Select([Tee, dirty, Jeans, Sneakers], Day(Warm), Occasion.Everyday);

        Assert.Equal([Tee], candidates.In(Category.Top));
        Assert.True(candidates.IsComplete);
        Assert.Empty(candidates.Relaxations);
    }

    [Fact]
    public void What_the_weather_shuts_out_is_not_a_candidate()
    {
        var shorts = Garment(Subcategory.Shorts, warmth: 1);
        var sandals = Garment(Subcategory.Sandals, warmth: 1);
        var lightJacket = Garment(Subcategory.DenimJacket, warmth: 2);
        var coat = Garment(Subcategory.Coat, warmth: 4);
        Garment[] wardrobe = [Tee, Jeans, shorts, Sneakers, sandals, lightJacket, coat];

        var cold = CandidateFilter.Select(wardrobe, Day(Cold), Occasion.Everyday);
        var hot = CandidateFilter.Select(wardrobe, Day(Hot), Occasion.Everyday);

        Assert.Equal([Jeans], cold.In(Category.Bottom));
        Assert.Equal([Sneakers], cold.In(Category.Shoes));
        // The light jacket is no use on a day that needs warm outerwear.
        Assert.Equal([coat], cold.In(Category.Outerwear));
        Assert.Equal([Jeans, shorts], hot.In(Category.Bottom));
        Assert.Equal([Sneakers, sandals], hot.In(Category.Shoes));
        Assert.Empty(hot.In(Category.Outerwear));
        Assert.Empty(cold.Relaxations);
        Assert.Empty(hot.Relaxations);
    }

    [Fact]
    public void What_is_outside_the_occasions_formality_is_not_a_candidate()
    {
        var hoodie = Garment(Subcategory.Hoodie, formality: 1);
        var blazer = Garment(Subcategory.Blazer, formality: 4);
        var tailcoat = Garment(Subcategory.Blazer, formality: 5);
        var shirt = Garment(Subcategory.Shirt, formality: 4);
        var trousers = Garment(Subcategory.Trousers, formality: 4);
        var loafers = Garment(Subcategory.Loafers, formality: 3);

        var work = CandidateFilter.Select([hoodie, blazer, tailcoat, shirt, trousers, loafers], Day(Warm), Occasion.Work);

        Assert.Equal([blazer], work.In(Category.MidLayer));
        Assert.True(work.IsComplete);
        Assert.Empty(work.Relaxations);
    }

    [Fact]
    public void The_style_rule_of_the_occasion_shuts_garments_out()
    {
        var sportyTee = Garment(Subcategory.TShirt, warmth: 1, styles: [StyleTag.Casual, StyleTag.Sporty]);
        var leggings = Garment(Subcategory.Leggings, formality: 1, styles: [StyleTag.Sporty]);
        var runners = Garment(Subcategory.SportsShoes, formality: 1, styles: [StyleTag.Sporty]);
        var joggers = Garment(Subcategory.Sweatpants, formality: 1, styles: [StyleTag.Casual]);
        var gymTop = Garment(Subcategory.TankTop, formality: 1, warmth: 1, styles: [StyleTag.Sporty]);
        var untagged = Garment(Subcategory.TShirt, formality: 1, styles: []);
        Garment[] wardrobe = [Tee, sportyTee, Jeans, leggings, joggers, Sneakers, runners, gymTop, untagged];

        var work = CandidateFilter.Select(wardrobe, Day(Warm), Occasion.Work);
        var workout = CandidateFilter.Select(wardrobe, Day(Warm), Occasion.Workout);

        // Work: nothing sporty. A garment without any style is not sporty.
        Assert.Equal([Tee], work.In(Category.Top));
        Assert.Equal([Jeans], work.In(Category.Bottom));
        Assert.Equal([Sneakers], work.In(Category.Shoes));
        // Workout: only sporty, and only formality 1.
        Assert.Equal([gymTop], workout.In(Category.Top));
        Assert.Equal([leggings], workout.In(Category.Bottom));
        Assert.Equal([runners], workout.In(Category.Shoes));
        Assert.Empty(work.Relaxations);
        Assert.Empty(workout.Relaxations);
    }

    [Fact]
    public void An_empty_required_role_first_gets_a_formality_range_wider_by_one()
    {
        var slippers = Garment(Subcategory.Sneakers, formality: 1);
        var sportySneakers = Garment(Subcategory.Sneakers, formality: 2, styles: [StyleTag.Sporty]);
        var hoodie = Garment(Subcategory.Hoodie, formality: 1);

        var candidates = CandidateFilter.Select([Tee, Jeans, slippers, sportySneakers, hoodie], Day(Warm), Occasion.Work);

        // The first relaxation is enough, so the style rule still holds; and it is for shoes only: the hoodie stays out.
        Assert.Equal([slippers], candidates.In(Category.Shoes));
        Assert.Empty(candidates.In(Category.MidLayer));
        Assert.Equal([new Relaxation(Category.Shoes, RelaxedRule.Formality)], candidates.Relaxations);
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void Then_the_style_rule_is_dropped()
    {
        var sportySneakers = Garment(Subcategory.Sneakers, formality: 2, styles: [StyleTag.Sporty]);
        var beachSandals = Garment(Subcategory.FlipFlops, formality: 2, warmth: 5);

        var candidates = CandidateFilter.Select([Tee, Jeans, sportySneakers, beachSandals], Day(Warm), Occasion.Work);

        // Only the rule that was really in the way is reported: the formality of these shoes was fine all along.
        Assert.Equal([sportySneakers], candidates.In(Category.Shoes));
        Assert.Equal([new Relaxation(Category.Shoes, RelaxedRule.Style)], candidates.Relaxations);
    }

    [Fact]
    public void Then_warmth_gets_a_tolerance_of_one()
    {
        var lightJacket = Garment(Subcategory.Jacket, warmth: 2);
        var windbreaker = Garment(Subcategory.Jacket, warmth: 1);
        var boots = Garment(Subcategory.Boots);

        var candidates = CandidateFilter.Select([Tee, Jeans, boots, lightJacket, windbreaker], Day(Cold), Occasion.Everyday);

        // Cold asks for outerwear of warmth 3: warmth 2 is let in, warmth 1 is still not.
        Assert.Equal([lightJacket], candidates.In(Category.Outerwear));
        Assert.Equal([new Relaxation(Category.Outerwear, RelaxedRule.Warmth)], candidates.Relaxations);
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void All_three_relaxations_can_be_needed_for_one_role_and_each_role_is_relaxed_on_its_own()
    {
        var shirt = Garment(Subcategory.Shirt, formality: 4);
        var trousers = Garment(Subcategory.Trousers, formality: 4, warmth: 3);
        var dressShoes = Garment(Subcategory.DressShoes, formality: 5);
        var blazer = Garment(Subcategory.Blazer, formality: 2);
        var sportyJacket = Garment(Subcategory.Jacket, formality: 3, warmth: 3, styles: [StyleTag.Sporty]);
        var freezing = Day(Freezing);

        var candidates = CandidateFilter.Select([shirt, trousers, dressShoes, blazer, sportyJacket], freezing, Occasion.Work);

        Assert.Equal([sportyJacket], candidates.In(Category.Outerwear));
        Assert.Equal([blazer], candidates.In(Category.MidLayer));
        Assert.Equal([dressShoes], candidates.In(Category.Shoes));
        Assert.Equal(
            [new Relaxation(Category.Outerwear, RelaxedRule.Style), new Relaxation(Category.Outerwear, RelaxedRule.Warmth), new Relaxation(Category.Shoes, RelaxedRule.Formality)],
            candidates.Relaxations.OrderBy(relaxation => relaxation.Role).ThenBy(relaxation => relaxation.Rule));
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void An_optional_role_is_never_relaxed()
    {
        var formalScarf = Garment(Subcategory.Scarf, formality: 5);
        var formalBlazer = Garment(Subcategory.Blazer, formality: 5);

        var candidates = CandidateFilter.Select([Tee, Jeans, Sneakers, formalScarf, formalBlazer], Day(Warm), Occasion.Everyday);

        Assert.Empty(candidates.In(Category.Accessory));
        Assert.Empty(candidates.In(Category.MidLayer));
        Assert.Empty(candidates.Relaxations);
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void The_type_of_garment_never_gives_way()
    {
        var sandals = Garment(Subcategory.Sandals, warmth: 1);
        var shorts = Garment(Subcategory.Shorts, warmth: 1);
        var coat = Garment(Subcategory.Coat, warmth: 4);

        var candidates = CandidateFilter.Select([Tee, shorts, sandals, coat], Day(Cold), Occasion.Everyday);

        Assert.Equal([Category.Bottom, Category.Shoes], candidates.Missing);
        Assert.False(candidates.IsComplete);
        Assert.Empty(candidates.In(Category.Shoes));
        Assert.Empty(candidates.Relaxations);
    }

    [Fact]
    public void A_role_that_stays_empty_after_every_relaxation_is_named_as_missing()
    {
        var hoodie = Garment(Subcategory.Hoodie, formality: 1, warmth: 3);
        var puffer = Garment(Subcategory.DownJacket, formality: 2, warmth: 5);
        var shirt = Garment(Subcategory.Shirt, formality: 4);
        var trousers = Garment(Subcategory.Trousers, formality: 4);
        var dressShoes = Garment(Subcategory.DressShoes, formality: 4);

        // Business is formality 4 to 5; one step wider still does not reach a puffer of formality 2.
        var business = CandidateFilter.Select([shirt, trousers, dressShoes, hoodie, puffer], Day(Freezing), Occasion.Business);

        Assert.Equal([Category.MidLayer, Category.Outerwear], business.Missing);
        Assert.Empty(business.Relaxations);
    }

    [Fact]
    public void A_mid_layer_or_outerwear_that_is_missing_is_named_as_one_requirement_that_either_would_meet()
    {
        var sweater = Garment(Subcategory.Sweater, warmth: 3);
        var jacket = Garment(Subcategory.Jacket, warmth: 3);

        // Mild weather asks for a layer, any layer. Neither exists: the two roles are named together, and neither is "required".
        var bare = CandidateFilter.Select([Tee, Jeans, Sneakers], Day(Mild), Occasion.Everyday);
        Assert.Empty(bare.Missing);
        Assert.Equal([Category.MidLayer, Category.Outerwear], bare.MissingEither);
        Assert.False(bare.IsComplete);

        // One of them is enough, and then nothing is missing.
        Assert.True(CandidateFilter.Select([Tee, Jeans, Sneakers, sweater], Day(Mild), Occasion.Everyday).IsComplete);
        Assert.True(CandidateFilter.Select([Tee, Jeans, Sneakers, jacket], Day(Mild), Occasion.Everyday).IsComplete);
        Assert.Empty(CandidateFilter.Select([Tee, Jeans, Sneakers, jacket], Day(Mild), Occasion.Everyday).MissingEither);

        // The requirements that stand apart are listed apart from the group.
        var barer = CandidateFilter.Select([Tee, Jeans], Day(Mild), Occasion.Everyday);
        Assert.Equal([Category.Shoes], barer.Missing);
        Assert.Equal([Category.MidLayer, Category.Outerwear], barer.MissingEither);
    }

    [Fact]
    public void Roles_that_are_each_required_are_never_listed_as_a_group()
    {
        // Freezing weather needs both a mid layer and outerwear: each is named on its own, and the group adds nothing.
        var freezing = CandidateFilter.Select([Tee, Jeans, Sneakers], Day(Freezing), Occasion.Everyday);
        Assert.Contains(Category.MidLayer, freezing.Missing);
        Assert.Contains(Category.Outerwear, freezing.Missing);
        Assert.Empty(freezing.MissingEither);

        // Warm weather asks for no layer at all.
        Assert.Empty(CandidateFilter.Select([Tee], Day(Warm), Occasion.Everyday).MissingEither);
        Assert.Equal([Category.MidLayer, Category.Outerwear], CandidateFilter.Select([], Day(Mild), Occasion.Everyday).MissingEither);
    }

    [Fact]
    public void An_empty_wardrobe_lacks_a_top_a_bottom_and_shoes()
    {
        Assert.Equal([Category.Top, Category.Bottom, Category.Shoes], CandidateFilter.Select([], Day(Warm), Occasion.Everyday).Missing);
        Assert.Equal([Category.Bottom], CandidateFilter.Select([Tee, Sneakers], Day(Warm), Occasion.Everyday).Missing);
        Assert.Equal([Category.Top], CandidateFilter.Select([Jeans, Sneakers], Day(Warm), Occasion.Everyday).Missing);
        Assert.Equal([Category.Shoes], CandidateFilter.Select([Tee, Jeans], Day(Warm), Occasion.Everyday).Missing);
    }

    [Fact]
    public void A_one_piece_dresses_a_person_without_a_top_and_a_bottom()
    {
        var dress = Garment(Subcategory.Dress);
        var formalDress = Garment(Subcategory.Dress, formality: 4);

        var withDress = CandidateFilter.Select([dress, Tee, Sneakers], Day(Warm), Occasion.Everyday);
        var relaxed = CandidateFilter.Select([formalDress, Sneakers], Day(Warm), Occasion.Everyday);

        Assert.True(withDress.IsComplete);
        Assert.Equal([dress], withDress.In(Category.OnePiece));
        Assert.True(relaxed.IsComplete);
        Assert.Equal([new Relaxation(Category.OnePiece, RelaxedRule.Formality)], relaxed.Relaxations);
    }

    [Theory]
    [InlineData(Mild, new Category[0], new[] { Category.MidLayer, Category.Outerwear })]
    [InlineData(Cold, new[] { Category.Outerwear }, new Category[0])]
    [InlineData(Freezing, new[] { Category.MidLayer, Category.Outerwear }, new Category[0])]
    [InlineData(Warm, new Category[0], new Category[0])]
    [InlineData(Hot, new Category[0], new Category[0])]
    public void The_layers_the_weather_requires_are_missing_when_the_wardrobe_has_none(double feels, Category[] missing, Category[] missingEither)
    {
        var boots = Garment(Subcategory.Boots);

        var candidates = CandidateFilter.Select([Tee, Jeans, boots], Day(feels), Occasion.Everyday);

        // Roles that are each required, and roles of which any one would do, are told apart.
        Assert.Equal(missing, candidates.Missing);
        Assert.Equal(missingEither, candidates.MissingEither);
    }

    [Fact]
    public void On_a_mild_day_either_a_mid_layer_or_outerwear_is_enough()
    {
        var sweater = Garment(Subcategory.Sweater, warmth: 3);
        var jacket = Garment(Subcategory.Jacket, warmth: 2);

        Assert.True(CandidateFilter.Select([Tee, Jeans, Sneakers, sweater], Day(Mild), Occasion.Everyday).IsComplete);
        Assert.True(CandidateFilter.Select([Tee, Jeans, Sneakers, jacket], Day(Mild), Occasion.Everyday).IsComplete);
    }

    [Theory]
    [InlineData(Hot, false, false, false, null, false)]
    [InlineData(Warm, false, false, false, null, false)]
    [InlineData(Mild, true, false, false, null, true)]
    [InlineData(Cold, false, false, true, 3, true)]
    [InlineData(Freezing, false, true, true, 4, true)]
    public void Every_outfit_must_then_carry_what_the_band_demands(double feels, bool layer, bool midLayer, bool outerwear, int? outerwearWarmth, bool closedShoes)
    {
        var candidates = CandidateFilter.Select([Tee, Jeans, Sneakers], Day(feels), Occasion.Everyday);

        Assert.Equal(new WeatherDemands(layer, midLayer, outerwear, outerwearWarmth, false, closedShoes), candidates.Demands);
        Assert.False(candidates.Umbrella);
    }

    [Fact]
    public void At_most_twelve_candidates_per_role_half_favourites_and_half_forgotten()
    {
        var favourites = Enumerable.Range(0, 20).Select(index => Garment(Subcategory.TShirt, wearCount: index, likes: index == 3 ? 2 : 0)).ToList();
        var forgotten = Enumerable.Range(0, 20).Select(index => Garment(Subcategory.Shirt, wearCount: 20 - index, forgotten: true)).ToList();

        var candidates = CandidateFilter.Select([.. favourites, .. forgotten, Jeans, Sneakers], Day(Warm), Occasion.Everyday);

        var tops = candidates.In(Category.Top);
        Assert.Equal(CandidateFilter.MaxPerRole, tops.Count);
        // Liked first, then the most worn; of the forgotten, the least worn.
        Assert.Equal([favourites[3], favourites[19], favourites[18], favourites[17], favourites[16], favourites[15]], tops.Take(6));
        Assert.Equal([forgotten[19], forgotten[18], forgotten[17], forgotten[16], forgotten[15], forgotten[14]], tops.Skip(6));
    }

    [Theory]
    [InlineData(2, 20, 2, 10)]
    [InlineData(20, 1, 11, 1)]
    [InlineData(3, 4, 3, 4)]
    [InlineData(0, 30, 0, 12)]
    [InlineData(30, 0, 12, 0)]
    public void A_half_that_comes_up_short_is_filled_from_the_other(int favourites, int forgotten, int keptFavourites, int keptForgotten)
    {
        var wardrobe = Enumerable.Range(0, favourites).Select(_ => Garment(Subcategory.Sneakers))
            .Concat(Enumerable.Range(0, forgotten).Select(_ => Garment(Subcategory.Boots, forgotten: true)))
            .Append(Tee).Append(Jeans).ToList();

        var shoes = CandidateFilter.Select(wardrobe, Day(Warm), Occasion.Everyday).In(Category.Shoes);

        Assert.Equal((keptFavourites, keptForgotten), (shoes.Count(garment => !garment.Forgotten), shoes.Count(garment => garment.Forgotten)));
    }

    [Fact]
    public void Candidates_go_by_short_aliases_numbered_within_their_role()
    {
        var shirt = Garment(Subcategory.Shirt);
        var sweater = Garment(Subcategory.Sweater);
        var dress = Garment(Subcategory.Dress);
        var jacket = Garment(Subcategory.DenimJacket);
        var belt = Garment(Subcategory.Belt);
        var cap = Garment(Subcategory.Cap);

        var candidates = CandidateFilter.Select([Tee, shirt, sweater, Jeans, dress, jacket, Sneakers, belt, cap], Day(Warm), Occasion.Everyday);

        Assert.Equal(["T1", "T2", "M1", "B1", "D1", "O1", "S1", "A1", "A2"], candidates.Items.Select(candidate => candidate.Alias));
        Assert.Equal("T2", candidates.AliasOf(shirt.Id));
        Assert.Same(cap, candidates.Find("A2")?.Garment);
        Assert.Null(candidates.Find("T3"));
        Assert.Null(candidates.AliasOf(Guid.NewGuid()));
    }

    [Fact]
    public void The_base_garment_is_kept_whatever_the_rules_say_and_nothing_competes_for_its_slot()
    {
        var gala = Garment(Subcategory.Shirt, formality: 5, warmth: 5, inLaundry: true);
        var dress = Garment(Subcategory.Dress);

        var candidates = CandidateFilter.Select([Tee, gala, Jeans, dress, Sneakers], Day(Hot), Occasion.Everyday, gala.Id);

        Assert.Same(gala, candidates.BaseItem);
        Assert.Equal([gala], candidates.In(Category.Top));
        // A one-piece cannot be worn with the top the person asked for.
        Assert.Empty(candidates.In(Category.OnePiece));
        Assert.Empty(candidates.Relaxations);
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void A_base_one_piece_leaves_no_tops_and_bottoms_and_needs_none()
    {
        var dress = Garment(Subcategory.Dress, formality: 5);

        var candidates = CandidateFilter.Select([Tee, Jeans, dress, Sneakers], Day(Warm), Occasion.Everyday, dress.Id);

        Assert.Equal([dress], candidates.In(Category.OnePiece));
        Assert.Empty(candidates.In(Category.Top));
        Assert.Empty(candidates.In(Category.Bottom));
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void A_base_top_still_needs_a_bottom_even_when_there_are_dresses()
    {
        var dress = Garment(Subcategory.Dress);
        var formalTrousers = Garment(Subcategory.Trousers, formality: 4);

        var none = CandidateFilter.Select([Tee, dress, Sneakers], Day(Warm), Occasion.Everyday, Tee.Id);
        var relaxed = CandidateFilter.Select([Tee, dress, formalTrousers, Sneakers], Day(Warm), Occasion.Everyday, Tee.Id);

        Assert.Equal([Category.Bottom], none.Missing);
        Assert.Equal([formalTrousers], relaxed.In(Category.Bottom));
        Assert.Equal([new Relaxation(Category.Bottom, RelaxedRule.Formality)], relaxed.Relaxations);
    }

    [Fact]
    public void A_base_accessory_comes_first_among_the_accessories_and_a_base_coat_survives_a_hot_day()
    {
        var belt = Garment(Subcategory.Belt);
        var tie = Garment(Subcategory.Tie, formality: 5);
        var coat = Garment(Subcategory.Coat, warmth: 4);

        var withTie = CandidateFilter.Select([Tee, Jeans, Sneakers, belt, tie], Day(Warm), Occasion.Everyday, tie.Id);
        var withCoat = CandidateFilter.Select([Tee, Jeans, Sneakers, coat], Day(Hot), Occasion.Everyday, coat.Id);

        Assert.Equal([tie, belt], withTie.In(Category.Accessory));
        Assert.Equal("A1", withTie.AliasOf(tie.Id));
        Assert.Equal([coat], withCoat.In(Category.Outerwear));
    }

    [Fact]
    public void An_unknown_base_garment_is_no_base_garment()
    {
        var candidates = CandidateFilter.Select([Tee, Jeans, Sneakers], Day(Warm), Occasion.Everyday, Guid.NewGuid());

        Assert.Null(candidates.BaseItem);
        Assert.True(candidates.IsComplete);
    }

    [Fact]
    public void In_rain_only_outerwear_that_stands_it_is_offered_when_the_wardrobe_has_some()
    {
        var raincoat = Garment(Subcategory.Raincoat, rainOk: true);
        var denim = Garment(Subcategory.DenimJacket);

        var rainy = CandidateFilter.Select([Tee, Jeans, Sneakers, raincoat, denim], Day(Warm, rain: true), Occasion.Everyday);
        var dry = CandidateFilter.Select([Tee, Jeans, Sneakers, raincoat, denim], Day(Warm), Occasion.Everyday);

        Assert.Equal([raincoat], rainy.In(Category.Outerwear));
        Assert.True(rainy.Demands.RainOuterwear);
        // On a warm day outerwear is otherwise optional; rain makes it part of every outfit.
        Assert.True(rainy.Demands.Outerwear);
        Assert.False(rainy.Umbrella);
        Assert.Equal([raincoat, denim], dry.In(Category.Outerwear));
        Assert.False(dry.Demands.RainOuterwear);
        Assert.False(dry.Demands.Outerwear);
        Assert.False(dry.Umbrella);
    }

    [Fact]
    public void Without_anything_for_rain_the_proposals_carry_the_umbrella_flag()
    {
        var denim = Garment(Subcategory.DenimJacket);
        var raincoat = Garment(Subcategory.Raincoat, rainOk: true);
        var thinRaincoat = Garment(Subcategory.Raincoat, warmth: 1, rainOk: true);
        var boots = Garment(Subcategory.Boots);
        var coat = Garment(Subcategory.Coat, warmth: 4);

        var nothingProof = CandidateFilter.Select([Tee, Jeans, Sneakers, denim], Day(Warm, rain: true), Occasion.Everyday);
        // Outerwear has no place on a hot day, rain or not.
        var hot = CandidateFilter.Select([Tee, Jeans, Sneakers, raincoat], Day(Hot, rain: true), Occasion.Everyday);
        // The only rain-proof coat is too thin for the cold: the warm one is worn, with an umbrella.
        var cold = CandidateFilter.Select([Tee, Jeans, boots, thinRaincoat, coat], Day(Cold, rain: true), Occasion.Everyday);
        // The person asked for the denim jacket: it stays, the raincoat cannot join it.
        var baseJacket = CandidateFilter.Select([Tee, Jeans, Sneakers, raincoat, denim], Day(Warm, rain: true), Occasion.Everyday, denim.Id);

        Assert.True(nothingProof.Umbrella);
        Assert.Equal([denim], nothingProof.In(Category.Outerwear));
        Assert.False(nothingProof.Demands.RainOuterwear);
        Assert.False(nothingProof.Demands.Outerwear);
        Assert.True(hot.Umbrella);
        Assert.Empty(hot.In(Category.Outerwear));
        Assert.True(cold.Umbrella);
        Assert.Equal([coat], cold.In(Category.Outerwear));
        Assert.True(baseJacket.Umbrella);
        Assert.Equal([denim], baseJacket.In(Category.Outerwear));
    }

    [Fact]
    public void Suede_shoes_stay_home_in_rain_when_there_is_anything_else()
    {
        var suede = Garment(Subcategory.Loafers, material: Material.Suede);

        var withChoice = CandidateFilter.Select([Tee, Jeans, Sneakers, suede], Day(Warm, rain: true), Occasion.Everyday);
        var onlySuede = CandidateFilter.Select([Tee, Jeans, suede], Day(Warm, rain: true), Occasion.Everyday);
        var dry = CandidateFilter.Select([Tee, Jeans, Sneakers, suede], Day(Warm), Occasion.Everyday);
        var asked = CandidateFilter.Select([Tee, Jeans, Sneakers, suede], Day(Warm, rain: true), Occasion.Everyday, suede.Id);

        Assert.Equal([Sneakers], withChoice.In(Category.Shoes));
        Assert.Equal([suede], onlySuede.In(Category.Shoes));
        Assert.True(onlySuede.IsComplete);
        Assert.Equal([Sneakers, suede], dry.In(Category.Shoes));
        Assert.Equal([suede], asked.In(Category.Shoes));
    }

    [Theory]
    [InlineData(1, 1, 1, 0, 0, 0)]
    [InlineData(2, 1, 1, 0, 0, 1)]
    [InlineData(2, 2, 1, 0, 0, 2)]
    [InlineData(1, 1, 1, 1, 0, 1)]
    [InlineData(1, 1, 1, 1, 1, 2)]
    [InlineData(3, 3, 3, 3, 3, 2)]
    public void Proposals_must_differ_in_two_places_only_as_far_as_the_wardrobe_gives_a_choice(int tops, int bottoms, int shoes, int midLayers, int accessories, int difference)
    {
        var wardrobe = Enumerable.Range(0, tops).Select(_ => Garment(Subcategory.TShirt))
            .Concat(Enumerable.Range(0, bottoms).Select(_ => Garment(Subcategory.Jeans)))
            .Concat(Enumerable.Range(0, shoes).Select(_ => Garment(Subcategory.Sneakers)))
            .Concat(Enumerable.Range(0, midLayers).Select(_ => Garment(Subcategory.Cardigan)))
            .Concat(Enumerable.Range(0, accessories).Select(_ => Garment(Subcategory.Belt)))
            .ToList();

        Assert.Equal(difference, CandidateFilter.Select(wardrobe, Day(Warm), Occasion.Everyday).MinDifference);
    }
}
