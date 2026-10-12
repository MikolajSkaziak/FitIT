using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Weather;
using FitIt.Tests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Weather;

[Collection(ApiTests.Name)]
public sealed class WeatherServiceTests(ApiFactory factory)
{
    [Fact]
    public async Task A_forecast_is_asked_for_once_an_hour_per_place()
    {
        var weather = factory.FreshWeather();
        var lima = new WeatherPlace(LocationSource.Manual, "Lima", -12.0, -77.0);

        Assert.True((await At(lima)).IsOk);
        Assert.True((await At(lima)).IsOk);
        factory.Clock.Advance(TimeSpan.FromMinutes(59));
        Assert.True((await At(lima)).IsOk);
        Assert.Equal(1, weather.Calls);

        factory.Clock.Advance(TimeSpan.FromMinutes(1));
        Assert.True((await At(lima)).IsOk);
        Assert.Equal(2, weather.Calls);

        // Another place has its own forecast; the same place written less precisely does not.
        Assert.True((await At(new WeatherPlace(LocationSource.Manual, "Nairobi", -1.3, 36.8))).IsOk);
        Assert.Equal(3, weather.Calls);
        Assert.True((await At(lima with { Lat = -12.04, Lon = -77.03 })).IsOk);
        Assert.Equal(3, weather.Calls);
    }

    [Fact]
    public async Task While_the_provider_is_down_a_kept_forecast_stands_in_for_six_hours_and_no_longer()
    {
        var weather = factory.FreshWeather();
        var auckland = new WeatherPlace(LocationSource.Manual, "Auckland", -36.8, 174.8);
        Assert.True((await At(auckland)).IsOk);

        weather.Down = true;
        factory.Clock.Advance(TimeSpan.FromHours(1));
        var covered = await At(auckland);
        Assert.True(covered.IsOk);
        Assert.Equal(2, weather.Calls);

        factory.Clock.Advance(TimeSpan.FromHours(5) - TimeSpan.FromSeconds(1));
        Assert.True((await At(auckland)).IsOk);
        Assert.Equal(3, weather.Calls);

        factory.Clock.Advance(TimeSpan.FromSeconds(1));
        var tooOld = await At(auckland);
        Assert.Equal("weather_unavailable", tooOld.Error?.Code);
        Assert.Equal(503, tooOld.Error?.Status);

        // Once the provider is back, so is the weather, and it is kept afresh.
        weather.Down = false;
        Assert.True((await At(auckland)).IsOk);
        weather.Down = true;
        Assert.True((await At(auckland)).IsOk);
    }

    [Fact]
    public async Task Without_any_forecast_a_failing_provider_is_reported_as_it_is()
    {
        factory.FreshWeather().Down = true;

        var result = await At(new WeatherPlace(LocationSource.Manual, "Reykjavik", 64.1, -21.9));

        Assert.Equal("weather_unavailable", result.Error?.Code);
    }

    [Fact]
    public async Task The_profile_follows_the_persons_thermal_preference()
    {
        var weather = factory.FreshWeather();
        (weather.Low, weather.High) = (12, 12);
        var place = new WeatherPlace(LocationSource.Manual, "Quito", -0.2, -78.5);

        var cold = await At(place, ThermalPreference.RunsCold);
        var warm = await At(place, ThermalPreference.RunsWarm);

        Assert.Equal((9, TemperatureBand.Cold), (cold.Value.Profile.Reference, cold.Value.Profile.Band));
        Assert.Equal((15, TemperatureBand.Mild), (warm.Value.Profile.Reference, warm.Value.Profile.Band));
        Assert.Equal(place, cold.Value.Place);
        Assert.Equal(1, weather.Calls);
    }

    [Fact]
    public async Task Todays_weather_is_told_on_the_clock_of_the_place_in_the_profile()
    {
        var weather = factory.FreshWeather();
        (weather.Low, weather.High, weather.RainProbability, weather.WeatherCode) = (4, 4, 80, 61);
        var (client, _) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Tokio", ["lat"] = 35.6762, ["lon"] = 139.6503 });

        var response = await client.GetAsync("/api/weather/today");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var today = await response.ReadAsync<WeatherResponse>();
        var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
        var there = TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), tokyo);
        Assert.Equal("Tokio", today.Place);
        Assert.Equal(TimeSpan.FromHours(9), today.From.Offset);
        Assert.Equal(there.Hour < 22 ? 22 : 23, today.To.Hour);
        Assert.False(today.ForTomorrow);
        Assert.Equal(there.Date, today.To.Date);
        Assert.Equal((4, 4), (today.FeelsMin, today.FeelsMax));
        Assert.Equal(TemperatureBand.Cold, today.Band);
        Assert.True(today.Rain);
        Assert.Equal(80, today.RainProbability);
        Assert.Equal(today.From, today.RainFrom);
        Assert.Equal(Sky.Rain, today.Sky);
        Assert.False(today.NeedsLayers);

        // A few hours of the same window from the fake provider: the current one first, none past the end, all wet.
        Assert.InRange(today.Hours.Count, 1, 4);
        Assert.Equal(today.From, today.Hours[0].Time);
        Assert.Equal(today.To, today.Hours[^1].Time);
        Assert.Equal(today.Hours.Select(hour => hour.Time).Order(), today.Hours.Select(hour => hour.Time));
        Assert.All(today.Hours, hour => Assert.Equal((4, Sky.Rain, TimeSpan.FromHours(9)), (hour.Feels, hour.Sky, hour.Time.Offset)));

        // Codes, not numbers, and instants that keep the offset of the place.
        var raw = await (await client.GetAsync("/api/weather/today")).Content.ReadAsStringAsync();
        Assert.Contains("\"band\":\"cold\"", raw, StringComparison.Ordinal);
        Assert.Contains("\"sky\":\"rain\"", raw, StringComparison.Ordinal);
        Assert.Contains("+09:00", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_day_ahead_has_its_own_weather_for_the_whole_day_and_no_now()
    {
        var weather = factory.FreshWeather();
        (weather.Low, weather.High, weather.Trend) = (10, 10, -2);
        var (client, _) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Tokio", ["lat"] = 35.6762, ["lon"] = 139.6503 });
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo")).DateTime);

        var response = await client.GetAsync($"/api/weather/day?date={today.AddDays(3):yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var day = await response.ReadAsync<DayWeatherResponse>();
        Assert.Equal((today.AddDays(3), false, (int?)null, "Tokio"), (day.Date, day.IsToday, day.Now, day.Place));
        // Three days on, two degrees colder each: the forecast of that day, not of this one.
        Assert.Equal((4, 4, TemperatureBand.Cold), (day.FeelsMin, day.FeelsMax, day.Band));
        Assert.Equal((today.AddDays(3), 7, TimeSpan.FromHours(9)), (DateOnly.FromDateTime(day.From.DateTime), day.From.Hour, day.From.Offset));
        Assert.Equal((today.AddDays(3), 22), (DateOnly.FromDateTime(day.To.DateTime), day.To.Hour));
        Assert.Equal([7, 12, 17, 22], day.Hours.Select(hour => hour.Time.Hour));
        Assert.All(day.Hours, hour => Assert.Equal(today.AddDays(3), DateOnly.FromDateTime(hour.Time.DateTime)));
        var raw = await (await client.GetAsync($"/api/weather/day?date={today.AddDays(3):yyyy-MM-dd}")).Content.ReadAsStringAsync();
        Assert.Contains("\"now\":null", raw, StringComparison.Ordinal);

        // The last day of the horizon is still told; one forecast answered all of it.
        var last = await (await client.GetAsync($"/api/weather/day?date={today.AddDays(6):yyyy-MM-dd}")).ReadAsync<DayWeatherResponse>();
        Assert.Equal((today.AddDays(6), -2), (last.Date, last.FeelsMin));
        Assert.Equal(1, weather.Calls);
    }

    [Fact]
    public async Task Today_asked_for_by_its_date_is_the_rest_of_today_with_a_now()
    {
        var weather = factory.FreshWeather();
        (weather.Low, weather.High) = (9, 9);
        var (client, _) = await factory.SignedInAsync();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw")).DateTime);

        var day = await (await client.GetAsync($"/api/weather/day?date={today:yyyy-MM-dd}")).ReadAsync<DayWeatherResponse>();
        var same = await (await client.GetAsync("/api/weather/today")).ReadAsync<WeatherResponse>();

        Assert.Equal((today, true, (int?)9), (day.Date, day.IsToday, day.Now));
        Assert.Equal((same.From, same.To, same.FeelsMin, same.FeelsMax), (day.From, day.To, day.FeelsMin, day.FeelsMax));
        Assert.Equal(same.Hours, day.Hours);
    }

    [Fact]
    public async Task A_day_outside_the_seven_days_of_the_forecast_is_refused_with_its_own_code()
    {
        var weather = factory.FreshWeather();
        // Far to the east, where the date is already tomorrow's for half of Greenwich's day: the horizon is counted there.
        var (client, _) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Kiritimati", ["lat"] = 1.9, ["lon"] = -157.4 });
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById("Pacific/Kiritimati")).DateTime);

        foreach (var query in new[] { $"?date={today.AddDays(-1):yyyy-MM-dd}", $"?date={today.AddDays(7):yyyy-MM-dd}", $"?date={today.AddDays(400):yyyy-MM-dd}", "" })
        {
            var refused = await client.GetAsync($"/api/weather/day{query}");
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("date_out_of_range", await refused.ProblemCodeAsync());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/weather/day?date=tomorrow")).StatusCode);
        // Nothing was asked of the provider for a day it cannot tell.
        Assert.Equal(0, weather.Calls);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/weather/day?date={today.AddDays(6):yyyy-MM-dd}")).StatusCode);

        var (nowhere, _) = await factory.SignedInAsync(body => body.Remove("location"));
        var noPlace = await nowhere.GetAsync($"/api/weather/day?date={today.AddDays(1):yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.Conflict, noPlace.StatusCode);
        Assert.Equal("location_missing", await noPlace.ProblemCodeAsync());
    }

    [Fact]
    public async Task A_profile_without_a_place_has_no_weather()
    {
        factory.FreshWeather();
        var (client, _) = await factory.SignedInAsync(body => body.Remove("location"));

        var response = await client.GetAsync("/api/weather/today");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("location_missing", await response.ProblemCodeAsync());
        Assert.Equal(0, factory.Weather.Calls);
    }

    [Fact]
    public async Task A_forecast_that_cannot_be_had_is_a_503_with_its_own_code()
    {
        factory.FreshWeather().Down = true;
        var (client, _) = await factory.SignedInAsync();

        var response = await client.GetAsync("/api/weather/today");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("weather_unavailable", await response.ProblemCodeAsync());
        factory.FreshWeather();
    }

    [Fact]
    public async Task The_weather_needs_a_signed_in_person()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/weather/today")).StatusCode);
    }

    private Task<Result<PersonalWeather>> At(WeatherPlace place, ThermalPreference thermal = ThermalPreference.Normal) =>
        factory.WithServicesAsync(services => services.GetRequiredService<WeatherService>().AtAsync(place, thermal, CancellationToken.None));
}
