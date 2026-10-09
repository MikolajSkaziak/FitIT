using System.Security.Claims;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace FitIt.Api.Common;

internal static class ApiResults
{
    /// <summary>Every error leaves the API as ProblemDetails with a stable machine <c>code</c> the app maps to its own text.</summary>
    public static IResult ToProblem(this ApiError error)
    {
        var extensions = new Dictionary<string, object?>(StringComparer.Ordinal) { ["code"] = error.Code };
        if (error.Extensions is not null)
        {
            foreach (var (key, value) in error.Extensions)
            {
                extensions[key] = value;
            }
        }

        return Results.Problem(statusCode: error.Status, title: error.Title, detail: error.Detail, extensions: extensions);
    }

    public static Guid UserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id)
            ? id
            : throw new InvalidOperationException("The request has no user. Is the endpoint missing RequireAuthorization?");
}

/// <summary>Builds absolute links to the API's static files (silhouette pictures).</summary>
public sealed class LinkBuilder(IOptions<AppOptions> options, IHttpContextAccessor accessor)
{
    public string Absolute(string path)
    {
        if (options.Value.PublicBaseUrl is { Length: > 0 } configured)
        {
            return configured.TrimEnd('/') + path;
        }

        var request = accessor.HttpContext?.Request ?? throw new InvalidOperationException("No current request to build a link from.");
        return $"{request.Scheme}://{request.Host}{request.PathBase}{path}";
    }
}

internal sealed class ResponseMapper(LinkBuilder links)
{
    public AvatarResponse Map(Avatar avatar) =>
        new(avatar.Id, avatar.Gender, avatar.BodyType, avatar.Label, links.Absolute(avatar.ImagePath), links.Absolute(avatar.ThumbPath), links.Absolute(avatar.FigurePath));

    public UserResponse Map(AppUser user) => new(
        user.Id,
        user.Email!,
        user.DisplayName,
        user.BirthDate,
        user.Gender,
        Map(user.Avatar ?? throw new InvalidOperationException("The user was loaded without its silhouette.")),
        [.. user.StylePreferences.Select(EnumCodes.Parse<StyleTag>)],
        user.ThermalPreference,
        user.ClothingSize,
        user.LegLength,
        user.Place is { } place ? new LocationResponse(place.Source, place.Name, place.Lat, place.Lon) : null,
        user.AiConsentAt,
        user.ColorAnalysis is { } colors ? Map(colors) : null,
        user.OnboardingStep,
        user.OnboardingDoneAt,
        user.CreatedAt);

    public static ColorAnalysisResponse Map(ColorProfile colors)
    {
        var info = ColorSeasons.Of(colors.Season);
        return new ColorAnalysisResponse(colors.Season, info.Name, info.Summary, colors.Source, [.. colors.Best.Select(Map)], [.. colors.Soften.Select(Map)], colors.AnalyzedAt);
    }

    private static ColorSwatchResponse Map(ColorSwatch swatch) => new(swatch.Name, swatch.Hex, swatch.Wardrobe);
}
