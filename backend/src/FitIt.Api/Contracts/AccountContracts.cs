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

    /// <summary>
    /// Optional: the app asks for the gender and the body shape right after the account exists, in the first step of the
    /// post-registration flow. Left out, the account starts as <c>unspecified</c> with a stand-in silhouette until that step sets both.
    /// </summary>
    public Gender? Gender { get; init; }

    /// <summary>Optional, see <see cref="Gender"/>.</summary>
    public Guid? AvatarId { get; init; }

    [MaxLength(GarmentCatalog.MaxPreferredStyles)]
    public StyleTag[]? Styles { get; init; }

    public ThermalPreference? ThermalPreference { get; init; }

    public ClothingSize? ClothingSize { get; init; }

    public LegLength? LegLength { get; init; }

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

public sealed class PasswordResetRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; init; } = "";
}

public sealed class PasswordResetConfirmRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; init; } = "";

    /// <summary>The six digits from the e-mail.</summary>
    [Required, RegularExpression(@"^[0-9]{6}$")]
    public string Code { get; init; } = "";

    [Required, MinLength(8), MaxLength(128)]
    public string NewPassword { get; init; } = "";
}

public sealed class ChangePasswordRequest
{
    [Required, MaxLength(128)]
    public string CurrentPassword { get; init; } = "";

    [Required, MinLength(8), MaxLength(128)]
    public string NewPassword { get; init; } = "";

    /// <summary>The refresh token of the session that stays signed in. Every other session ends; without it every session does, this one too.</summary>
    [MaxLength(200)]
    public string? RefreshToken { get; init; }
}

public sealed class DeleteAccountRequest
{
    /// <summary>The current password, as confirmation.</summary>
    [Required, MaxLength(128)]
    public string Password { get; init; } = "";
}

public sealed class UpdateProfileRequest
{
    [MinLength(1), MaxLength(40)]
    public string? DisplayName { get; init; }

    public DateOnly? BirthDate { get; init; }

    public Gender? Gender { get; init; }

    public Guid? AvatarId { get; init; }

    [MaxLength(GarmentCatalog.MaxPreferredStyles)]
    public StyleTag[]? Styles { get; init; }

    public ThermalPreference? ThermalPreference { get; init; }

    public ClothingSize? ClothingSize { get; init; }

    public LegLength? LegLength { get; init; }

    /// <summary>True goes back to "not set" for the usual size.</summary>
    public bool? ClearClothingSize { get; init; }

    /// <summary>True goes back to "not set" for the leg length.</summary>
    public bool? ClearLegLength { get; init; }

    public LocationRequest? Location { get; init; }

    /// <summary>True removes the stored weather place.</summary>
    public bool? ClearLocation { get; init; }

    /// <summary>True records consent to sending photos to external AI services; false withdraws it. A new account has none: the app asks right before the first photo is sent out.</summary>
    public bool? AiConsent { get; init; }

    /// <summary>The first step of the post-registration flow that is not finished yet (0 body shape, 1 fit, 2 colors, 3 recap). It never moves back.</summary>
    [Range(0, 3)]
    public int? OnboardingStep { get; init; }

    /// <summary>True marks the post-registration flow as done for this account.</summary>
    public bool? OnboardingDone { get; init; }
}

/// <summary><c>FigureUrl</c> is the silhouette as a whole figure on a transparent background (PNG, 3:4), for drawing an outfit on.</summary>
public sealed record AvatarResponse(Guid Id, Gender Gender, string BodyType, string Label, string ImageUrl, string ThumbUrl, string FigureUrl);

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
    ClothingSize? ClothingSize,
    LegLength? LegLength,
    LocationResponse? Location,
    DateTimeOffset? AiConsentAt,
    ColorAnalysisResponse? ColorAnalysis,
    int OnboardingStep,
    DateTimeOffset? OnboardingDoneAt,
    DateTimeOffset CreatedAt);

public sealed record ColorSwatchResponse(string Name, string Hex, Color? WardrobeColor);

/// <summary>The seasonal colour type of the person and its palette. <c>Best</c> are the colors to wear more of, <c>Soften</c> the ones to go easy on.</summary>
public sealed record ColorAnalysisResponse(
    ColorSeason Season,
    string Name,
    string Summary,
    ColorAnalysisSource Source,
    IReadOnlyList<ColorSwatchResponse> Best,
    IReadOnlyList<ColorSwatchResponse> Soften,
    DateTimeOffset AnalyzedAt);

public sealed class ColorAnswersRequest
{
    /// <summary>From 1 (very fair) to 8 (deep). The undertone is a separate answer.</summary>
    [Required, Range(1, ColorQuiz.SkinTones)]
    public int? SkinTone { get; init; }

    [Required]
    public SkinUndertone? Undertone { get; init; }

    [Required]
    public HairColor? Hair { get; init; }

    [Required]
    public EyeColor? Eyes { get; init; }
}

public sealed class AnalyzeColorsRequest
{
    /// <summary>The key returned by <c>POST /api/me/color-analysis/upload</c>, after the selfie was uploaded. Send this or <c>Answers</c>, not both.</summary>
    [MaxLength(120)]
    public string? Key { get; init; }

    public ColorAnswersRequest? Answers { get; init; }
}

public sealed record AuthResponse(string AccessToken, string RefreshToken, int ExpiresIn, UserResponse User);

public sealed record TokenResponse(string AccessToken, string RefreshToken, int ExpiresIn);

public sealed record PlaceResponse(string Name, string? Region, string? Country, double Lat, double Lon);

public sealed record HealthResponse(string Status);
