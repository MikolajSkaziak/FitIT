using System.Text.Json.Nodes;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Usage;
using static FitIt.Infrastructure.Gemini.GeminiJson;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// The seasonal colour type read from a selfie by Gemini. The model only names one of the twelve types; the palette comes from
/// the app's own table. The questionnaire never leaves the server. Every way this can fail (budget spent, a refusal, no usable
/// face, an unknown type) is a <see cref="ProviderException"/>: the person is then offered the three questions instead.
/// </summary>
public sealed class GeminiColorAnalyst(GeminiClient gemini, IImageStorage storage, IAiBudget budget) : IColorAnalyst
{
    private static readonly JsonObject Schema = GeminiJson.Object(("usable", Flag()), ("season", OneOf(EnumCodes.All<ColorSeason>())));

    public async Task<ColorAnalysisOutcome> AnalyzeAsync(ColorAnalysisRequest request, CancellationToken cancellationToken)
    {
        if (request.Quiz is { } quiz)
        {
            var fromAnswers = ColorSeasons.Of(ColorSeasons.FromQuiz(quiz));
            return new ColorAnalysisOutcome(fromAnswers.Season, fromAnswers.Best, fromAnswers.Soften, AiCost.None("rules"));
        }

        if (request.Photo is not { } photo)
        {
            throw new ProviderException("The request has neither a photo nor answers.");
        }

        if (!await budget.HasBudgetAsync(cancellationToken))
        {
            throw new ProviderException("Today's AI budget is used up; the photo was not sent.");
        }

        var picture = await storage.ReadAsync(photo.Key, null, cancellationToken);
        var reply = await gemini.AskAsync(GeminiPrompts.ColorAnalyst, [GeminiPart.Of(picture), GeminiPart.Of("Name the seasonal colour type of the person in this photo.")], Schema, cancellationToken);
        if (reply.Blocked)
        {
            throw new ProviderException("The colour analyst's safety filter refused the photo.") { Cost = reply.Cost };
        }

        if (Bool(reply.Json, "usable") != true)
        {
            throw new ProviderException("The photo does not show one face clearly enough.") { Cost = reply.Cost };
        }

        if (!EnumCodes.TryParse<ColorSeason>(Str(reply.Json, "season"), out var season))
        {
            throw new ProviderException("The colour analyst named a type that does not exist.") { Cost = reply.Cost };
        }

        var info = ColorSeasons.Of(season);
        return new ColorAnalysisOutcome(season, info.Best, info.Soften, reply.Cost);
    }
}
