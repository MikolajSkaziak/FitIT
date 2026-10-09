using FitIt.Core.Accounts;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Common;

/// <summary>The one place that knows the time and the configured zone. Nothing else reads the system clock.</summary>
public sealed class AppClock(TimeProvider timeProvider, IOptions<AppOptions> options)
{
    /// <summary>The zone of things that belong to nobody in particular (the shared AI budget) and of people without a place.</summary>
    public TimeZoneInfo Zone { get; } = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();

    /// <summary>The current moment as a wall clock in the configured zone.</summary>
    public DateTimeOffset LocalNow => TimeZoneInfo.ConvertTime(UtcNow, Zone);

    /// <summary>The calendar day in the configured zone. A person's own day comes from <see cref="DayAt"/>.</summary>
    public DateOnly Today => DateOnly.FromDateTime(LocalNow.DateTime);

    /// <summary>
    /// The instant at which the given local day begins, expressed in UTC: the database stores instants in UTC only,
    /// and an instant has no need of the zone it was computed in.
    /// </summary>
    public DateTimeOffset StartOf(DateOnly day) => LocalDay.StartOf(day, Zone);

    /// <summary>
    /// The day as it is where the person's weather place lies: the app is used worldwide, and "today" in Tokyo is not
    /// "today" in Lima. The zone is looked up from the coordinates, offline. Without a place, the configured zone stands in.
    /// </summary>
    public LocalDay DayAt(WeatherPlace? place) => DayIn(place is null ? Zone : PlaceZones.At(place.Lat, place.Lon) ?? Zone);

    public LocalDay DayIn(TimeZoneInfo zone) => new(zone, TimeZoneInfo.ConvertTime(UtcNow, zone));
}

/// <summary>One moment seen from one zone: which calendar day it is there, and when its days begin.</summary>
public sealed record LocalDay(TimeZoneInfo Zone, DateTimeOffset Now)
{
    /// <summary>The calendar day; limits, wear dates and "forgotten" count in these days.</summary>
    public DateOnly Today => DateOnly.FromDateTime(Now.DateTime);

    /// <summary>The instant at which the given day begins in this zone, in UTC.</summary>
    public DateTimeOffset StartOf(DateOnly day) => StartOf(day, Zone);

    internal static DateTimeOffset StartOf(DateOnly day, TimeZoneInfo zone)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
