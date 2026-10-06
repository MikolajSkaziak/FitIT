using FitIt.Core.Accounts;
using Microsoft.AspNetCore.Identity;

namespace FitIt.Infrastructure.Identity;

public sealed class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";

    /// <summary>Kept only to confirm the minimum age at registration.</summary>
    public DateOnly BirthDate { get; set; }

    public Gender Gender { get; set; }

    /// <summary>Codes of <see cref="Core.Wardrobe.StyleTag"/>.</summary>
    public string[] StylePreferences { get; set; } = [];

    public ThermalPreference ThermalPreference { get; set; } = ThermalPreference.Normal;

    public LocationSource? LocationSource { get; set; }

    public string? LocationName { get; set; }

    /// <summary>Rounded to 0.1 of a degree before it is stored.</summary>
    public double? Lat { get; set; }

    public double? Lon { get; set; }

    public Guid AvatarId { get; set; }

    public Avatar? Avatar { get; set; }

    /// <summary>When the person agreed to garment photos being sent to external AI services; null without consent.</summary>
    public DateTimeOffset? AiConsentAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public WeatherPlace? Place =>
        LocationSource is { } source && LocationName is { } name && Lat is { } lat && Lon is { } lon
            ? new WeatherPlace(source, name, lat, lon)
            : null;
}
