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

    /// <summary>How long a code for resetting the password stays valid.</summary>
    [Range(1, 1440)]
    public int ResetCodeMinutes { get; set; } = 15;

    /// <summary>Wrong guesses after which a code is dead. A six digit code is guessable, so this is what protects it.</summary>
    [Range(1, 100)]
    public int ResetCodeAttempts { get; set; } = 5;

    /// <summary>Codes sent to one address within an hour; further requests are answered like the first but send nothing.</summary>
    [Range(1, 1000)]
    public int ResetRequestsPerHour { get; set; } = 3;
}

/// <summary>Which implementation stands behind each port: a real provider or a deterministic fake.</summary>
public sealed class ProviderOptions
{
    public const string Section = "Providers";

    public const string Fake = "Fake";

    public const string Gemini = "Gemini";

    public const string Fal = "Fal";

    /// <summary>"OpenMeteo" or "Fake".</summary>
    public string LocationSearch { get; set; } = "OpenMeteo";

    /// <summary>"OpenMeteo" or "Fake" (the same mild day everywhere, set by tests).</summary>
    public string Weather { get; set; } = "OpenMeteo";

    /// <summary>"S3" or "Fake" (kept in memory: nothing a phone could upload to, for tests only).</summary>
    public string ImageStorage { get; set; } = "S3";

    /// <summary>"Fal" or "Fake" (the photo itself stands in for the cutout).</summary>
    public string BackgroundRemover { get; set; } = "Fake";

    /// <summary>"Gemini" or "Fake" (tags picked from a fixed list of garments, not read from the photo).</summary>
    public string GarmentTagger { get; set; } = "Fake";

    /// <summary>"Gemini" or "Fake" (valid outfits composed by the rules, the same for the same candidates).</summary>
    public string OutfitStylist { get; set; } = "Fake";

    /// <summary>"Gemini" or "Fake" (tips from the rules: the same garments always get the same sentences).</summary>
    public string OutfitCritic { get; set; } = "Fake";

    /// <summary>"Gemini" or "Fake" (answers from the rules: outfits by the rule-based stylist, gaps and purchases from the computed facts).</summary>
    public string StylistChat { get; set; } = "Fake";

    /// <summary>"Fal" or "Fake" (answers after a few polls with the person's silhouette as the picture).</summary>
    public string OutfitVisualizer { get; set; } = "Fake";

    /// <summary>"Gemini" or "Fake" (the type comes from the questions, or from a hash of the photo's bytes; the photo is not looked at).</summary>
    public string ColorAnalyst { get; set; } = "Fake";

    /// <summary>"Smtp" or "Fake" (messages are kept in memory and only their existence is logged).</summary>
    public string Email { get; set; } = "Fake";

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

    /// <summary>Colour analyses per person per day, whether from a photo or from the questions.</summary>
    [Range(0, 10_000)]
    public int ColorAnalysesPerDay { get; set; } = 3;

    /// <summary>Requests for tips on a self-built outfit per person per day.</summary>
    [Range(0, 10_000)]
    public int TipsPerDay { get; set; } = 20;

    /// <summary>Messages to the stylist chat per person per day.</summary>
    [Range(0, 10_000)]
    public int StylistMessagesPerDay { get; set; } = 30;

    /// <summary>Once the day's AI calls have cost this much, tagging waits for tomorrow and the stylist falls back to rules.</summary>
    [Range(0, 100_000)]
    public decimal AiBudgetUsdPerDay { get; set; } = 10m;
}

/// <summary>How a visualization is ordered, waited for and given up on (product spec 7.5 and 13).</summary>
public sealed class VisualizationOptions
{
    public const string Section = "Visualization";

    /// <summary>Seconds between two questions to the provider about the same order.</summary>
    [Range(0, 60)]
    public double PollIntervalSeconds { get; set; } = 3;

    /// <summary>Seconds after which an order without a result counts as failed and the day's allowance is given back.</summary>
    [Range(1, 3600)]
    public int TimeLimitSeconds { get; set; } = 180;

    /// <summary>The fake provider's answers: how many polls it keeps an order queued before it is done.</summary>
    [Range(0, 100)]
    public int FakePollsBeforeDone { get; set; } = 2;

    public TimeSpan PollInterval => TimeSpan.FromSeconds(PollIntervalSeconds);

    public TimeSpan TimeLimit => TimeSpan.FromSeconds(TimeLimitSeconds);
}

/// <summary>
/// The file storage: Cloudflare R2 in production, a local S3-compatible server in development. R2 speaks the S3
/// protocol, so one client serves both; only the address and the credentials differ.
/// </summary>
public sealed class StorageOptions
{
    public const string Section = "Storage";

    /// <summary>
    /// Cloudflare account id. Set this (instead of <see cref="Endpoint"/>) to use R2: the address is built from it.
    /// Found in the Cloudflare dashboard next to the R2 bucket.
    /// </summary>
    public string? AccountId { get; set; }

    /// <summary>
    /// Where R2 keeps the objects. "eu" pins them to the European Union, which is what the privacy section promises.
    /// Empty means no jurisdiction. Used only together with <see cref="AccountId"/>.
    /// </summary>
    public string? Jurisdiction { get; set; } = "eu";

    /// <summary>Address the API uses to reach storage. Set it for a local server; for R2 set <see cref="AccountId"/> instead.</summary>
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

    /// <summary>The address to talk to: the explicit endpoint, or the R2 one built from the account id.</summary>
    public string ResolvedEndpoint => string.IsNullOrWhiteSpace(Endpoint) ? R2Endpoint() : Endpoint;

    /// <summary>True when storage is Cloudflare R2 rather than a server of our own.</summary>
    public bool UsesR2 => string.IsNullOrWhiteSpace(Endpoint) && !string.IsNullOrWhiteSpace(AccountId);

    /// <summary>
    /// R2's S3 address: <c>https://{account}.r2.cloudflarestorage.com</c>, with the jurisdiction in the middle when one
    /// is set (<c>https://{account}.eu.r2.cloudflarestorage.com</c>).
    /// </summary>
    private string R2Endpoint()
    {
        if (string.IsNullOrWhiteSpace(AccountId))
        {
            return "";
        }

        var jurisdiction = string.IsNullOrWhiteSpace(Jurisdiction) ? "" : $"{Jurisdiction.Trim().ToLowerInvariant()}.";
        return $"https://{AccountId.Trim()}.{jurisdiction}r2.cloudflarestorage.com";
    }

    /// <summary>Largest photo accepted, in bytes. The phone shrinks photos to about 300 kB before sending.</summary>
    [Range(1, 50_000_000)]
    public long MaxUploadBytes { get; set; } = 2_000_000;
}

/// <summary>
/// Google's Gemini API: describing garments, proposing outfits, tips and the colour analysis. The key comes from user-secrets
/// (<c>Gemini:ApiKey</c>) or the environment (<c>Gemini__ApiKey</c>), never from the repository, and travels only in a request header.
/// </summary>
public sealed class GeminiOptions
{
    public const string Section = "Gemini";

    public string ApiKey { get; set; } = "";

    [Required]
    [RegularExpression("^[a-z0-9.-]+$")]
    public string Model { get; set; } = "gemini-3.8-flash";

    /// <summary>Asked when <see cref="Model"/> keeps answering 429 or 503. Empty: no second model.</summary>
    [RegularExpression("^[a-z0-9.-]*$")]
    public string FallbackModel { get; set; } = "gemini-flash-lite-latest";

    /// <summary>Seconds one question may take, all retries and the fallback model included.</summary>
    [Range(1, 600)]
    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>Seconds one try may take before it is given up and the next one starts.</summary>
    [Range(1, 600)]
    public int AttemptTimeoutSeconds { get; set; } = 20;

    /// <summary>How many times a model is asked again after 429, 500, 503 or 504 before the next model is tried.</summary>
    [Range(0, 5)]
    public int MaxRetries { get; set; } = 2;

    /// <summary>The pause before the first retry, in milliseconds; each further one is twice as long.</summary>
    [Range(0, 60_000)]
    public int RetryBaseDelayMs { get; set; } = 800;

    /// <summary>"minimal", "low", "medium" or "high"; empty leaves the model's default.</summary>
    [RegularExpression("^[a-z]*$")]
    public string ThinkingLevel { get; set; } = "";

    /// <summary>The thinking level of the stylist chat, which answers while the person waits. The main model takes "low" at the least; empty leaves the model's default.</summary>
    [RegularExpression("^[a-z]*$")]
    public string ChatThinkingLevel { get; set; } = "low";

    /// <summary>The most tokens one chat answer may take, thinking included; an answer cut short fails and the rules reply instead.</summary>
    [Range(256, 65_536)]
    public int ChatMaxOutputTokens { get; set; } = 4096;

    // Paid-tier prices in USD per million tokens (ai.google.dev/gemini-api/docs/pricing, read 2026-10-09). Output includes thinking.
    [Range(0, 1000)]
    public decimal InputUsdPerMillionTokens { get; set; } = 0.75m;

    [Range(0, 1000)]
    public decimal OutputUsdPerMillionTokens { get; set; } = 3.75m;

    [Range(0, 1000)]
    public decimal FallbackInputUsdPerMillionTokens { get; set; } = 0.30m;

    [Range(0, 1000)]
    public decimal FallbackOutputUsdPerMillionTokens { get; set; } = 2.50m;

    public TimeSpan Timeout => TimeSpan.FromSeconds(TimeoutSeconds);
}

/// <summary>
/// fal.ai's queue: background removal and the picture of an outfit on the figure. The key comes from user-secrets
/// (<c>Fal:ApiKey</c>) or the environment (<c>Fal__ApiKey</c>), never from the repository, and travels only in a request header.
/// </summary>
public sealed class FalOptions
{
    public const string Section = "Fal";

    public string ApiKey { get; set; } = "";

    [Required]
    [RegularExpression("^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$")]
    public string BackgroundRemovalEndpoint { get; set; } = "fal-ai/birefnet/v2";

    [Required]
    [RegularExpression("^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$")]
    public string TryOnEndpoint { get; set; } = "fal-ai/nano-banana-2/edit";

    /// <summary>The figure pictures are 3:4.</summary>
    public string AspectRatio { get; set; } = "3:4";

    public string Resolution { get; set; } = "1K";

    /// <summary>What one finished picture on the figure costs at <see cref="Resolution"/>.</summary>
    [Range(0, 100)]
    public decimal TryOnUsdPerImage { get; set; } = 0.08m;

    /// <summary>An estimate: fal bills background removal by compute time, a fraction of a cent per photo.</summary>
    [Range(0, 100)]
    public decimal BackgroundRemovalUsdPerImage { get; set; } = 0.005m;

    /// <summary>Seconds a background removal may take from order to picture.</summary>
    [Range(1, 600)]
    public int BackgroundRemovalTimeoutSeconds { get; set; } = 60;

    /// <summary>Milliseconds between two questions about a background removal. (Visualizations are polled by their job, see <see cref="VisualizationOptions"/>.)</summary>
    [Range(0, 60_000)]
    public int PollIntervalMs { get; set; } = 1000;

    /// <summary>
    /// False: pictures are read from storage and sent inside the request (works when storage is on localhost). True: fal is
    /// given the short-lived signed addresses and fetches them itself, which needs storage reachable from the internet (R2).
    /// </summary>
    public bool SendSignedUrls { get; set; }

    /// <summary>Sends <c>X-Fal-Store-IO: 0</c>, asking fal not to keep the request and its result. Check with a real key that results still arrive before switching on.</summary>
    public bool DisablePayloadStorage { get; set; }
}
