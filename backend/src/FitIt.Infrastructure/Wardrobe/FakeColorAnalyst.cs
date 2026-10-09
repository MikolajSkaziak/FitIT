using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>
/// Stands in for the colour analysis model until there is a provider key. It cannot see the photo: it maps a hash of the photo's
/// bytes onto one of the twelve types, so the same photo always gets the same type. The questions go through a fixed table.
/// </summary>
public sealed class FakeColorAnalyst(IImageStorage storage) : IColorAnalyst
{
    public const string Model = "fake-color-analyst";

    public async Task<ColorAnalysisOutcome> AnalyzeAsync(ColorAnalysisRequest request, CancellationToken cancellationToken)
    {
        ColorSeason season;
        if (request.Quiz is { } quiz)
        {
            season = ColorSeasons.FromQuiz(quiz);
        }
        else if (request.Photo is { } photo)
        {
            var bytes = await storage.ReadAsync(photo.Key, null, cancellationToken);
            season = (ColorSeason)(Fnv1A(bytes) % (uint)ColorSeasons.All.Count);
        }
        else
        {
            throw new ProviderException("The request has neither a photo nor answers.");
        }

        var info = ColorSeasons.Of(season);
        return new ColorAnalysisOutcome(season, info.Best, info.Soften, AiCost.None(Model));
    }

    /// <summary>A hash that is the same in every process, so a retried request lands on the same type.</summary>
    private static uint Fnv1A(byte[] bytes)
    {
        var hash = 2166136261u;
        foreach (var value in bytes)
        {
            hash = (hash ^ value) * 16777619u;
        }

        return hash;
    }
}
