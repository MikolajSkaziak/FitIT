using System.Text.Encodings.Web;
using System.Text.Json;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Usage;
using Microsoft.Extensions.Logging;
using static FitIt.Infrastructure.Gemini.GeminiJson;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// Tips on an outfit the person built, worded by Gemini on top of the app's own rules. The rules stay in charge of what is
/// wrong and of the score (<see cref="RuleBasedCritique"/>); the model words the findings, says what works and may add tips
/// about style. A tip whose code is not one of the rules' findings or <see cref="StyleTip"/> is dropped. When the day's budget
/// is spent, or the model fails, refuses or says nothing usable, the person gets the rules' own sentences instead of an error.
/// </summary>
public sealed class GeminiOutfitCritic(GeminiClient gemini, IAiBudget budget, ILogger<GeminiOutfitCritic> logger) : IOutfitCritic
{
    public const string StyleTip = "style_tip";

    public const int SentenceMaxLength = 240;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public async Task<Critique> CritiqueAsync(CritiqueRequest request, CancellationToken cancellationToken)
    {
        var rules = RuleBasedCritique.Of(request, AiCost.None("rules"));
        if (!await budget.HasBudgetAsync(cancellationToken))
        {
            logger.LogWarning("Today's AI budget is used up; tips come from the rules");
            return rules;
        }

        var allowed = rules.Improvements.Select(improvement => improvement.Code).Append(StyleTip).Distinct().ToList();
        var schema = GeminiJson.Object(
            ("positives", List(Text())),
            ("improvements", List(GeminiJson.Object(("code", OneOf(allowed)), ("text", Text())))));

        GeminiReply reply;
        try
        {
            reply = await gemini.AskAsync(GeminiPrompts.Critic, [GeminiPart.Of(Brief(request, rules))], schema, cancellationToken);
        }
        catch (ProviderException exception)
        {
            logger.LogWarning(exception, "The critic did not answer; tips come from the rules");
            return rules with { Cost = exception.Cost ?? rules.Cost };
        }

        if (reply.Blocked)
        {
            logger.LogWarning("The critic refused to answer; tips come from the rules");
            return rules with { Cost = reply.Cost };
        }

        var positives = Items(reply.Json, "positives")
            .Select(item => item.ValueKind == JsonValueKind.String ? Line(item.GetString(), SentenceMaxLength) : null)
            .OfType<string>().Take(RuleBasedCritique.MaxPositives).ToList();
        var improvements = Items(reply.Json, "improvements")
            .Select(item => (Code: Str(item, "code"), Text: Line(Str(item, "text"), SentenceMaxLength)))
            .Where(item => item.Code is not null && item.Text is not null && allowed.Contains(item.Code))
            .Select(item => new Improvement(item.Code!, item.Text!))
            .Take(RuleBasedCritique.MaxImprovements).ToList();
        if (positives.Count == 0 && improvements.Count == 0)
        {
            logger.LogWarning("The critic's answer held nothing usable; tips come from the rules");
            return rules with { Cost = reply.Cost };
        }

        return new Critique(positives, improvements, rules.Score, reply.Cost);
    }

    /// <summary>The outfit as data. The place's name is left out: the model needs the weather, not where the person is.</summary>
    private static string Brief(CritiqueRequest request, Critique rules) => JsonSerializer.Serialize(
        new
        {
            Garments = request.Garments.Select(garment => new
            {
                Role = GarmentCatalog.Role(garment.Role).ToLowerInvariant(),
                Type = GarmentCatalog.Label(garment.Tags.Subcategory).ToLowerInvariant(),
                garment.Tags.Name,
                Colors = garment.Tags.Colors.Select(GarmentCatalog.Label),
                Pattern = GarmentCatalog.Label(garment.Tags.Pattern),
                Material = GarmentCatalog.Label(garment.Tags.Material),
                garment.Tags.Formality,
                garment.Tags.Warmth,
                garment.Tags.RainOk,
                Desc = garment.Description,
            }),
            Occasion = request.Occasion is { } occasion && OccasionRule.For(occasion) is var rule
                ? new { Name = rule.Label, Formality = new[] { rule.FormalityMin, rule.FormalityMax } }
                : null,
            Weather = request.Weather is { } weather
                ? new { FeelsMin = (int)Math.Round(weather.Profile.FeelsMin), FeelsMax = (int)Math.Round(weather.Profile.FeelsMax), weather.Profile.Rain }
                : null,
            Findings = rules.Improvements.Select(improvement => new { improvement.Code, improvement.Text }),
            rules.Score,
        },
        Json);
}
