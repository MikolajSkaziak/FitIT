using System.ComponentModel.DataAnnotations;
using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;

namespace FitIt.Api.Contracts;

public sealed class EmailCheckRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; init; } = "";
}

public sealed record EmailCheckResponse(bool Available);

public sealed class LocationRequest
{
    [Required]
    public LocationSource? Source { get; init; }

    [Required, MaxLength(WeatherPlace.NameMaxLength)]
    public string Name { get; init; } = "";

    [Required, Range(-90.0, 90.0)]
    public double? Lat { get; init; }

    [Required, Range(-180.0, 180.0)]
    public double? Lon { get; init; }

    public WeatherPlace ToPlace() => new(Source!.Value, Name, Lat!.Value, Lon!.Value);
}

public sealed class RegisterRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; init; } = "";

    [Required, MinLength(8), MaxLength(128)]
    public string Password { get; init; } = "";

    [Required, MaxLength(40)]
    public string DisplayName { get; init; } = "";

    [Required]
    public DateOnly? BirthDate { get; init; }

    [Required]
    public Gender? Gender { get; init; }

    [Required]
    public Guid? AvatarId { get; init; }

    [MaxLength(5)]
    public StyleTag[]? Styles { get; init; }

    public ThermalPreference? ThermalPreference { get; init; }

    public LocationRequest? Location { get; init; }
}

public sealed class LoginRequest
{
    [Required, MaxLength(254)]
    public string Email { get; init; } = "";

    [Required, MaxLength(128)]
    public string Password { get; init; } = "";
}

public sealed class RefreshRequest
{
    [Required, MaxLength(200)]
    public string RefreshToken { get; init; } = "";
}

public sealed class UpdateProfileRequest
{
    [MinLength(1), MaxLength(40)]
    public string? DisplayName { get; init; }

    public DateOnly? BirthDate { get; init; }

    public Gender? Gender { get; init; }

    public Guid? AvatarId { get; init; }

    [MaxLength(5)]
    public StyleTag[]? Styles { get; init; }

    public ThermalPreference? ThermalPreference { get; init; }

    public LocationRequest? Location { get; init; }

    /// <summary>True removes the stored weather place.</summary>
    public bool? ClearLocation { get; init; }

    /// <summary>True records consent to sending garment photos to external AI services; false withdraws it.</summary>
    public bool? AiConsent { get; init; }
}

public sealed record AvatarResponse(Guid Id, Gender Gender, string BodyType, string Label, string ImageUrl, string ThumbUrl);

public sealed record LocationResponse(LocationSource Source, string Name, double Lat, double Lon);

public sealed record UserResponse(
    Guid Id,
    string Email,
    string DisplayName,
    DateOnly BirthDate,
    Gender Gender,
    AvatarResponse Avatar,
    IReadOnlyList<StyleTag> Styles,
    ThermalPreference ThermalPreference,
    LocationResponse? Location,
    DateTimeOffset? AiConsentAt,
    DateTimeOffset CreatedAt);

public sealed record AuthResponse(string AccessToken, string RefreshToken, int ExpiresIn, UserResponse User);

public sealed record TokenResponse(string AccessToken, string RefreshToken, int ExpiresIn);

public sealed record PlaceResponse(string Name, string? Region, string? Country, double Lat, double Lon);

public sealed record HealthResponse(string Status);
