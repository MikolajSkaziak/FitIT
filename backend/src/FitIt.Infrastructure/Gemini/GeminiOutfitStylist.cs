using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Styling;
using static FitIt.Infrastructure.Gemini.GeminiJson;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// Step three of the stylist (product spec 6.1) asked of Gemini: the repository's instructions as the system text, the brief
/// as data. Nothing it answers is trusted here: aliases go to the validator as they came, and the pipeline falls back to the
/// rules when the answer is invalid, refused or late.
/// </summary>
public sealed class GeminiOutfitStylist(GeminiClient gemini) : IOutfitStylist
{
    private static readonly JsonObject Schema = GeminiJson.Object(("outfits", List(GeminiJson.Object(
        ("kind", OneOf(EnumCodes.All<OutfitKind>())),
        ("top", Text(nullable: true)),
        ("mid", Text(nullable: true)),
        ("bottom", Text(nullable: true)),
        ("one_piece", Text(nullable: true)),
        ("outerwear", Text(nullable: true)),
        ("shoes", Text(nullable: true)),
        ("accessories", List(Text())),
        ("reasoning", Text()),
        ("weather_note", Text(nullable: true))))));

    public string PromptVersion => StylistPrompt.Version;

    public async Task<StylistAnswer> SuggestAsync(StylistRequest request, CancellationToken cancellationToken)
    {
        // The brief is one JSON object: the person's note sits inside it as a value, which the instructions call data, not an instruction.
        var text = new StringBuilder(request.Case.Brief().ToJson());
        if (request.Errors.Count > 0)
        {
            text.Append("\n\nYour previous answer was rejected:");
            foreach (var error in request.Errors)
            {
                text.Append("\n- ").Append(error);
            }
        }

        var reply = await gemini.AskAsync(StylistPrompt.System, [GeminiPart.Of(text.ToString())], Schema, cancellationToken);
        return reply.Blocked ? StylistAnswer.Refusal(reply.Cost) : new StylistAnswer(Parse(reply.Json), false, reply.Cost);
    }

    internal static IReadOnlyList<StylistOutfit> Parse(JsonElement json) =>
    [
        .. Items(json, "outfits").Where(outfit => outfit.ValueKind == JsonValueKind.Object).Select(outfit => new StylistOutfit(
            EnumCodes.TryParse<OutfitKind>(Str(outfit, "kind"), out var kind) ? kind : null,
            Alias(outfit, "top"),
            Alias(outfit, "mid"),
            Alias(outfit, "bottom"),
            Alias(outfit, "one_piece"),
            Alias(outfit, "outerwear"),
            Alias(outfit, "shoes"),
            [.. Items(outfit, "accessories").Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!.Trim()).Where(alias => alias.Length > 0)],
            Line(Str(outfit, "reasoning"), Outfit.ReasoningMaxLength) ?? "",
            Line(Str(outfit, "weather_note"), Outfit.WeatherNoteMaxLength))),
    ];

    /// <summary>An empty slot is null however the model spelled "nothing".</summary>
    private static string? Alias(JsonElement outfit, string slot) =>
        Str(outfit, slot)?.Trim() is { Length: > 0 } alias && !alias.Equals("null", StringComparison.OrdinalIgnoreCase) ? alias : null;
}
