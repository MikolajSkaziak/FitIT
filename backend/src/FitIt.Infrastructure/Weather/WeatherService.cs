using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Weather;

/// <summary>
/// The weather a person dresses for: where it was taken, what it comes down to, and a few hours of it. For today those run
/// from now to the evening and <see cref="IsToday"/> is true; for a day ahead they run through that whole day.
/// </summary>
public sealed record PersonalWeather(WeatherPlace Place, WeatherProfile Profile, IReadOnlyList<WeatherHour> Hours, DateOnly Day, bool IsToday = true);

/// <summary>
/// Forecasts for the place in a profile, turned into the profile the stylist's rules work with. A forecast is kept for
/// an hour (product spec 6.2), so a busy morning does not ask the provider once per person per tap.
/// </summary>
public sealed class WeatherService(AppDbContext db, IWeatherProvider provider, IMemoryCache cache, AppClock clock, IOptions<WeatherRules> rules)
{
    /// <summary>How long a forecast is served without asking again.</summary>
    public static readonly TimeSpan Fresh = TimeSpan.FromHours(1);

    /// <summary>How long an old forecast may stand in while the provider does not answer. Hours ahead barely change in that time.</summary>
    public static readonly TimeSpan Usable = TimeSpan.FromHours(6);

    public async Task<Result<PersonalWeather>> TodayAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);
        if (user is null)
        {
            return ApiError.NotFound();
        }

        return user.Place is { } place ? await AtAsync(place, user.ThermalPreference, cancellationToken) : WeatherErrors.NoPlace;
    }

    /// <summary>The weather of one day of the person's calendar, today or one of the next six.</summary>
    public async Task<Result<PersonalWeather>> OnAsync(Guid userId, DateOnly day, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);
        if (user is null)
        {
            return ApiError.NotFound();
        }

        return user.Place is { } place ? await AtAsync(place, user.ThermalPreference, cancellationToken, day) : WeatherErrors.NoPlace;
    }

    /// <summary>
    /// The weather at a place: for the rest of today, or with <paramref name="day"/> for that day of the place's calendar.
    /// Today asked for by its date is the rest of today; a day before it or past the horizon is refused.
    /// </summary>
    public async Task<Result<PersonalWeather>> AtAsync(WeatherPlace place, ThermalPreference thermal, CancellationToken cancellationToken, DateOnly? day = null)
    {
        var today = clock.DayAt(place).Today;
        if (day is { } asked && (asked < today || asked >= today.AddDays(WeatherProfile.HorizonDays)))
        {
            return WeatherErrors.OutOfRange;
        }

        var forecast = await ForecastAsync(place.Lat, place.Lon, cancellationToken);
        if (!forecast.IsOk)
        {
            return forecast.Error!;
        }

        if (day is { } ahead && ahead != today)
        {
            return WeatherProfile.Build(forecast.Value, ahead, thermal, rules.Value) is { } planned
                ? new PersonalWeather(place, planned, WeatherProfile.Slots(forecast.Value, ahead, rules.Value), ahead, IsToday: false)
                : WeatherErrors.Unavailable;
        }

        return WeatherProfile.Build(forecast.Value, clock.UtcNow, thermal, rules.Value) is { } profile
            ? new PersonalWeather(place, profile, WeatherProfile.Slots(forecast.Value, clock.UtcNow, rules.Value), today)
            : WeatherErrors.Unavailable;
    }

    private async Task<Result<Forecast>> ForecastAsync(double lat, double lon, CancellationToken cancellationToken)
    {
        var key = (nameof(WeatherService), WeatherPlace.RoundCoordinate(lat), WeatherPlace.RoundCoordinate(lon));
        var kept = cache.Get<Kept>(key);
        if (kept is not null && clock.UtcNow - kept.At < Fresh)
        {
            return kept.Forecast;
        }

        var asked = await provider.ForecastAsync(lat, lon, cancellationToken);
        if (asked.IsOk)
        {
            cache.Set(key, new Kept(asked.Value, clock.UtcNow), new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = Usable });
            return asked;
        }

        return kept is not null && clock.UtcNow - kept.At < Usable ? kept.Forecast : asked;
    }

    private sealed record Kept(Forecast Forecast, DateTimeOffset At);
}
