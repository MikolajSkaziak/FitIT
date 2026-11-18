using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>Who said a line of the conversation with the stylist.</summary>
public enum ChatRole
{
    Person,
    Stylist,
}

/// <summary>One line of the conversation as the app sends it. The person's lines are their own words: data, never instructions.</summary>
public sealed record ChatMessage(ChatRole Role, string Text);

/// <summary>A generic piece worth buying ("Navy unstructured blazer"): never a brand, a shop, a link or a price. <paramref name="Why"/> says what it unlocks with what the person owns.</summary>
public sealed record ShoppingIdea(string Name, Category Category, string Why, IReadOnlyList<Color> Colors);

/// <summary>
/// What the stylist said, garments by alias, before anything in it is trusted. <paramref name="Outfit"/> carries its note in
/// <see cref="StylistOutfit.Reasoning"/>; <paramref name="OutfitOccasion"/> is the occasion the stylist dressed it for, if it named one.
/// </summary>
public sealed record ChatAnswer(
    string Text,
    StylistOutfit? Outfit,
    Occasion? OutfitOccasion,
    IReadOnlyList<string> Mentioned,
    IReadOnlyList<ShoppingIdea> Shopping,
    IReadOnlyList<string> FollowUps);

/// <summary>An outfit of the conversation that passed the hard rules.</summary>
public sealed record ChatOutfit(Occasion Occasion, OutfitDraft Draft, string? Note);

/// <summary>
/// The stylist's reply once checked: garments are the person's own, the outfit is valid or gone. <paramref name="Cost"/> is
/// what the model's answer cost, null when the rules answered. <paramref name="Dropped"/> says why an outfit the stylist
/// proposed was left out, for the log.
/// </summary>
public sealed record StylistChatReply(
    string Text,
    ChatOutfit? Outfit,
    IReadOnlyList<Garment> Mentioned,
    IReadOnlyList<ShoppingIdea> Shopping,
    IReadOnlyList<string> FollowUps,
    AiCost? Cost,
    IReadOnlyList<string> Dropped)
{
    public bool FromRules => Cost is null;
}

/// <summary>A role the wardrobe would gain most from, and why; <paramref name="Style"/> is set when the gap is in one of the person's styles.</summary>
public sealed record WardrobeNeed(Category Role, StyleTag? Style, string Reason);

/// <summary>How one of the person's styles is covered: garments that carry it, garments that go with it, and the roles none of its own garments fill.</summary>
public sealed record StyleCoverage(StyleTag Style, int Carrying, int GoingWith, IReadOnlyList<Category> Missing);

/// <summary>
/// What the code can tell about a wardrobe without a model: how many garments of each role and group, which essential
/// roles are empty, what the day's weather would lack, how each of the person's styles is covered and which ratios are
/// lopsided. <see cref="Sentences"/> words all of it for the model; <see cref="Needs"/> is the same, as roles to fill,
/// most important first.
/// </summary>
public sealed record WardrobeFacts(
    IReadOnlyDictionary<Category, int> ByRole,
    IReadOnlyDictionary<GarmentGroup, int> ByGroup,
    IReadOnlyList<Category> MissingRoles,
    IReadOnlyList<Category> MissingForWeather,
    IReadOnlyList<StyleCoverage> Styles,
    IReadOnlyList<string> Sentences,
    IReadOnlyList<WardrobeNeed> Needs)
{
    /// <summary>The roles every wardrobe needs at least one of. A one-piece stands in for a top and a bottom, but is not needed itself.</summary>
    public static readonly IReadOnlyList<Category> Essential = [Category.Top, Category.Bottom, Category.Shoes, Category.Outerwear, Category.MidLayer];

    /// <param name="aliasOf">The alias a garment goes by in the brief, so sentences can point at garments; null when it is not listed.</param>
    public static WardrobeFacts Of(
        IReadOnlyList<Garment> wardrobe, IReadOnlyList<StyleTag> styles, WeatherProfile? weather, Occasion? occasion, Func<Guid, string?> aliasOf)
    {
        var byRole = Enum.GetValues<Category>().ToDictionary(role => role, role => wardrobe.Count(garment => garment.Role == role));
        var byGroup = wardrobe.GroupBy(garment => GarmentCatalog.GroupOf(garment.Tags.Subcategory)).OrderBy(group => group.Key).ToDictionary(group => group.Key, group => group.Count());
        var sentences = new List<string>();
        var needs = new List<WardrobeNeed>();
        int Count(Category role) => byRole[role];
        var (tops, bottoms, onePieces, shoes) = (Count(Category.Top), Count(Category.Bottom), Count(Category.OnePiece), Count(Category.Shoes));
        var body = tops + bottoms + onePieces;

        var missing = Essential.Where(role => Count(role) == 0).ToList();
        foreach (var role in missing)
        {
            var reason = role switch
            {
                Category.Shoes => "No shoes: no outfit can be finished.",
                Category.Top => onePieces > 0 ? "No tops: only the one-pieces make an outfit." : "No tops: no outfit can be put together.",
                Category.Bottom => onePieces > 0 ? "No bottoms: only the one-pieces make an outfit." : "No bottoms: no outfit can be put together.",
                Category.Outerwear => "No outerwear: nothing to wear over an outfit on a cold or rainy day.",
                _ => "No mid layer (sweater, cardigan, blazer) for cool days or for layering.",
            };
            sentences.Add(reason);
            needs.Add(new WardrobeNeed(role, null, reason));
        }

        var forWeather = new List<Category>();
        if (weather is not null && wardrobe.Count > 0)
        {
            var set = CandidateFilter.Select(wardrobe, weather, occasion ?? Occasion.Everyday, styles: styles);
            forWeather.AddRange(set.Missing);
            var either = set.MissingEither.Count > 0 ? " a mid layer or outerwear" : "";
            if (set.Missing.Count > 0 || either.Length > 0)
            {
                var lacks = string.Join(", ", set.Missing.Select(role => GarmentCatalog.Role(role).ToLowerInvariant()));
                sentences.Add($"For this day's weather{(occasion is { } named ? $" and {OccasionRule.For(named).Label.ToLowerInvariant()}" : "")} the wardrobe cannot make a complete outfit: it lacks {lacks}{(lacks.Length > 0 && either.Length > 0 ? " and" : "")}{either}.");
                needs.AddRange(set.Missing.Where(role => !missing.Contains(role)).Select(role => new WardrobeNeed(role, null, $"Needed for this day's weather: no {GarmentCatalog.Role(role).ToLowerInvariant()} fits it.")));
                if (either.Length > 0 && !missing.Contains(Category.MidLayer) && !missing.Contains(Category.Outerwear))
                {
                    needs.Add(new WardrobeNeed(Category.MidLayer, null, "Needed for this day's weather: a layer to wear over a top."));
                }
            }
            else if (set.Relaxations.Count > 0)
            {
                sentences.Add($"For this day{(occasion is { } named ? $" and {OccasionRule.For(named).Label.ToLowerInvariant()}" : "")} only a near match exists for: {string.Join(", ", set.Relaxations.Select(relaxation => GarmentCatalog.Role(relaxation.Role).ToLowerInvariant()).Distinct())}.");
            }

            if (weather.Rain && Count(Category.Outerwear) > 0 && !wardrobe.Any(garment => garment.Role == Category.Outerwear && garment.Tags.RainOk))
            {
                sentences.Add("Rain is expected and no outerwear stands rain.");
            }
        }

        if (Count(Category.Outerwear) > 0 && !wardrobe.Any(garment => garment.Role == Category.Outerwear && garment.Tags.RainOk) && weather?.Rain != true)
        {
            sentences.Add("No outerwear stands rain.");
            needs.Add(new WardrobeNeed(Category.Outerwear, null, "Nothing in the wardrobe stands rain."));
        }

        if (shoes > 0 && wardrobe.Where(garment => garment.Role == Category.Shoes).All(garment => BandRule.IsOpen(garment.Tags.Subcategory)))
        {
            sentences.Add("Only open shoes (sandals, flip-flops): nothing for cold or wet days.");
            needs.Add(new WardrobeNeed(Category.Shoes, null, "Only open shoes: nothing for cold or wet days."));
        }

        var coverage = new List<StyleCoverage>();
        foreach (var style in styles.Distinct())
        {
            StyleTag[] one = [style];
            var carrying = wardrobe.Where(garment => StyleFit.Of(garment, one) == StyleFit.Direct).ToList();
            var goingWith = wardrobe.Count(garment => StyleFit.Of(garment, one) == StyleFit.Compatible);
            bool Has(params Category[] roles) => carrying.Any(garment => roles.Contains(garment.Role));
            var lacking = new List<Category>();
            if (!Has(Category.Top, Category.OnePiece))
            {
                lacking.Add(Category.Top);
            }

            if (!Has(Category.Bottom, Category.OnePiece))
            {
                lacking.Add(Category.Bottom);
            }

            if (!Has(Category.Shoes))
            {
                lacking.Add(Category.Shoes);
            }

            if (!Has(Category.Outerwear, Category.MidLayer))
            {
                lacking.Add(Category.Outerwear);
            }

            coverage.Add(new StyleCoverage(style, carrying.Count, goingWith, lacking));
            var label = GarmentCatalog.Label(style);
            if (carrying.Count == 0)
            {
                sentences.Add($"Nothing carries the {label} style yet; {goingWith} {Plural(goingWith, "garment goes", "garments go")} with it.");
            }
            else if (lacking.Count > 0)
            {
                sentences.Add($"{label}: {carrying.Count} {Plural(carrying.Count, "garment carries", "garments carry")} the style, but no {Join(lacking.Select(Noun))} in it.");
            }
            else
            {
                sentences.Add($"{label}: {carrying.Count} garments carry the style, enough for whole outfits.");
            }

            needs.AddRange(lacking.Where(role => !missing.Contains(role)).Select(role => new WardrobeNeed(role, style, $"Nothing {label} among the {Noun(role)} yet.")));
        }

        if (bottoms > 0 && tops >= 4 && tops >= 3 * bottoms)
        {
            sentences.Add($"{tops} tops but only {bottoms} {Plural(bottoms, "bottom", "bottoms")}: one more bottom would go with many of the tops.");
            needs.Add(new WardrobeNeed(Category.Bottom, null, $"Only {bottoms} {Plural(bottoms, "bottom", "bottoms")} for {tops} tops."));
        }
        else if (tops > 0 && bottoms >= 3 && bottoms >= 2 * tops)
        {
            sentences.Add($"{bottoms} bottoms but only {tops} {Plural(tops, "top", "tops")}: one more top would go with many of the bottoms.");
            needs.Add(new WardrobeNeed(Category.Top, null, $"Only {tops} {Plural(tops, "top", "tops")} for {bottoms} bottoms."));
        }

        if (shoes == 1 && body >= 6)
        {
            sentences.Add($"Only one pair of shoes for {body} tops, bottoms and one-pieces.");
            needs.Add(new WardrobeNeed(Category.Shoes, null, $"Only one pair of shoes for {body} pieces to wear."));
        }

        var clothes = wardrobe.Where(garment => garment.Role is Category.Top or Category.MidLayer or Category.Bottom or Category.OnePiece).ToList();
        if (clothes.Count >= 3 && clothes.Max(garment => garment.Tags.Formality) < 4)
        {
            sentences.Add("Nothing dressy (formality 4 or 5): a business meeting or a formal evening would be hard to dress for.");
            needs.Add(new WardrobeNeed(Category.MidLayer, null, "Nothing dressy enough for a business meeting or a formal evening."));
        }

        if (clothes.Count >= 5)
        {
            var neutral = clothes.Count(garment => garment.Tags.Colors.Count > 0 && GarmentCatalog.IsNeutral(garment.Tags.Colors[0])) / (double)clothes.Count;
            if (neutral >= 0.9)
            {
                sentences.Add("Almost everything is in neutral colours; a piece or two in a colour would add variety.");
            }
            else if (neutral <= 0.3)
            {
                sentences.Add("Few pieces in neutral colours; neutral basics would make the coloured ones easier to combine.");
            }
        }

        var forgotten = wardrobe.Where(garment => garment.Forgotten).ToList();
        if (forgotten.Count > 0)
        {
            var named = forgotten.Select(garment => aliasOf(garment.Id)).OfType<string>().Take(5).ToList();
            sentences.Add($"{forgotten.Count} {Plural(forgotten.Count, "garment has", "garments have")} not been worn for a long time{(named.Count > 0 ? $": {string.Join(", ", named)}" : "")}.");
        }

        // One need per role: the first reason is the weightiest.
        return new WardrobeFacts(byRole, byGroup, missing, forWeather, coverage, sentences, [.. needs.DistinctBy(need => need.Role)]);
    }

    /// <summary>The role as a plural noun in a sentence ("tops", "mid layers").</summary>
    public static string Noun(Category role) => role switch
    {
        Category.Top => "tops",
        Category.MidLayer => "mid layers",
        Category.Bottom => "bottoms",
        Category.OnePiece => "one-pieces",
        Category.Outerwear => "outerwear",
        Category.Shoes => "shoes",
        _ => "accessories",
    };

    private static string Plural(int count, string one, string many) => count == 1 ? one : many;

    private static string Join(IEnumerable<string> words)
    {
        var list = words.ToList();
        return list.Count <= 1 ? string.Concat(list) : $"{string.Join(", ", list[..^1])} or {list[^1]}";
    }
}

/// <summary>
/// One question to the person's stylist: the conversation so far, the wardrobe and everything about the person and the day
/// the reply may draw on. Nothing about the conversation is kept on the server; the app sends it again every time.
/// <paramref name="Day"/> is the day of the person's calendar the conversation is about, and <paramref name="Weather"/> its
/// weather when it could be told. <paramref name="Palette"/> are the names of the best colours of the person's palette.
/// </summary>
public sealed partial record StylistChatCase(
    IReadOnlyList<ChatMessage> Messages,
    IReadOnlyList<Garment> Wardrobe,
    IReadOnlyList<StyleTag> Styles,
    ThermalPreference Thermal,
    Gender Gender,
    DateOnly Day,
    WeatherProfile? Weather = null,
    Occasion? Occasion = null,
    IReadOnlyList<string>? Palette = null)
{
    public const int MaxMessages = 16;
    public const int MessageMaxLength = 1000;

    /// <summary>The most garments listed in the brief; a bigger wardrobe is represented by a mix from every role.</summary>
    public const int MaxListed = 80;

    public const int MaxMentioned = 6;
    public const int MaxShopping = 3;
    public const int MaxFollowUps = 3;
    public const int TextMaxLength = 2000;
    public const int ShoppingNameMaxLength = 60;
    public const int ShoppingWhyMaxLength = 240;
    public const int FollowUpMaxLength = 120;
    public const int MaxShoppingColors = 3;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private CandidateSet? _listed;
    private WardrobeFacts? _facts;

    /// <summary>
    /// The garments the stylist may name, each under its alias (<c>T3</c>, <c>B2</c>). A wardrobe over <see cref="MaxListed"/>
    /// is cut role by role in proportion to its size, each role mixed the way the candidate filter mixes favourites and forgotten ones.
    /// </summary>
    public CandidateSet Listed => _listed ??= List();

    public WardrobeFacts Facts => _facts ??= WardrobeFacts.Of(Wardrobe, Styles, Weather, Occasion, Listed.AliasOf);

    public string? AliasOf(Guid garmentId) => Listed.AliasOf(garmentId);

    /// <summary>The variable part of the request to the model: one JSON object, the conversation inside it as data.</summary>
    public ChatBrief Brief()
    {
        var facts = Facts;
        BriefWeather? weather = null;
        if (Weather is { } day)
        {
            var rule = day.Rule;
            var requires = new List<string>();
            if (rule.OuterwearMinWarmth is { } warmth)
            {
                requires.Add($"outerwear with warmth >= {warmth}");
            }

            if (rule.NeedsMidLayer)
            {
                requires.Add("mid layer");
            }

            if (rule.NeedsLayer)
            {
                requires.Add("mid layer or outerwear");
            }

            if (rule.ClosedShoes)
            {
                requires.Add("closed shoes");
            }

            if (!rule.Shorts)
            {
                requires.Add("no shorts");
            }

            if (day.Rain)
            {
                requires.Add("rain-proof outerwear if the wardrobe has one");
            }

            weather = new BriefWeather(Whole(day.FeelsMin), Whole(day.FeelsMax), day.Rain, day.NeedsLayers, requires);
        }

        return new ChatBrief(
            Day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Day.DayOfWeek.ToString(),
            new ChatBriefPerson(
                [.. Styles.Distinct().Select(GarmentCatalog.Label)],
                Styles.Count > 0 ? Styles.Distinct().ToDictionary(GarmentCatalog.Label, StyleGuide.Of) : null,
                Thermal switch { ThermalPreference.RunsCold => "usually feels cold", ThermalPreference.RunsWarm => "usually feels warm", _ => "average" },
                Palette is { Count: > 0 } ? Palette : null,
                Gender switch { Gender.Female => "female", Gender.Male => "male", Gender.NonBinary => "non-binary", _ => null }),
            weather,
            Occasion is { } occasion && OccasionRule.For(occasion) is var occasionRule
                ? new ChatBriefOccasion(occasionRule.Label, [occasionRule.FormalityMin, occasionRule.FormalityMax], occasionRule.Prefers is { } style ? GarmentCatalog.Label(style) : null)
                : null,
            new ChatBriefWardrobe(
                Wardrobe.Count,
                Listed.Items.Count,
                facts.ByRole.ToDictionary(entry => GarmentCatalog.Role(entry.Key).ToLowerInvariant(), entry => entry.Value),
                facts.ByGroup.ToDictionary(entry => GarmentCatalog.Label(entry.Key), entry => entry.Value),
                [
                    .. Listed.Items.Select(candidate => new ChatBriefGarment(
                        candidate.Alias,
                        GarmentCatalog.Role(candidate.Garment.Role).ToLowerInvariant(),
                        GarmentCatalog.Label(candidate.Garment.Tags.Subcategory).ToLowerInvariant(),
                        candidate.Garment.Tags.Name,
                        [.. candidate.Garment.Tags.Colors.Select(GarmentCatalog.Label)],
                        GarmentCatalog.Label(candidate.Garment.Tags.Pattern),
                        [.. candidate.Garment.Tags.Styles.Select(GarmentCatalog.Label)],
                        candidate.Garment.Tags.Formality,
                        candidate.Garment.Tags.Warmth,
                        candidate.Garment.Tags.RainOk,
                        candidate.Garment.WearCount,
                        candidate.Garment.Forgotten,
                        candidate.Garment.InLaundry ? true : null)),
                ]),
            facts.Sentences,
            [.. Messages.Select(message => new ChatBriefLine(EnumCodes.ToCode(message.Role), message.Text))]);
    }

    /// <summary>
    /// Turns an answer by aliases into a reply about the person's garments. An outfit that breaks a hard rule (an unknown
    /// alias, a garment in the wrong slot, no body, a one-piece with separates, no shoes, a garment twice) is dropped and the
    /// rest of the answer kept. Unknown aliases are dropped from what the text mentions; every list is cut to its size.
    /// </summary>
    public StylistChatReply Resolve(ChatAnswer answer, AiCost? cost)
    {
        var dropped = new List<string>();
        ChatOutfit? outfit = null;
        if (answer.Outfit is { } proposed)
        {
            // The listed garments carry no weather demands: the weather is the prompt's to honour, here only the rules every outfit must keep are checked.
            var checkedOutfit = OutfitValidator.Check([proposed], Listed)[0];
            if (checkedOutfit.Draft is { } draft)
            {
                outfit = new ChatOutfit(answer.OutfitOccasion ?? Occasion ?? Styling.Occasion.Everyday, draft, Line(proposed.Reasoning, Outfit.ReasoningMaxLength));
            }
            else
            {
                dropped.AddRange(checkedOutfit.Violations.Select(violation => violation.Describe()));
            }
        }

        List<Garment> mentioned =
        [
            .. answer.Mentioned.Select(alias => alias.Trim()).Distinct(StringComparer.Ordinal)
                .Select(alias => Listed.Find(alias)?.Garment).OfType<Garment>().Take(MaxMentioned),
        ];
        List<ShoppingIdea> shopping =
        [
            .. answer.Shopping
                .Select(idea => (Idea: idea, Name: Line(idea.Name, ShoppingNameMaxLength), Why: Line(idea.Why, ShoppingWhyMaxLength)))
                .Where(entry => entry.Name is not null && entry.Why is not null && !HasLink(entry.Name) && !HasLink(entry.Why))
                .Select(entry => new ShoppingIdea(entry.Name!, entry.Idea.Category, entry.Why!, [.. entry.Idea.Colors.Distinct().Take(MaxShoppingColors)]))
                .Take(MaxShopping),
        ];
        List<string> followUps =
        [
            .. answer.FollowUps.Select(question => Line(question, FollowUpMaxLength)).OfType<string>().Distinct(StringComparer.Ordinal).Take(MaxFollowUps),
        ];

        return new StylistChatReply(Paragraphs(answer.Text, TextMaxLength) ?? "", outfit, mentioned, shopping, followUps, cost, dropped);
    }

    /// <summary>
    /// The model's text made fit for a chat bubble: short paragraphs and "- " bullets only. Control characters, links,
    /// headings, bold marks and pictographs go; at most one empty line between paragraphs; cut to <paramref name="maxLength"/>.
    /// </summary>
    public static string? Paragraphs(string? text, int maxLength)
    {
        if (text is null)
        {
            return null;
        }

        var plain = new StringBuilder(text.Length);
        foreach (var rune in text.Replace("\r\n", "\n", StringComparison.Ordinal).EnumerateRunes())
        {
            if (rune.Value == '\n')
            {
                plain.Append('\n');
            }
            else if (Rune.IsControl(rune) || IsPictograph(rune))
            {
                plain.Append(' ');
            }
            else
            {
                plain.Append(rune.ToString());
            }
        }

        var lines = new List<string>();
        foreach (var raw in Link().Replace(plain.ToString(), "").Replace("**", "", StringComparison.Ordinal).Replace("__", "", StringComparison.Ordinal).Split('\n'))
        {
            var line = string.Join(' ', raw.Trim().TrimStart('#').Split(' ', StringSplitOptions.RemoveEmptyEntries));
            if (line.StartsWith("* ", StringComparison.Ordinal) || line.StartsWith("• ", StringComparison.Ordinal))
            {
                line = "- " + line[2..];
            }

            if (line.Length > 0 || (lines.Count > 0 && lines[^1].Length > 0))
            {
                lines.Add(line);
            }
        }

        var clean = string.Join('\n', lines).Trim();
        return clean.Length == 0 ? null : clean.Length > maxLength ? clean[..maxLength].TrimEnd() : clean;
    }

    /// <summary>One line: no control characters, whitespace collapsed, cut to <paramref name="maxLength"/>. Null when nothing is left.</summary>
    public static string? Line(string? text, int maxLength)
    {
        if (text is null)
        {
            return null;
        }

        var clean = string.Join(' ', new string([.. text.Select(character => char.IsControl(character) ? ' ' : character)]).Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return clean.Length == 0 ? null : clean.Length > maxLength ? clean[..maxLength].TrimEnd() : clean;
    }

    private static bool HasLink(string text) => Link().IsMatch(text);

    /// <summary>Emoji and their joiners: the supplementary planes, the miscellaneous symbols and dingbats, the zero-width joiner and the emoji variation selector. A degree sign stays.</summary>
    private static bool IsPictograph(Rune rune) => rune.Value > 0xFFFF || rune.Value is (>= 0x2600 and <= 0x27BF) or 0x200D or 0xFE0F;

    [GeneratedRegex(@"(https?://|www\.)\S+", RegexOptions.IgnoreCase)]
    private static partial Regex Link();

    private static int Whole(double degrees) => (int)Math.Round(degrees, MidpointRounding.AwayFromZero);

    private CandidateSet List()
    {
        var items = new List<Candidate>();
        var room = Allowance();
        foreach (var role in Enum.GetValues<Category>())
        {
            var garments = Wardrobe.Where(garment => garment.Role == role).ToList();
            var listed = garments.Count <= room[role] ? garments : CandidateFilter.Mix(garments, null, Styles, room[role]);
            items.AddRange(listed.Select((garment, index) => new Candidate($"{CandidateFilter.AliasPrefix(role)}{index + 1}", garment)));
        }

        return new CandidateSet(items, WeatherDemands.None, [], [], [], false, null);
    }

    /// <summary>How many garments of each role are listed: all of them while the wardrobe fits, otherwise shares of <see cref="MaxListed"/> in proportion, at least one per role that has any.</summary>
    private Dictionary<Category, int> Allowance()
    {
        var counts = Enum.GetValues<Category>().ToDictionary(role => role, role => Wardrobe.Count(garment => garment.Role == role));
        if (Wardrobe.Count <= MaxListed)
        {
            return counts;
        }

        var shares = counts.ToDictionary(entry => entry.Key, entry => entry.Value * (double)MaxListed / Wardrobe.Count);
        var room = shares.ToDictionary(entry => entry.Key, entry => counts[entry.Key] > 0 ? Math.Max(1, (int)Math.Floor(entry.Value)) : 0);
        // What rounding left over goes to the roles with the largest remainders; what the minimum of one overspent comes off the largest.
        foreach (var role in shares.OrderByDescending(entry => entry.Value - Math.Floor(entry.Value)).Select(entry => entry.Key))
        {
            if (room.Values.Sum() >= MaxListed)
            {
                break;
            }

            if (room[role] < counts[role])
            {
                room[role]++;
            }
        }

        while (room.Values.Sum() > MaxListed)
        {
            room[room.MaxBy(entry => entry.Value).Key]--;
        }

        return room;
    }
}

/// <summary>The brief of the stylist chat. Member names are its snake case keys; the words are English, as the facts are.</summary>
public sealed record ChatBrief(
    string Date,
    string Weekday,
    ChatBriefPerson Person,
    BriefWeather? Weather,
    ChatBriefOccasion? Occasion,
    ChatBriefWardrobe Wardrobe,
    IReadOnlyList<string> Facts,
    IReadOnlyList<ChatBriefLine> Conversation)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // The text goes into a prompt, not into HTML: letters outside ASCII stay as they are, which also costs fewer tokens.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public string ToJson() => JsonSerializer.Serialize(this, Json);
}

/// <summary><paramref name="Styles"/> are the labels of the styles the person likes, strongest first; <paramref name="StyleNotes"/> what each looks like (<see cref="StyleGuide"/>).</summary>
public sealed record ChatBriefPerson(
    IReadOnlyList<string> Styles,
    IReadOnlyDictionary<string, string>? StyleNotes,
    string Thermal,
    IReadOnlyList<string>? Palette,
    string? Gender);

public sealed record ChatBriefOccasion(string Name, IReadOnlyList<int> Formality, string? PreferredStyle);

/// <summary><paramref name="Total"/> counts every ready garment; <paramref name="Listed"/> how many of them are in <paramref name="Garments"/>.</summary>
public sealed record ChatBriefWardrobe(
    int Total,
    int Listed,
    IReadOnlyDictionary<string, int> ByRole,
    IReadOnlyDictionary<string, int> ByGroup,
    IReadOnlyList<ChatBriefGarment> Garments);

public sealed record ChatBriefGarment(
    string Id,
    string Role,
    string Type,
    string Name,
    IReadOnlyList<string> Colors,
    string Pattern,
    IReadOnlyList<string> Styles,
    int Formality,
    int Warmth,
    bool RainOk,
    int Worn,
    bool Forgotten,
    bool? InLaundry);

public sealed record ChatBriefLine(string Role, string Text);

/// <summary>The person's own stylist in a conversation: outfits from their clothes, gaps in the wardrobe, what to buy and why.</summary>
public interface IStylistChat
{
    /// <exception cref="ProviderException">The provider failed, refused or answered with something that is not the agreed JSON.</exception>
    /// <exception cref="OperationCanceledException">The provider did not answer in time.</exception>
    Task<StylistChatReply> ReplyAsync(StylistChatCase chat, CancellationToken cancellationToken);
}
