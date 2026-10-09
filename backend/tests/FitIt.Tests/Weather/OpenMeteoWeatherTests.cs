using System.Net;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Weather;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitIt.Tests.Weather;

public sealed class OpenMeteoWeatherTests
{
    /// <summary>What the forecast service really answered for Tokyo on 6 October 2026, untouched.</summary>
    private static readonly string Recorded = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Weather", "Recorded", "open-meteo-tokyo.json"));

    [Fact]
    public async Task A_recorded_answer_becomes_three_days_of_hours_on_the_clock_of_the_place()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Recorded);

        var result = await Ask(handler, 35.7, 139.7);

        Assert.True(result.IsOk);
        var forecast = result.Value;
        Assert.Equal("Asia/Tokyo", forecast.TimeZone);
        Assert.Equal(72, forecast.Hours.Count);
        Assert.All(forecast.Hours, hour => Assert.Equal(TimeSpan.FromHours(9), hour.Time.Offset));
        // Midnight in Tokyo, not midnight in Greenwich.
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 0, 0, 0, TimeSpan.FromHours(9)), forecast.Hours[0].Time);
        Assert.Equal(new ForecastHour(forecast.Hours[0].Time, 19.5, 21.1, 8, 0, 1), forecast.Hours[0]);
        Assert.Equal(forecast.Hours.Select(hour => hour.Time).Order(), forecast.Hours.Select(hour => hour.Time));
        Assert.All(forecast.Hours.Zip(forecast.Hours.Skip(1)), pair => Assert.Equal(TimeSpan.FromHours(1), pair.Second.Time - pair.First.Time));
    }

    [Fact]
    public async Task The_recorded_day_gives_four_hours_from_now_to_the_evening()
    {
        var forecast = (await Ask(new StubHandler(HttpStatusCode.OK, Recorded), 35.7, 139.7)).Value;
        var noon = new DateTimeOffset(2026, 10, 6, 12, 10, 0, TimeSpan.FromHours(9));

        var slots = WeatherProfile.Slots(forecast, noon, new WeatherRules());

        Assert.Equal([12, 15, 19, 22], slots.Select(slot => slot.Time.Hour));
        Assert.All(slots, slot =>
        {
            var hour = forecast.Hours.Single(hour => hour.Time == slot.Time);
            Assert.Equal(hour.FeelsLike, slot.FeelsLike);
            Assert.Equal(TimeSpan.FromHours(9), slot.Time.Offset);
        });
    }

    [Theory]
    [InlineData(35.7, 139.7, "latitude=35.7&longitude=139.7")]
    [InlineData(-33.9, 151.2, "latitude=-33.9&longitude=151.2")]
    [InlineData(0, -78, "latitude=0.0&longitude=-78.0")]
    public async Task The_request_names_the_place_the_fields_and_lets_the_provider_pick_the_zone(double lat, double lon, string place)
    {
        var handler = new StubHandler(HttpStatusCode.OK, Recorded);

        await Ask(handler, lat, lon);

        Assert.Equal(
            $"/v1/forecast?{place}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code&forecast_days=3&timezone=auto&timeformat=unixtime",
            handler.Asked?.PathAndQuery);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, "oops")]
    [InlineData(HttpStatusCode.TooManyRequests, """{"error":true,"reason":"Minutely API request limit exceeded."}""")]
    [InlineData(HttpStatusCode.OK, "<html>not json</html>")]
    [InlineData(HttpStatusCode.OK, "{}")]
    [InlineData(HttpStatusCode.OK, """{"timezone":"Asia/Tokyo","utc_offset_seconds":32400}""")]
    [InlineData(HttpStatusCode.OK, """{"timezone":"Asia/Tokyo","utc_offset_seconds":32400,"hourly":{"time":[]}}""")]
    // One series shorter than the others: the hours can no longer be matched up.
    [InlineData(HttpStatusCode.OK, """{"timezone":"Asia/Tokyo","utc_offset_seconds":32400,"hourly":{"time":[1791212400,1791216000],"temperature_2m":[19.5,19.5],"apparent_temperature":[21.1],"precipitation_probability":[8,8],"precipitation":[0,0],"weather_code":[1,1]}}""")]
    // A series missing altogether.
    [InlineData(HttpStatusCode.OK, """{"timezone":"Asia/Tokyo","utc_offset_seconds":32400,"hourly":{"time":[1791212400],"temperature_2m":[19.5],"apparent_temperature":[21.1],"precipitation":[0],"weather_code":[1]}}""")]
    // Every hour lacks its temperature.
    [InlineData(HttpStatusCode.OK, """{"timezone":"Asia/Tokyo","utc_offset_seconds":32400,"hourly":{"time":[1791212400],"temperature_2m":[null],"apparent_temperature":[21.1],"precipitation_probability":[8],"precipitation":[0],"weather_code":[1]}}""")]
    public async Task An_answer_that_cannot_be_used_is_reported_as_unavailable(HttpStatusCode status, string body)
    {
        var result = await Ask(new StubHandler(status, body), 35.7, 139.7);

        Assert.False(result.IsOk);
        Assert.Equal(503, result.Error?.Status);
        Assert.Equal("weather_unavailable", result.Error?.Code);
    }

    [Fact]
    public async Task An_hour_without_a_temperature_is_left_out_and_missing_rain_counts_as_none()
    {
        const string body = """
            {"timezone":"Asia/Tokyo","utc_offset_seconds":32400,"hourly":{
              "time":[1791212400,1791216000,1791219600],
              "temperature_2m":[19.5,null,18.0],
              "apparent_temperature":[21.1,20.0,null],
              "precipitation_probability":[null,8,9],
              "precipitation":[null,0.2,0.3],
              "weather_code":[1,1,1]}}
            """;

        var result = await Ask(new StubHandler(HttpStatusCode.OK, body), 35.7, 139.7);

        var hour = Assert.Single(result.Value.Hours);
        Assert.Equal(new ForecastHour(new DateTimeOffset(2026, 10, 6, 0, 0, 0, TimeSpan.FromHours(9)), 19.5, 21.1, 0, 0, 1), hour);
    }

    [Fact]
    public async Task A_zone_this_system_does_not_know_falls_back_to_the_offset_in_the_answer()
    {
        const string body = """
            {"timezone":"Mars/Olympus_Mons","utc_offset_seconds":-16200,"hourly":{"time":[1791212400],"temperature_2m":[19.5],
              "apparent_temperature":[21.1],"precipitation_probability":[8],"precipitation":[0],"weather_code":[1]}}
            """;

        var result = await Ask(new StubHandler(HttpStatusCode.OK, body), 35.7, 139.7);

        Assert.Equal(new TimeSpan(-4, -30, 0), Assert.Single(result.Value.Hours).Time.Offset);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1791212400), result.Value.Hours[0].Time);
    }

    [Fact]
    public async Task A_request_that_times_out_is_reported_as_unavailable()
    {
        var result = await Ask(new StubHandler(HttpStatusCode.OK, Recorded) { Fails = new TaskCanceledException("The request timed out.") }, 35.7, 139.7);

        Assert.Equal("weather_unavailable", result.Error?.Code);
    }

    private static Task<Result<Forecast>> Ask(StubHandler handler, double lat, double lon)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri(OpenMeteoWeather.BaseAddress) };
        return new OpenMeteoWeather(http, NullLogger<OpenMeteoWeather>.Instance).ForecastAsync(lat, lon, CancellationToken.None);
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public Uri? Asked { get; private set; }

        public Exception? Fails { get; init; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Asked = request.RequestUri;
            return Fails is null
                ? Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") })
                : Task.FromException<HttpResponseMessage>(Fails);
        }
    }
}
