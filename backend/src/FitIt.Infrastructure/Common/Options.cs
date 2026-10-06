using System.ComponentModel.DataAnnotations;

namespace FitIt.Infrastructure.Common;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Zone in which a "day" starts and ends for limits, ages and wear dates.</summary>
    [Required]
    public string TimeZone { get; set; } = "Europe/Warsaw";

    /// <summary>Public address of the API, used to build absolute links to static files. Falls back to the request's own address.</summary>
    public string? PublicBaseUrl { get; set; }
}

public sealed class JwtOptions
{
    public const string Section = "Jwt";

    [Required]
    public string Issuer { get; set; } = "fitit";

    [Required]
    public string Audience { get; set; } = "fitit-app";

    /// <summary>HMAC key, at least 32 bytes. Comes from user-secrets or the environment, never from the repository.</summary>
    public string SigningKey { get; set; } = "";

    [Range(1, 120)]
    public int AccessTokenMinutes { get; set; } = 15;

    [Range(1, 365)]
    public int RefreshTokenDays { get; set; } = 30;
}

public sealed class AccountOptions
{
    public const string Section = "Account";

    /// <summary>Youngest age at which an account may be created.</summary>
    [Range(0, 120)]
    public int MinimumAge { get; set; } = 16;
}

/// <summary>Which implementation stands behind each port: a real provider or a deterministic fake.</summary>
public sealed class ProviderOptions
{
    public const string Section = "Providers";

    public const string Fake = "Fake";

    /// <summary>"OpenMeteo" or "Fake".</summary>
    public string LocationSearch { get; set; } = "OpenMeteo";

    /// <summary>"S3" or "Fake" (kept in memory: nothing a phone could upload to, for tests only).</summary>
    public string ImageStorage { get; set; } = "S3";

    /// <summary>"Fal" or "Fake" (the photo itself stands in for the cutout).</summary>
    public string BackgroundRemover { get; set; } = "Fake";

    /// <summary>"Claude" or "Fake" (tags picked from a fixed list of garments, not read from the photo).</summary>
    public string GarmentTagger { get; set; } = "Fake";

    /// <summary>Fakes are refused in Production unless this is set, so a misconfigured server cannot silently serve made-up data.</summary>
    public bool AllowFakesInProduction { get; set; }
}

/// <summary>Daily limits per person and the daily AI budget for everybody together (product spec 11.1).</summary>
public sealed class LimitOptions
{
    public const string Section = "Limits";

    [Range(0, 10_000)]
    public int ItemsPerDay { get; set; } = 50;

    [Range(0, 10_000)]
    public int SuggestionsPerDay { get; set; } = 20;

    [Range(0, 10_000)]
    public int VisualizationsPerDay { get; set; } = 5;

    /// <summary>Once the day's AI calls have cost this much, tagging waits for tomorrow and the stylist falls back to rules.</summary>
    [Range(0, 100_000)]
    public decimal AiBudgetUsdPerDay { get; set; } = 10m;
}

/// <summary>The S3-compatible file storage: Cloudflare R2 in production, a local server in development.</summary>
public sealed class StorageOptions
{
    public const string Section = "Storage";

    /// <summary>Address the API uses to reach storage.</summary>
    public string Endpoint { get; set; } = "";

    /// <summary>
    /// Address the phone uses, when it differs from <see cref="Endpoint"/> (a container name inside Docker is not reachable
    /// from a phone). Signed addresses are made for this host.
    /// </summary>
    public string? PublicEndpoint { get; set; }

    public string Bucket { get; set; } = "fitit";

    /// <summary>"auto" for R2.</summary>
    public string Region { get; set; } = "auto";

    public string AccessKey { get; set; } = "";

    public string SecretKey { get; set; } = "";

    /// <summary>Create the bucket at startup when it is missing. For local development; in production the bucket is made by hand.</summary>
    public bool CreateBucket { get; set; }

    /// <summary>Largest photo accepted, in bytes. The phone shrinks photos to about 300 kB before sending.</summary>
    [Range(1, 50_000_000)]
    public long MaxUploadBytes { get; set; } = 2_000_000;
}
