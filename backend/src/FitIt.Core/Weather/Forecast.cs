using FitIt.Core.Common;

namespace FitIt.Core.Weather;

/// <summary>One hour of a forecast. <see cref="Time"/> carries the offset of the place, so its clock reads as people there read it.</summary>
public sealed record ForecastHour(DateTimeOffset Time, double Temperature, double FeelsLike, int RainProbability, double RainMm, int WeatherCode);

/// <summary>The hourly forecast for a place, from the start of its today for the days a person can dress for and one more.</summary>
public sealed record Forecast(string TimeZone, IReadOnlyList<ForecastHour> Hours);

/// <summary>Where forecasts come from. Coordinates arrive rounded to 0.1 of a degree, as the profile stores them.</summary>
public interface IWeatherProvider
{
    Task<Result<Forecast>> ForecastAsync(double lat, double lon, CancellationToken cancellationToken);
}

public static class WeatherErrors
{
    public static readonly ApiError Unavailable = new(503, "weather_unavailable", "The forecast is not available right now. Try again in a moment.");

    public static readonly ApiError OutOfRange = ApiError.BadRequest(
        "date_out_of_range", "The forecast reaches today and the next six days. Pick a day among them.");

    public static readonly ApiError NoPlace = ApiError.Conflict("location_missing", "The profile has no place to check the weather for.");
}
