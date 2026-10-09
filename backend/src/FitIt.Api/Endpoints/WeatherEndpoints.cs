using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Infrastructure.Weather;

namespace FitIt.Api.Endpoints;

internal static class WeatherEndpoints
{
    public static IEndpointRouteBuilder MapWeatherEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/weather/today", Today)
            .WithTags("Weather").WithName("getWeatherToday").RequireAuthorization()
            .Produces<WeatherResponse>().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);

        return app;
    }

    private static async Task<IResult> Today(HttpContext http, WeatherService weather, CancellationToken cancellationToken)
    {
        var today = await weather.TodayAsync(http.User.UserId(), cancellationToken);
        return today.IsOk ? TypedResults.Ok(Shape(today.Value)) : today.Error!.ToProblem();
    }

    internal static WeatherResponse Shape(PersonalWeather weather)
    {
        var profile = weather.Profile;
        return new WeatherResponse(
            weather.Place.Name,
            profile.ForTomorrow,
            profile.From,
            profile.To,
            Whole(profile.FeelsMin),
            Whole(profile.FeelsMax),
            profile.ColdestAt,
            profile.WarmestAt,
            profile.Sky,
            profile.Rain,
            profile.RainProbability,
            profile.RainFrom,
            profile.NeedsLayers,
            profile.Band,
            [.. weather.Hours.Select(hour => new WeatherHourResponse(hour.Time, Whole(hour.FeelsLike), hour.Sky))]);
    }

    internal static int Whole(double degrees) => (int)Math.Round(degrees, MidpointRounding.AwayFromZero);
}
