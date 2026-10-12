using FitIt.Core.Accounts;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;
using static FitIt.Tests.Styling.Looks;

namespace FitIt.Tests.Styling;

public sealed class RuleBasedStylistTests
{
    private static readonly IReadOnlySet<(Guid, Guid)> NothingWorn = new HashSet<(Guid, Guid)>();

    /// <summary>The forty-one garments of the fake tagger: a wardrobe with something for every role.</summary>
    private static readonly Garment[] Full =
        [.. FakeGarmentTagger.Wardrobe.Select((tags, index) => new Garment(new Guid(1000 + index, 0, 0, new byte[8]), tags, tags.Describe(), WearCount: index % 4, Forgotten: index % 3 == 0))];

    public static TheoryData<double, bool, Occasion> Matrix()
    {
        var data = new TheoryData<double, bool, Occasion>();
        foreach (var feels in (double[])[Hot, Warm, Mild, Cold, Freezing])
        {
            foreach (var occasion in Enum.GetValues<Occasion>())
            {
                data.Add(feels, false, occasion);
                data.Add(feels, true, occasion);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Matrix))]
    public void Whenever_the_wardrobe_can_dress_the_person_it_does_and_breaks_no_hard_rule(double feels, bool rain, Occasion occasion)
    {
        var weather = Day(feels, rain);
        var candidates = CandidateFilter.Select(Full, weather, occasion);
        for (var seed = 0; seed < 25; seed++)
        {
            var proposals = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(seed));

            if (!candidates.IsComplete)
            {
                continue;
            }

            Assert.NotEmpty(proposals);
            Assert.All(proposals, proposal => Assert.Empty(OutfitValidator.Check(proposal.Outfit, candidates)));
            // Read back through the same door a model's answer comes in by: aliases, then the validator.
            Assert.All(proposals, proposal =>
            {
                var named = StylistOutfit.From(proposal.Outfit, candidates, proposal.Kind, proposal.Reasoning, proposal.WeatherNote);
                var result = Assert.Single(OutfitValidator.Check([named], candidates));
                Assert.True(result.IsValid, string.Join(' ', result.Violations.Select(violation => violation.Describe())));
            });
            // Never the same outfit twice, however little the wardrobe leaves to choose from.
            Assert.All(proposals, one => Assert.All(proposals.Where(other => other != one), other => Assert.True(one.Outfit.DifferenceFrom(other.Outfit) >= 1)));
            // Nobody's styles are known here, so of style only the clashes within an outfit count.
            Assert.All(proposals, proposal => Assert.Equal(CoherenceScore.Of(proposal.Outfit, weather.Rule, []), proposal.Score));
            Assert.All(proposals, proposal => Assert.Equal(proposal.Kind, proposal.Outfit.Confirm(proposal.Kind, NothingWorn)));
        }
    }

    [Fact]
    public void The_matrix_is_not_vacuous_most_days_and_occasions_can_be_dressed_from_the_full_wardrobe()
    {
        var complete = Matrix().Count(row => CandidateFilter.Select(Full, Day((double)row[0], (bool)row[1]), (Occasion)row[2]).IsComplete);

        Assert.True(complete >= 40, $"Only {complete} of 60 cases are complete.");
    }

    [Fact]
    public void A_full_wardrobe_gets_three_proposals_the_best_first()
    {
        var weather = Day(Mild);
        var candidates = CandidateFilter.Select(Full, weather, Occasion.Everyday);

        var proposals = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(7));

        Assert.Equal(3, proposals.Count);
        Assert.True(proposals[0].Score >= proposals[1].Score);
        Assert.True(proposals[0].Score >= proposals[2].Score);
        Assert.All(proposals, proposal => Assert.InRange(proposal.Score, 0, 100));
        // Pairwise at least two places apart: this wardrobe allows it.
        Assert.True(proposals[0].Outfit.DifferenceFrom(proposals[1].Outfit) >= 2);
        Assert.True(proposals[0].Outfit.DifferenceFrom(proposals[2].Outfit) >= 2);
        Assert.True(proposals[1].Outfit.DifferenceFrom(proposals[2].Outfit) >= 2);
    }

    [Fact]
    public void The_same_seed_gives_the_same_proposals_and_another_seed_others()
    {
        var weather = Day(Mild);
        var candidates = CandidateFilter.Select(Full, weather, Occasion.Everyday);
        static IEnumerable<Guid> Ids(IReadOnlyList<Proposal> proposals) => proposals.SelectMany(proposal => proposal.Outfit.Items.Select(garment => garment.Id));

        var once = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(11));
        var again = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(11));
        var others = Enumerable.Range(12, 10).Select(seed => RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(seed)));

        Assert.Equal(Ids(once), Ids(again));
        Assert.Equal(once.Select(proposal => (proposal.Kind, proposal.Score, proposal.Reasoning)), again.Select(proposal => (proposal.Kind, proposal.Score, proposal.Reasoning)));
        Assert.Contains(others, other => !Ids(other).SequenceEqual(Ids(once)));
    }

    [Fact]
    public void The_first_is_the_best_scored_the_second_has_a_forgotten_garment_the_third_differs_from_both()
    {
        // Two of everything, so all sixteen outfits get drawn: the clashing top and the dusty shoes decide the order.
        var tee = Garment(Subcategory.TShirt, warmth: 1);
        var loud = Garment(Subcategory.Shirt, colors: [Color.Red, Color.Yellow], pattern: Pattern.Floral, formality: 3);
        var jeans = Garment(Subcategory.Jeans);
        var loudTrousers = Garment(Subcategory.Chinos, colors: [Color.Green, Color.Purple], pattern: Pattern.Check, formality: 3);
        var sneakers = Garment(Subcategory.Sneakers);
        var dusty = Garment(Subcategory.Loafers, forgotten: true, name: "Suede loafers");
        var weather = Day(Warm);
        var candidates = CandidateFilter.Select([tee, loud, jeans, loudTrousers, sneakers, dusty], weather, Occasion.Everyday);

        var proposals = RuleBasedStylist.Compose(candidates, weather, new HashSet<(Guid, Guid)> { (tee.Id, jeans.Id) }, new Random(3));

        Assert.Equal(3, proposals.Count);
        // Loud top with loud trousers is the only combination that pays (four colours, two patterns).
        Assert.Equal([100, 100, 100], proposals.Select(proposal => proposal.Score));
        Assert.DoesNotContain(proposals, proposal => proposal.Outfit.Top == loud && proposal.Outfit.Bottom == loudTrousers);
        Assert.Contains(dusty, proposals[1].Outfit.Items);
        Assert.Equal(OutfitKind.Discovery, proposals[1].Kind);
        Assert.Contains("Suede loafers", proposals[1].Reasoning, StringComparison.Ordinal);
        Assert.True(proposals[2].Outfit.DifferenceFrom(proposals[0].Outfit) >= 2);
        Assert.True(proposals[2].Outfit.DifferenceFrom(proposals[1].Outfit) >= 2);
        // A kind is claimed by position and kept only when the outfit meets it.
        Assert.Equal(proposals[0].Outfit.Confirm(OutfitKind.SureBet, NothingWorn), proposals[0].Kind);
        Assert.Equal(proposals[2].Outfit.Top == tee && proposals[2].Outfit.Bottom == jeans ? null : OutfitKind.NewPairing, proposals[2].Kind);
    }

    [Fact]
    public void A_pairing_already_worn_is_not_offered_as_new()
    {
        var tee = Garment(Subcategory.TShirt, warmth: 1);
        var jeans = Garment(Subcategory.Jeans);
        var sneakers = Garment(Subcategory.Sneakers);
        var boots = Garment(Subcategory.Boots);
        var loafers = Garment(Subcategory.Loafers);
        var weather = Day(Warm);
        var candidates = CandidateFilter.Select([tee, jeans, sneakers, boots, loafers], weather, Occasion.Everyday);

        var fresh = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(1));
        var worn = RuleBasedStylist.Compose(candidates, weather, new HashSet<(Guid, Guid)> { (tee.Id, jeans.Id) }, new Random(1));

        Assert.Equal([OutfitKind.SureBet, null, OutfitKind.NewPairing], fresh.Select(proposal => proposal.Kind));
        Assert.Equal([OutfitKind.SureBet, null, null], worn.Select(proposal => proposal.Kind));
    }

    [Fact]
    public void A_tiny_wardrobe_gets_as_many_proposals_as_it_has_outfits()
    {
        var tee = Garment(Subcategory.TShirt, warmth: 1);
        var jeans = Garment(Subcategory.Jeans);
        var sneakers = Garment(Subcategory.Sneakers);
        var boots = Garment(Subcategory.Boots);
        var weather = Day(Warm);

        var one = RuleBasedStylist.Compose(CandidateFilter.Select([tee, jeans, sneakers], weather, Occasion.Everyday), weather, NothingWorn, new Random(5));
        var two = RuleBasedStylist.Compose(CandidateFilter.Select([tee, jeans, sneakers, boots], weather, Occasion.Everyday), weather, NothingWorn, new Random(5));

        Assert.Equal([tee, jeans, sneakers], Assert.Single(one).Outfit.Items);
        Assert.Equal(2, two.Count);
        Assert.NotEqual(two[0].Outfit.Shoes, two[1].Outfit.Shoes);
    }

    [Fact]
    public void Candidates_that_cannot_dress_anybody_give_no_proposals()
    {
        var weather = Day(Warm);
        var candidates = CandidateFilter.Select([Garment(Subcategory.TShirt), Garment(Subcategory.Sneakers)], weather, Occasion.Everyday);

        Assert.False(candidates.IsComplete);
        Assert.Empty(RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(1)));
    }

    [Theory]
    [InlineData(Subcategory.Shirt)]
    [InlineData(Subcategory.Cardigan)]
    [InlineData(Subcategory.Chinos)]
    [InlineData(Subcategory.Dress)]
    [InlineData(Subcategory.Coat)]
    [InlineData(Subcategory.Heels)]
    [InlineData(Subcategory.Tie)]
    public void The_base_garment_is_in_every_proposal(Subcategory type)
    {
        // Formal and warm enough to break the rules of a hot everyday: it is kept regardless.
        var asked = Garment(type, formality: 5, warmth: 4);
        var weather = Day(Hot);
        var candidates = CandidateFilter.Select([.. Full, asked], weather, Occasion.Everyday, asked.Id);

        var proposals = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(2));

        Assert.Equal(3, proposals.Count);
        Assert.All(proposals, proposal => Assert.Contains(asked, proposal.Outfit.Items));
        Assert.All(proposals, proposal => Assert.Empty(OutfitValidator.Check(proposal.Outfit, candidates)));
    }

    [Fact]
    public void In_rain_every_proposal_wears_the_rain_proof_outerwear_and_says_so()
    {
        var weather = Day(Warm, rain: true);
        var candidates = CandidateFilter.Select(Full, weather, Occasion.Everyday);

        var proposals = RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(4));

        Assert.All(proposals, proposal => Assert.True(proposal.Outfit.Outerwear?.Tags.RainOk));
        Assert.All(proposals, proposal => Assert.Equal("Rain is expected, and this outerwear is made for it.", proposal.WeatherNote));
    }

    [Fact]
    public void A_day_with_a_big_swing_gets_a_note_about_the_layer_and_a_plain_day_none()
    {
        var swing = Day(Mild, needsLayers: true);
        var plain = Day(Warm);

        var layered = RuleBasedStylist.Compose(CandidateFilter.Select(Full, swing, Occasion.Everyday), swing, NothingWorn, new Random(4));
        var bare = RuleBasedStylist.Compose(CandidateFilter.Select([Garment(Subcategory.TShirt), Garment(Subcategory.Jeans), Garment(Subcategory.Sneakers)], plain, Occasion.Everyday), plain, NothingWorn, new Random(4));

        Assert.All(layered, proposal => Assert.Equal("It will warm up during the day, so you can take off one layer.", proposal.WeatherNote));
        Assert.Null(Assert.Single(bare).WeatherNote);
    }

    [Fact]
    public void The_template_reasoning_speaks_to_the_person_without_dashes_or_emoji()
    {
        var weather = Day(Mild);
        var candidates = CandidateFilter.Select(Full, weather, Occasion.Everyday);

        var texts = Enumerable.Range(0, 30)
            .SelectMany(seed => RuleBasedStylist.Compose(candidates, weather, NothingWorn, new Random(seed)))
            .SelectMany(proposal => new[] { proposal.Reasoning, proposal.WeatherNote })
            .OfType<string>().Distinct().ToList();

        Assert.True(texts.Count >= 3);
        Assert.All(texts, text =>
        {
            Assert.DoesNotContain('—', text);
            Assert.DoesNotContain('–', text);
            Assert.DoesNotContain(" - ", text, StringComparison.Ordinal);
            Assert.All(text, letter => Assert.False(char.IsSurrogate(letter)));
            Assert.EndsWith(".", text, StringComparison.Ordinal);
        });
    }

    [Fact]
    public void The_request_to_the_model_is_the_object_of_the_spec_with_aliases_instead_of_ids()
    {
        var shirt = Garment(Subcategory.Shirt, formality: 4, colors: [Color.Navy], wearCount: 6, name: "Navy oxford shirt") with { Description = "navy oxford shirt, button-down collar" };
        var blazer = Garment(Subcategory.Blazer, formality: 4, warmth: 3);
        var trousers = Garment(Subcategory.Trousers, formality: 4, warmth: 3, colors: [Color.Grey]);
        var coat = Garment(Subcategory.Coat, formality: 4, warmth: 4, rainOk: true, material: Material.Wool, forgotten: true);
        var derbies = Garment(Subcategory.DressShoes, formality: 4, material: Material.Leather);
        var sneakers = Garment(Subcategory.Sneakers, formality: 1);
        var weather = Day(Cold, rain: true);
        var candidates = CandidateFilter.Select([shirt, blazer, trousers, coat, derbies, sneakers], weather, Occasion.Work, shirt.Id);
        var history = new StylingHistory(
            Recent: [[shirt.Id, trousers.Id, derbies.Id]],
            Liked: [[shirt.Id, blazer.Id, trousers.Id, derbies.Id], [sneakers.Id, Guid.NewGuid()]],
            Disliked: [[trousers.Id, sneakers.Id, Guid.NewGuid()]],
            WornPairs: new HashSet<(Guid, Guid)>());

        var brief = new StylingCase(weather, Occasion.Work, "client presentation", [StyleTag.Smart], ThermalPreference.RunsCold, candidates, history).Brief();
        var json = System.Text.Json.Nodes.JsonNode.Parse(brief.ToJson())!;

        Assert.Equal(
            """{"feels_min":6,"feels_max":8,"rain":true,"needs_layers":false,"requires":["outerwear with warmth >= 3","closed shoes","rain outerwear"]}""",
            json["weather"]!.ToJsonString(Relaxed));
        Assert.Equal(
            """{"name":"Work or school","formality":[2,4],"note":"client presentation"}""",
            json["occasion"]!.ToJsonString(Relaxed));
        // Styles go by their codes, and only the person's own are explained (this occasion prefers none).
        Assert.Equal("""["smart"]""", json["profile"]!["styles"]!.ToJsonString());
        Assert.Equal("usually feels cold", json["profile"]!["thermal"]!.GetValue<string>());
        Assert.Equal("""["casual","elegant","minimalist","old_money","preppy","business"]""", json["profile"]!["nearby_styles"]!.ToJsonString());
        Assert.Equal(["smart"], json["profile"]!["style_notes"]!.AsObject().Select(note => note.Key));
        Assert.Equal(StyleGuide.Of(StyleTag.Smart), json["profile"]!["style_notes"]!["smart"]!.GetValue<string>());
        Assert.Null(json["profile"]!["flattering_colors"]);
        Assert.Equal("T1", json["base_item"]!.GetValue<string>());
        Assert.Equal("[]", json["relaxations"]!.ToJsonString());
        Assert.Equal("""[["T1","B1","S1"]]""", json["recent"]!.ToJsonString());
        // The sneakers are no candidate today: an outfit left with fewer than two known garments says nothing and is dropped.
        Assert.Equal("""[["T1","M1","B1","S1"]]""", json["liked"]!.ToJsonString());
        Assert.Equal("[]", json["disliked"]!.ToJsonString());
        Assert.Equal(["T1", "M1", "B1", "O1", "S1"], json["candidates"]!.AsArray().Select(candidate => candidate!["id"]!.GetValue<string>()));
        Assert.Equal(
            """{"id":"T1","role":"top","sub":"shirt","colors":["navy"],"pattern":"plain","styles":["casual"],"formality":4,"warmth":2,"rain_ok":false,"worn":6,"forgotten":false,"desc":"navy oxford shirt, button-down collar"}""",
            json["candidates"]![0]!.ToJsonString(Relaxed));
        Assert.True(json["candidates"]![3]!["forgotten"]!.GetValue<bool>());
        Assert.DoesNotContain(shirt.Id.ToString(), brief.ToJson(), StringComparison.Ordinal);
    }

    [Fact]
    public void The_request_names_relaxed_rules_the_preferred_style_and_leaves_out_what_is_not_there()
    {
        var tee = Garment(Subcategory.TShirt, warmth: 1);
        var jeans = Garment(Subcategory.Jeans);
        var slippers = Garment(Subcategory.Sneakers, formality: 1);
        var weather = Day(Warm);
        var candidates = CandidateFilter.Select([tee, jeans, slippers], weather, Occasion.Date);

        var json = System.Text.Json.Nodes.JsonNode.Parse(new StylingCase(weather, Occasion.Date, null, [], ThermalPreference.RunsWarm, candidates, StylingHistory.None).Brief().ToJson())!;

        Assert.Equal("""["shoes: formality range widened by 1"]""", json["relaxations"]!.ToJsonString(Relaxed));
        Assert.Equal("""{"name":"Date or evening out","formality":[2,4],"preferred_style":"elegant"}""", json["occasion"]!.ToJsonString(Relaxed));
        Assert.Equal("usually feels warm", json["profile"]!["thermal"]!.GetValue<string>());
        Assert.Null(json["base_item"]);
        Assert.Equal("[]", json["weather"]!["requires"]!.ToJsonString());
    }

    private static readonly System.Text.Json.JsonSerializerOptions Relaxed = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
}
