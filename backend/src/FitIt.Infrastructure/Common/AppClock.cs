using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Common;

/// <summary>The one place that knows the time and the configured zone. Nothing else reads the system clock.</summary>
public sealed class AppClock(TimeProvider timeProvider, IOptions<AppOptions> options)
{
    public TimeZoneInfo Zone { get; } = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();

    /// <summary>The current moment as a wall clock in the configured zone.</summary>
    public DateTimeOffset LocalNow => TimeZoneInfo.ConvertTime(UtcNow, Zone);

    /// <summary>The calendar day in the configured zone; limits, ages and wear dates count in these days.</summary>
    public DateOnly Today => DateOnly.FromDateTime(LocalNow.DateTime);

    /// <summary>The instant at which the given local day begins.</summary>
    public DateTimeOffset StartOf(DateOnly day)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Zone.GetUtcOffset(local));
    }
}
