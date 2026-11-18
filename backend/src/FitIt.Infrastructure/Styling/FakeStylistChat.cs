using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Infrastructure.Styling;

/// <summary>
/// The stylist chat from the rules alone, in English: what the provider switch picks as the fake, and what answers when
/// the day's AI budget is spent or the model fails. A few keywords (English and Polish) tell an outfit request from a
/// question about gaps or purchases. Outfits come from the rule-based stylist, gaps and purchases from the computed facts.
/// The same question about the same wardrobe always gets the same answer.
/// </summary>
public sealed class FakeStylistChat : IStylistChat
{
    public enum Intent
    {
        Outfit,
        Gaps,
        Shopping,
        Other,
    }

    private static readonly string[] ShoppingWords = ["buy", "shop", "purchase", "invest", "kupi", "kupować", "zakup", "dokup", "sklep"];
    private static readonly string[] OutfitWords = ["wear", "outfit", "put together", "dress me", "what to put on", "look for", "założ", "zaloz", "ubra", "strój", "stroj", "zestaw", "stylizac", "włoż", "wloz"];
    private static readonly string[] GapWords = ["gap", "missing", "lack", "need", "short of", "brak", "luk", "potrzeb"];

    private static readonly (Occasion Occasion, string[] Words)[] OccasionWords =
    [
        (Occasion.Workout, ["gym", "workout", "training", "siłown", "silown", "trening"]),
        (Occasion.Business, ["business", "meeting", "interview", "biznes", "spotkan", "rozmow"]),
        (Occasion.Date, ["date", "dinner", "evening out", "randk", "kolacj", "wieczór", "wieczor"]),
        (Occasion.Work, ["work", "office", "school", "prac", "biur", "szkoł", "szkol", "uczelni"]),
        (Occasion.Friends, ["friends", "party", "znajom", "imprez"]),
    ];

    /// <summary>A day that asks nothing of an outfit, for when the weather could not be told.</summary>
    private static readonly WeatherProfile NoWeather = new(
        DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch.AddHours(12), false, 20, 20, DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch, 0, 0, null, 20,
        TemperatureBand.Warm, false, false, Sky.CloudSun);

    public Task<StylistChatReply> ReplyAsync(StylistChatCase chat, CancellationToken cancellationToken) => Task.FromResult(Reply(chat));

    public static StylistChatReply Reply(StylistChatCase chat)
    {
        var question = chat.Messages.LastOrDefault(message => message.Role == ChatRole.Person)?.Text ?? "";
        if (chat.Wardrobe.Count == 0)
        {
            return chat.Resolve(Empty(chat), null);
        }

        var answer = Detect(question) switch
        {
            Intent.Outfit => Outfit(chat, chat.Occasion ?? OccasionOf(question) ?? Occasion.Everyday),
            Intent.Gaps => Gaps(chat),
            Intent.Shopping => Shopping(chat),
            _ => Other(),
        };
        return chat.Resolve(answer, null);
    }

    public static Intent Detect(string question)
    {
        var text = question.ToLowerInvariant();
        bool Any(string[] words) => words.Any(word => text.Contains(word, StringComparison.Ordinal));
        return Any(ShoppingWords) ? Intent.Shopping : Any(OutfitWords) ? Intent.Outfit : Any(GapWords) ? Intent.Gaps : Intent.Other;
    }

    public static Occasion? OccasionOf(string question)
    {
        var text = question.ToLowerInvariant();
        foreach (var (occasion, words) in OccasionWords)
        {
            if (words.Any(word => text.Contains(word, StringComparison.Ordinal)))
            {
                return occasion;
            }
        }

        return null;
    }

    private static ChatAnswer Outfit(StylistChatCase chat, Occasion occasion)
    {
        var label = OccasionRule.For(occasion).Label.ToLowerInvariant();
        var weather = chat.Weather ?? NoWeather;
        var candidates = CandidateFilter.Select([.. chat.Listed.Items.Select(candidate => candidate.Garment)], weather, occasion, styles: chat.Styles);
        if (!candidates.IsComplete)
        {
            List<Category> lacking = [.. candidates.Missing, .. candidates.MissingEither.Take(1)];
            return new ChatAnswer(
                $"Your wardrobe cannot make a complete outfit for {label} yet: it has no {string.Join(" or ", lacking.Select(WardrobeFacts.Noun))} that fit the day.",
                null,
                null,
                [],
                [.. lacking.Select(role => Idea(chat, role, null, $"Completes an outfit for {label} with what you already own."))],
                ["What else is missing from my wardrobe?", "What should I buy first?"]);
        }

        // Guid hashes do not change from process to process, unlike those of strings.
        var seed = candidates.Items.Aggregate(17, (hash, candidate) => unchecked((hash * 31) + candidate.Garment.Id.GetHashCode()));
        var best = RuleBasedStylist.Compose(candidates, weather, new HashSet<(Guid, Guid)>(), new Random(seed), chat.Styles)[0];
        string? Alias(Garment? garment) => garment is null ? null : chat.AliasOf(garment.Id);
        var draft = best.Outfit;
        var outfit = new StylistOutfit(
            null, Alias(draft.Top), Alias(draft.MidLayer), Alias(draft.Bottom), Alias(draft.OnePiece), Alias(draft.Outerwear), Alias(draft.Shoes),
            [.. draft.Accessories.Select(garment => Alias(garment)!)], best.Reasoning, best.WeatherNote);
        var names = draft.Items.Select(garment => garment.Tags.Name.ToLowerInvariant()).ToList();
        return new ChatAnswer(
            $"Here is an outfit for {label} from your own clothes: {string.Join(", ", names[..^1])} and {names[^1]}." + (best.WeatherNote is { } note ? $"\n\n{note}" : ""),
            outfit,
            occasion,
            [.. draft.Items.Select(garment => Alias(garment)).OfType<string>()],
            [],
            ["What shoes would work with it?", "What could I add to it?", "What is missing from my wardrobe?"]);
    }

    private static ChatAnswer Gaps(StylistChatCase chat)
    {
        var facts = chat.Facts;
        var text = facts.Sentences.Count == 0
            ? "Your wardrobe covers the basics well: there is something for every role."
            : "Here is what stands out in your wardrobe:\n" + string.Join('\n', facts.Sentences.Take(4).Select(sentence => $"- {sentence}"));
        return new ChatAnswer(text, null, null, [], Ideas(chat), ["What should I buy first?", "What should I wear today?"]);
    }

    private static ChatAnswer Shopping(StylistChatCase chat)
    {
        var ideas = Ideas(chat);
        if (ideas.Count == 0)
        {
            // Nothing is missing: the role with the fewest pieces is where one more piece makes the most new outfits.
            var fewest = WardrobeFacts.Essential.MinBy(role => chat.Facts.ByRole[role]);
            ideas = [Idea(chat, fewest, chat.Styles.Count > 0 ? chat.Styles[0] : null, $"You have the fewest {WardrobeFacts.Noun(fewest)}: one more makes the most new outfits.")];
        }

        return new ChatAnswer(
            "These pieces would add the most to what you already own:\n" + string.Join('\n', ideas.Select(idea => $"- {idea.Name}: {idea.Why}")),
            null,
            null,
            [],
            ideas,
            ["What would I wear it with?", "What is missing from my wardrobe?"]);
    }

    private static ChatAnswer Other() => new(
        "I can put together an outfit from your clothes, point out what your wardrobe is missing and suggest what to buy next. What would you like?",
        null,
        null,
        [],
        [],
        ["What should I wear today?", "What is missing from my wardrobe?", "What should I buy next?"]);

    private static ChatAnswer Empty(StylistChatCase chat)
    {
        StyleTag? style = chat.Styles.Count > 0 ? chat.Styles[0] : null;
        List<ShoppingIdea> starters =
        [
            Idea(chat, Category.Top, style, "A first top that goes with almost anything."),
            Idea(chat, Category.Bottom, style, "Pairs with the top for a first outfit."),
            Idea(chat, Category.Shoes, style, "Finishes the outfit."),
        ];
        return new ChatAnswer(
            "Your wardrobe is empty, so there is nothing to style yet. Add the clothes you own by taking a photo of each, or add a few basics to start with.",
            null,
            null,
            [],
            starters,
            ["What basics should I start with?", "Which colours are easiest to combine?"]);
    }

    /// <summary>Up to three pieces for the most important needs of the wardrobe, each in the style the need is about or the person's first style.</summary>
    private static List<ShoppingIdea> Ideas(StylistChatCase chat)
    {
        var facts = chat.Facts;
        StyleTag? first = chat.Styles.Count > 0 ? chat.Styles[0] : null;
        return
        [
            .. facts.Needs.Where(need => need.Role is not (Category.OnePiece or Category.Accessory)).Take(StylistChatCase.MaxShopping)
                .Select(need => Idea(chat, need.Role, need.Style ?? first, Unlocks(facts, need))),
        ];
    }

    /// <summary>What the piece does with what the person already owns.</summary>
    private static string Unlocks(WardrobeFacts facts, WardrobeNeed need)
    {
        var (tops, bottoms) = (facts.ByRole[Category.Top], facts.ByRole[Category.Bottom]);
        var with = need.Role switch
        {
            Category.Top => bottoms > 0 ? $" Goes with your {bottoms} {(bottoms == 1 ? "bottom" : "bottoms")}." : "",
            Category.Bottom => tops > 0 ? $" Goes with your {tops} {(tops == 1 ? "top" : "tops")}." : "",
            Category.Shoes or Category.Outerwear or Category.MidLayer => tops + bottoms > 0 ? $" Works with the {tops} tops and {bottoms} bottoms you have." : "",
            _ => "",
        };
        return need.Reason + with;
    }

    private static ShoppingIdea Idea(StylistChatCase chat, Category role, StyleTag? style, string why)
    {
        var (name, colors) = Piece(role, style ?? (chat.Styles.Count > 0 ? chat.Styles[0] : null));
        return new ShoppingIdea(name, role, why, colors);
    }

    /// <summary>A generic piece of the role in the spirit of the style's family; casual and minimalist pieces for everybody else.</summary>
    private static (string Name, Color[] Colors) Piece(Category role, StyleTag? style)
    {
        var family = style switch
        {
            StyleTag.Smart or StyleTag.Elegant or StyleTag.OldMoney or StyleTag.Preppy or StyleTag.Business => 1,
            StyleTag.Streetwear or StyleTag.Y2k or StyleTag.Grunge or StyleTag.Edgy => 2,
            StyleTag.Sporty or StyleTag.Gorpcore => 3,
            StyleTag.Boho or StyleTag.Romantic or StyleTag.Vintage => 4,
            _ => 0,
        };
        return (role, family) switch
        {
            (Category.Top, 1) => ("White oxford shirt", [Color.White]),
            (Category.Top, 2) => ("Black graphic T-shirt", [Color.Black]),
            (Category.Top, 3) => ("Grey technical training top", [Color.Grey]),
            (Category.Top, 4) => ("Cream embroidered blouse", [Color.Cream]),
            (Category.Top, _) => ("White cotton T-shirt", [Color.White]),
            (Category.MidLayer, 1) => ("Navy unstructured blazer", [Color.Navy]),
            (Category.MidLayer, 2) => ("Black oversized hoodie", [Color.Black]),
            (Category.MidLayer, 3) => ("Navy fleece mid layer", [Color.Navy]),
            (Category.MidLayer, 4) => ("Beige knit cardigan", [Color.Beige]),
            (Category.MidLayer, _) => ("Grey crew-neck sweater", [Color.Grey]),
            (Category.Bottom, 1) => ("Beige tailored chinos", [Color.Beige]),
            (Category.Bottom, 2) => ("Black cargo pants", [Color.Black]),
            (Category.Bottom, 3) => ("Black track pants", [Color.Black]),
            (Category.Bottom, 4) => ("Cream wide-leg linen trousers", [Color.Cream]),
            (Category.Bottom, _) => ("Dark blue straight jeans", [Color.Navy]),
            (Category.Outerwear, 1) => ("Camel wool coat", [Color.Beige]),
            (Category.Outerwear, 2) => ("Black bomber jacket", [Color.Black]),
            (Category.Outerwear, 3) => ("Olive waterproof shell jacket", [Color.Olive]),
            (Category.Outerwear, 4) => ("Brown suede jacket", [Color.Brown]),
            (Category.Outerwear, _) => ("Navy rain-proof jacket", [Color.Navy]),
            (Category.Shoes, 1) => ("Brown leather loafers", [Color.Brown]),
            (Category.Shoes, 2) => ("Black chunky sneakers", [Color.Black]),
            (Category.Shoes, 3) => ("Grey trail running shoes", [Color.Grey]),
            (Category.Shoes, 4) => ("Brown leather ankle boots", [Color.Brown]),
            (Category.Shoes, _) => ("White leather sneakers", [Color.White]),
            (Category.OnePiece, _) => ("Navy jersey jumpsuit", [Color.Navy]),
            _ => ("Brown leather belt", [Color.Brown]),
        };
    }
}
