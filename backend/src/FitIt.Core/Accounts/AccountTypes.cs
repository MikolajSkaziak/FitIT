namespace FitIt.Core.Accounts;

/// <summary>
/// What the person says about themselves. Women are offered the five female silhouettes and men the five male ones;
/// <see cref="NonBinary"/> and <see cref="Unspecified"/> are offered all ten.
/// </summary>
public enum Gender
{
    Female,
    Male,
    NonBinary,
    Unspecified,
}

public static class GenderRules
{
    /// <summary>True for the values that are not tied to one set of silhouettes.</summary>
    public static bool OffersAllSilhouettes(this Gender gender) => gender is Gender.NonBinary or Gender.Unspecified;
}

/// <summary>Shifts the weather thresholds by three degrees either way (product spec 6.2).</summary>
public enum ThermalPreference
{
    RunsCold,
    Normal,
    RunsWarm,
}

/// <summary>The person's usual clothing size. Optional; it only helps outfits look right on the figure and in try-on pictures.</summary>
public enum ClothingSize
{
    Xs,
    S,
    M,
    L,
    Xl,
    Xxl,
}

/// <summary>How the person's legs compare with average. Optional; used the same way as <see cref="ClothingSize"/>.</summary>
public enum LegLength
{
    Shorter,
    Average,
    Longer,
}

/// <summary>Where the weather place in the profile came from.</summary>
public enum LocationSource
{
    /// <summary>The phone's location, sent by the app after the system permission was granted.</summary>
    Device,

    /// <summary>A city the person picked from the search because location was refused or not wanted.</summary>
    Manual,
}

/// <summary>A place for the weather forecast. Coordinates are stored rounded, never exact.</summary>
public sealed record WeatherPlace(LocationSource Source, string Name, double Lat, double Lon)
{
    public const int NameMaxLength = 80;

    /// <summary>Rounds to 0.1 of a degree (about 11 km): enough for a forecast, too coarse to locate a person.</summary>
    public static double RoundCoordinate(double value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);

    public static bool IsValid(double lat, double lon) =>
        double.IsFinite(lat) && double.IsFinite(lon) && lat is >= -90 and <= 90 && lon is >= -180 and <= 180;
}

public static class AgeRule
{
    /// <summary>True when the person has reached <paramref name="minimumAge"/> on <paramref name="today"/>.</summary>
    public static bool IsOldEnough(DateOnly birthDate, DateOnly today, int minimumAge) =>
        birthDate <= today && birthDate.AddYears(minimumAge) <= today;

    /// <summary>Rejects impossible dates: in the future or more than 120 years back.</summary>
    public static bool IsPlausible(DateOnly birthDate, DateOnly today) =>
        birthDate <= today && birthDate >= today.AddYears(-120);
}
