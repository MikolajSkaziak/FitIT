using System.Text.Json;
using System.Text.Json.Nodes;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;
using static FitIt.Infrastructure.Gemini.GeminiJson;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// The person's stylist in the chat, asked of Gemini: the repository's instructions as the system text, the brief with the
/// conversation inside it as data. The model answers by aliases; the case maps them back to the person's garments and drops
/// an outfit that breaks a hard rule. A refusal, an empty text or anything that is not the agreed JSON is a provider
/// failure, after which the rules answer instead.
/// </summary>
public sealed class GeminiStylistChat(GeminiClient gemini, IOptions<GeminiOptions> options) : IStylistChat
{
    /// <summary>The answer's shape: the outfit is an object or null, every list may be empty.</summary>
    internal static JsonObject Schema()
    {
        var outfit = GeminiJson.Object(
            ("occasion", OneOf(EnumCodes.All<Occasion>())),
            ("top", Text(nullable: true)),
            ("mid", Text(nullable: true)),
            ("bottom", Text(nullable: true)),
            ("one_piece", Text(nullable: true)),
            ("outerwear", Text(nullable: true)),
            ("shoes", Text(nullable: true)),
            ("accessories", List(Text())),
            ("note", Text(nullable: true)));
        outfit["nullable"] = true;
        return GeminiJson.Object(
            ("text", Text()),
            ("outfit", outfit),
            ("mentioned", List(Text())),
            ("shopping", List(GeminiJson.Object(
                ("name", Text()),
                ("category", OneOf(EnumCodes.All<Category>())),
                ("why", Text()),
                ("colors", List(OneOf(EnumCodes.All<Color>())))))),
            ("follow_ups", List(Text())));
    }

    public async Task<StylistChatReply> ReplyAsync(StylistChatCase chat, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var generation = new GeminiGeneration(settings.ChatThinkingLevel, settings.ChatMaxOutputTokens);
        var reply = await gemini.AskAsync(GeminiPrompts.Chat, [GeminiPart.Of(chat.Brief().ToJson())], Schema(), generation, cancellationToken);
        if (reply.Blocked)
        {
            throw new ProviderException("Gemini refused to answer the stylist chat.") { Cost = reply.Cost };
        }

        var answer = Parse(reply.Json);
        var resolved = chat.Resolve(answer, reply.Cost);
        return resolved.Text.Length == 0
            ? throw new ProviderException("Gemini's stylist reply has no text.") { Cost = reply.Cost }
            : resolved;
    }

    internal static ChatAnswer Parse(JsonElement json)
    {
        StylistOutfit? outfit = null;
        Occasion? occasion = null;
        if (json.ValueKind == JsonValueKind.Object && json.TryGetProperty("outfit", out var proposed) && proposed.ValueKind == JsonValueKind.Object)
        {
            outfit = new StylistOutfit(
                null,
                Alias(proposed, "top"),
                Alias(proposed, "mid"),
                Alias(proposed, "bottom"),
                Alias(proposed, "one_piece"),
                Alias(proposed, "outerwear"),
                Alias(proposed, "shoes"),
                [.. Strings(proposed, "accessories")],
                Str(proposed, "note") ?? "",
                null);
            occasion = EnumCodes.TryParse<Occasion>(Str(proposed, "occasion"), out var named) ? named : null;
        }

        var shopping = new List<ShoppingIdea>();
        foreach (var idea in Items(json, "shopping").Where(item => item.ValueKind == JsonValueKind.Object))
        {
            if (EnumCodes.TryParse<Category>(Str(idea, "category"), out var category))
            {
                shopping.Add(new ShoppingIdea(
                    Str(idea, "name") ?? "",
                    category,
                    Str(idea, "why") ?? "",
                    [.. Strings(idea, "colors").Select(code => EnumCodes.TryParse<Color>(code, out var color) ? color : (Color?)null).OfType<Color>()]));
            }
        }

        return new ChatAnswer(Str(json, "text") ?? "", outfit, occasion, [.. Strings(json, "mentioned")], shopping, [.. Strings(json, "follow_ups")]);
    }

    private static IEnumerable<string> Strings(JsonElement parent, string name) =>
        Items(parent, name).Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!.Trim()).Where(text => text.Length > 0);

    /// <summary>An empty slot is null however the model spelled "nothing".</summary>
    private static string? Alias(JsonElement outfit, string slot) =>
        Str(outfit, slot)?.Trim() is { Length: > 0 } alias && !alias.Equals("null", StringComparison.OrdinalIgnoreCase) ? alias : null;
}
