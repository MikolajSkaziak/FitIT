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

    /// <summary>Optional, never required: the usual clothing size, for the figure and the try-on prompt.</summary>
    public ClothingSize? ClothingSize { get; set; }

    /// <summary>Optional, never required: leg length compared with average, for the figure and the try-on prompt.</summary>
    public LegLength? LegLength { get; set; }

    public LocationSource? LocationSource { get; set; }

    public string? LocationName { get; set; }

    /// <summary>Rounded to 0.1 of a degree before it is stored.</summary>
    public double? Lat { get; set; }

    public double? Lon { get; set; }

    public Guid AvatarId { get; set; }

    public Avatar? Avatar { get; set; }

    /// <summary>
    /// When the person agreed to their photos being sent to external AI services: creating the account is that agreement, so it is set at
    /// registration. Null once they withdraw it in the profile.
    /// </summary>
    public DateTimeOffset? AiConsentAt { get; set; }

    /// <summary>The seasonal colour type and palette from the colour analysis; null until one is made. The photo it came from is never kept.</summary>
    public ColorProfile? ColorAnalysis { get; set; }

    /// <summary>The first step of the post-registration flow that is not finished yet (0 colors, 1 first pieces, 2 recap). Only ever rises.</summary>
    public int OnboardingStep { get; set; }

    /// <summary>When the person finished or skipped through the post-registration flow. The flow is shown while this is null, on any phone.</summary>
    public DateTimeOffset? OnboardingDoneAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public WeatherPlace? Place =>
        LocationSource is { } source && LocationName is { } name && Lat is { } lat && Lon is { } lon
            ? new WeatherPlace(source, name, lat, lon)
            : null;
}
