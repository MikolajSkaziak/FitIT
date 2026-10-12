using FitIt.Core.Accounts;

namespace FitIt.Core.Weather;

/// <summary>What the sky does in the window, reduced to the five pictures the app can show.</summary>
public enum Sky
{
    Sun,
    CloudSun,
    Cloud,
    Rain,
    Snow,
}

/// <summary>One hour of the day as the app shows it: what it feels like and what the sky does.</summary>
public sealed record WeatherHour(DateTimeOffset Time, double FeelsLike, Sky Sky);

/// <summary>
/// The weather an outfit has to stand up to (product spec 6.2): the hours it will be worn in, boiled down to the
/// numbers the rules work with.
/// </summary>
public sealed record WeatherProfile(
    DateTimeOffset From,
    DateTimeOffset To,
    bool ForTomorrow,
    double FeelsMin,
    double FeelsMax,
    DateTimeOffset ColdestAt,
    DateTimeOffset WarmestAt,
    int RainProbability,
    double RainMm,
    DateTimeOffset? RainFrom,
    double Reference,
    TemperatureBand Band,
    bool Rain,
    bool NeedsLayers,
    Sky Sky)
{
    private const int LastHour = 23;

    public BandRule Rule => BandRule.For(Band);

    /// <summary>How many days a person can dress for: today and the next six. The forecast is asked for with a day to spare.</summary>
    public const int HorizonDays = 7;

    /// <summary>
    /// Builds the profile for the rest of today at the place: from the current hour until the evening, and late at night
    /// until midnight. Null when the forecast has no hours in that window.
    /// </summary>
    public static WeatherProfile? Build(Forecast forecast, DateTimeOffset now, ThermalPreference thermal, WeatherRules rules) =>
        Of(Window(forecast, now, rules), thermal, rules);

    /// <summary>
    /// Builds the profile for a whole day at the place, as its calendar counts days: from the usual start of the day to its
    /// usual end. Null when the forecast does not reach that day.
    /// </summary>
    public static WeatherProfile? Build(Forecast forecast, DateOnly day, ThermalPreference thermal, WeatherRules rules) =>
        Of(Window(forecast, day, rules), thermal, rules);

    private static WeatherProfile? Of(List<ForecastHour> hours, ThermalPreference thermal, WeatherRules rules)
    {
        if (hours.Count == 0)
        {
            return null;
        }

        var from = hours[0].Time;
        var to = hours[^1].Time;
        var coldest = hours.MinBy(hour => hour.FeelsLike)!;
        var warmest = hours.MaxBy(hour => hour.FeelsLike)!;
        var rainProbability = hours.Max(hour => hour.RainProbability);
        var rainMm = Math.Round(hours.Sum(hour => hour.RainMm), 1);
        var rain = rainProbability >= rules.RainProbability || rainMm >= rules.RainMm;
        var reference = coldest.FeelsLike + thermal switch
        {
            ThermalPreference.RunsCold => -rules.ThermalShift,
            ThermalPreference.RunsWarm => rules.ThermalShift,
            _ => 0,
        };

        return new WeatherProfile(
            from,
            to,
            false,
            coldest.FeelsLike,
            warmest.FeelsLike,
            coldest.Time,
            warmest.Time,
            rainProbability,
            rainMm,
            rain ? hours.FirstOrDefault(hour => hour.RainProbability >= rules.RainProbability || hour.RainMm > 0)?.Time : null,
            reference,
            rules.BandOf(reference),
            rain,
            warmest.FeelsLike - coldest.FeelsLike >= rules.LayersAmplitude,
            SkyOf(hours, rain));
    }

    /// <summary>
    /// Up to <paramref name="count"/> hours of the same window, spread evenly from the current hour to its end, each with
    /// its own sky. Fewer when the day has fewer hours left.
    /// </summary>
    public static IReadOnlyList<WeatherHour> Slots(Forecast forecast, DateTimeOffset now, WeatherRules rules, int count = 4) =>
        Slots(Window(forecast, now, rules), rules, count);

    /// <summary>The same for a whole day: up to <paramref name="count"/> hours spread evenly from its morning to its evening.</summary>
    public static IReadOnlyList<WeatherHour> Slots(Forecast forecast, DateOnly day, WeatherRules rules, int count = 4) =>
        Slots(Window(forecast, day, rules), rules, count);

    private static IReadOnlyList<WeatherHour> Slots(List<ForecastHour> hours, WeatherRules rules, int count)
    {
        var picked = hours.Count <= count
            ? hours
            : [.. Enumerable.Range(0, count).Select(slot => hours[(int)Math.Round(slot * (hours.Count - 1) / (double)(count - 1), MidpointRounding.AwayFromZero)])];
        return [.. picked.Select(hour => new WeatherHour(hour.Time, hour.FeelsLike, SkyOf([hour], hour.RainProbability >= rules.RainProbability || hour.RainMm > 0)))];
    }

    /// <summary>
    /// The hours an outfit asked for now is worn in. Always the day it is now at the place: such an outfit is for today,
    /// however late it is. Once the usual end of the day has passed, what is left of the evening is the window.
    /// </summary>
    private static List<ForecastHour> Window(Forecast forecast, DateTimeOffset now, WeatherRules rules)
    {
        if (forecast.Hours.Count == 0)
        {
            return [];
        }

        // The forecast's own hours say what the offset of the place is at that time of year.
        var here = now.ToOffset(forecast.Hours.MinBy(hour => (hour.Time - now).Duration())!.Time.Offset);
        var from = new DateTimeOffset(here.Date.AddHours(here.Hour), here.Offset);
        var to = new DateTimeOffset(here.Date.AddHours(here.Hour < rules.DayEndHour ? rules.DayEndHour : LastHour), here.Offset);
        return [.. forecast.Hours.Where(hour => hour.Time >= from && hour.Time <= to).OrderBy(hour => hour.Time)];
    }

    /// <summary>The hours an outfit planned for a day is worn in: that date on the clock of the place, morning to evening.</summary>
    private static List<ForecastHour> Window(Forecast forecast, DateOnly day, WeatherRules rules) =>
    [
        .. forecast.Hours
            .Where(hour => DateOnly.FromDateTime(hour.Time.DateTime) == day && hour.Time.Hour >= rules.DayStartHour && hour.Time.Hour <= rules.DayEndHour)
            .OrderBy(hour => hour.Time),
    ];

    /// <summary>Snow wins over rain, rain over clouds; otherwise the kind of sky most of the hours have, the cloudier on a tie.</summary>
    private static Sky SkyOf(List<ForecastHour> hours, bool rain)
    {
        if (hours.Any(hour => IsSnow(hour.WeatherCode)))
        {
            return Sky.Snow;
        }

        if (rain)
        {
            return Sky.Rain;
        }

        return hours
            .GroupBy(hour => hour.WeatherCode switch { 0 => Sky.Sun, 1 or 2 => Sky.CloudSun, _ => Sky.Cloud })
            .OrderByDescending(group => group.Count())
            .ThenByDescending(group => group.Key)
            .First().Key;
    }

    /// <summary>WMO weather codes for snowfall, snow grains and snow showers.</summary>
    private static bool IsSnow(int code) => code is (>= 71 and <= 77) or 85 or 86;
}
