using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Weather;

namespace FitIt.Api.Endpoints;

internal static class WeatherEndpoints
{
    public static IEndpointRouteBuilder MapWeatherEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/weather/today", Today)
            .WithTags("Weather").WithName("getWeatherToday").RequireAuthorization()
            .Produces<WeatherResponse>().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);

        app.MapGet("/api/weather/day", Day)
            .WithTags("Weather").WithName("getWeatherForDay").RequireAuthorization()
            .Produces<DayWeatherResponse>().ProducesProblem(400).ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);

        return app;
    }

    /// <summary>The weather of a day within the forecast's horizon: today and the next six days of the person's calendar.</summary>
    private static async Task<IResult> Day(DateOnly? date, HttpContext http, WeatherService weather, CancellationToken cancellationToken)
    {
        if (date is not { } day)
        {
            return WeatherErrors.OutOfRange.ToProblem();
        }

        var found = await weather.OnAsync(http.User.UserId(), day, cancellationToken);
        if (!found.IsOk)
        {
            return found.Error!.ToProblem();
        }

        var shaped = Shape(found.Value);
        return TypedResults.Ok(new DayWeatherResponse(
            found.Value.Day, found.Value.IsToday, found.Value.IsToday && shaped.Hours.Count > 0 ? shaped.Hours[0].Feels : null, shaped.Place, shaped.From, shaped.To,
            shaped.FeelsMin, shaped.FeelsMax, shaped.ColdestAt, shaped.WarmestAt, shaped.Sky, shaped.Rain, shaped.RainProbability, shaped.RainFrom,
            shaped.NeedsLayers, shaped.Band, shaped.Hours));
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
