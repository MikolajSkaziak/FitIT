using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Weather;

/// <summary>Hourly forecasts from the Open-Meteo API. Needs no key.</summary>
public sealed class OpenMeteoWeather(HttpClient http, ILogger<OpenMeteoWeather> logger) : IWeatherProvider
{
    public const string BaseAddress = "https://api.open-meteo.com/";

    /// <summary>The days a person can dress for and one to spare: a forecast kept past midnight still reaches the last of them.</summary>
    public const int ForecastDays = WeatherProfile.HorizonDays + 1;

    private const string Fields = "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code";

    public async Task<Result<Forecast>> ForecastAsync(double lat, double lon, CancellationToken cancellationToken)
    {
        // The zone is the provider's answer for the coordinates ("auto"); times come as instants and are turned into that zone's clock here.
        var url = string.Create(CultureInfo.InvariantCulture,
            $"v1/forecast?latitude={lat:0.0###}&longitude={lon:0.0###}&hourly={Fields}&forecast_days={ForecastDays}&timezone=auto&timeformat=unixtime");
        try
        {
            var response = await http.GetFromJsonAsync<Response>(url, cancellationToken);
            if (Read(response) is { } forecast)
            {
                return forecast;
            }

            // No coordinates in the log: where a person is does not belong there, even rounded.
            logger.LogWarning("The forecast came back without usable hours");
            return WeatherErrors.Unavailable;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                throw;
            }

            logger.LogWarning(exception, "The forecast request failed");
            return WeatherErrors.Unavailable;
        }
    }

    /// <summary>Null when the answer lacks a series or the series differ in length. An hour with a missing value is left out.</summary>
    private static Forecast? Read(Response? response)
    {
        if (response is not { Hourly: { Time: { Count: > 0 } times } hourly, TimeZone: { Length: > 0 } zoneId }
            || hourly.Temperature?.Count != times.Count || hourly.FeelsLike?.Count != times.Count
            || hourly.RainProbability?.Count != times.Count || hourly.Rain?.Count != times.Count || hourly.Code?.Count != times.Count)
        {
            return null;
        }

        var zone = PlaceZones.Find(zoneId);
        var hours = new List<ForecastHour>(times.Count);
        for (var index = 0; index < times.Count; index++)
        {
            if (hourly.Temperature[index] is { } temperature && hourly.FeelsLike[index] is { } feelsLike && hourly.Code[index] is { } code)
            {
                var instant = DateTimeOffset.FromUnixTimeSeconds(times[index]);
                var local = zone is null ? instant.ToOffset(TimeSpan.FromSeconds(response.UtcOffsetSeconds)) : TimeZoneInfo.ConvertTime(instant, zone);
                hours.Add(new ForecastHour(local, temperature, feelsLike, hourly.RainProbability[index] ?? 0, hourly.Rain[index] ?? 0, code));
            }
        }

        return hours.Count == 0 ? null : new Forecast(zoneId, hours);
    }

    private sealed record Response(
        [property: JsonPropertyName("timezone")] string? TimeZone,
        [property: JsonPropertyName("utc_offset_seconds")] int UtcOffsetSeconds,
        [property: JsonPropertyName("hourly")] Hourly? Hourly);

    private sealed record Hourly(
        [property: JsonPropertyName("time")] List<long>? Time,
        [property: JsonPropertyName("temperature_2m")] List<double?>? Temperature,
        [property: JsonPropertyName("apparent_temperature")] List<double?>? FeelsLike,
        [property: JsonPropertyName("precipitation_probability")] List<int?>? RainProbability,
        [property: JsonPropertyName("precipitation")] List<double?>? Rain,
        [property: JsonPropertyName("weather_code")] List<int?>? Code);
}

/// <summary>
/// Made-up weather for tests and for work without a network: the same day everywhere, coldest before dawn and warmest
/// in mid afternoon, for as many days as the real provider is asked for. A test or the evaluation tool sets the numbers it needs.
/// </summary>
public sealed class FakeWeather(TimeProvider time) : IWeatherProvider
{
    public double Low { get; set; } = 12;

    public double High { get; set; } = 17;

    public int RainProbability { get; set; } = 10;

    /// <summary>Rain per hour, in millimetres.</summary>
    public double RainMm { get; set; }

    public int WeatherCode { get; set; } = 2;

    /// <summary>Degrees each day is warmer (or, below zero, colder) than the day before it, so a day ahead can differ from today.</summary>
    public double Trend { get; set; }

    /// <summary>While true the provider fails, the way the real one does when it cannot be reached.</summary>
    public bool Down { get; set; }

    public int Calls { get; private set; }

    public void Reset() => (Low, High, RainProbability, RainMm, WeatherCode, Trend, Down, Calls) = (12, 17, 10, 0, 2, 0, false, 0);

    public Task<Result<Forecast>> ForecastAsync(double lat, double lon, CancellationToken cancellationToken)
    {
        Calls++;
        if (Down)
        {
            return Task.FromResult<Result<Forecast>>(WeatherErrors.Unavailable);
        }

        var zone = PlaceZones.At(lat, lon) ?? TimeZoneInfo.Utc;
        var today = TimeZoneInfo.ConvertTime(time.GetUtcNow(), zone).Date;
        var hours = Enumerable.Range(0, 24 * OpenMeteoWeather.ForecastDays).Select(index =>
        {
            var local = today.AddHours(index);
            // A cosine through the day: lowest at 03:00, highest at 15:00.
            var feels = Low + (Trend * (index / 24)) + ((High - Low) * (1 - Math.Cos((local.Hour - 3) * Math.PI / 12)) / 2);
            return new ForecastHour(new DateTimeOffset(local, zone.GetUtcOffset(local)), Math.Round(feels, 1), Math.Round(feels, 1), RainProbability, RainMm, WeatherCode);
        });
        return Task.FromResult(Result.Ok(new Forecast(zone.Id, [.. hours])));
    }
}
