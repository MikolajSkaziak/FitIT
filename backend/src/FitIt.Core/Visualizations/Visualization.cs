namespace FitIt.Core.Visualizations;

/// <summary>Where a visualization stands (product spec 7.5). The last three are final.</summary>
public enum VisualizationStatus
{
    /// <summary>Recorded and counted; the job has not sent the order to the provider yet.</summary>
    Pending,

    /// <summary>The provider has the order (its id is stored) and the image is being made.</summary>
    Running,

    Completed,

    /// <summary>The provider failed, the job could not use its answer, or no result came in time.</summary>
    Failed,

    /// <summary>The provider's safety filter refused. An ordinary outcome, not an error.</summary>
    Blocked,
}

/// <summary>Stable codes saying why a visualization did not come out; the app words them.</summary>
public static class VisualizationErrors
{
    public const string ContentBlocked = "content_blocked";
    public const string ProviderFailed = "provider_failed";
    public const string TimedOut = "timeout";
    public const string InvalidImage = "invalid_image";
    public const string BudgetExhausted = "budget_exhausted";
    public const string ConsentWithdrawn = "consent_withdrawn";
}

/// <summary>
/// One order for an image of an outfit on the person's silhouette. The row is the single record of the order: the
/// provider's request id is stored before anybody polls it, so a job that runs again resumes instead of ordering twice,
/// and <see cref="UsageDay"/> remembers which day's allowance paid for it, so a failure can give it back.
/// </summary>
public sealed class Visualization
{
    public const int IdempotencyKeyMaxLength = 64;

    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public Guid OutfitId { get; init; }

    /// <summary>The silhouette the outfit was shown on; the person may change theirs later, this record keeps the one used.</summary>
    public Guid AvatarId { get; init; }

    public VisualizationStatus Status { get; private set; } = VisualizationStatus.Pending;

    /// <summary>The provider's model, known once the order was sent.</summary>
    public string? Model { get; private set; }

    /// <summary>Version of the prompt template the order was made from; null until the order was sent.</summary>
    public string? PromptVersion { get; private set; }

    /// <summary>The provider's id of the order. Set (and saved) before the first poll.</summary>
    public string? ProviderRequestId { get; private set; }

    /// <summary>Storage key of the finished picture, under the person's prefix. Set with <see cref="VisualizationStatus.Completed"/>.</summary>
    public string? ImageKey { get; private set; }

    /// <summary>One of <see cref="VisualizationErrors"/> for a visualization that did not come out.</summary>
    public string? ErrorCode { get; private set; }

    /// <summary>The key the app sent with the request; the same key always means this record. Unique per person.</summary>
    public required string IdempotencyKey { get; init; }

    public decimal CostUsd { get; private set; }

    /// <summary>The day, as the person counts days, whose allowance this order used.</summary>
    public DateOnly UsageDay { get; init; }

    /// <summary>Tries at sending the order.</summary>
    public int Attempts { get; private set; }

    /// <summary>Setting it also starts <see cref="UpdatedAt"/>: an order that was just made has just been touched.</summary>
    public DateTimeOffset CreatedAt
    {
        get;
        init
        {
            field = value;
            UpdatedAt = value;
        }
    }

    /// <summary>When the record last changed. The sweep for stuck orders looks at this.</summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>When the provider accepted the order; the time limit runs from here.</summary>
    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public bool IsFinal => Status is VisualizationStatus.Completed or VisualizationStatus.Failed or VisualizationStatus.Blocked;

    public void BeginAttempt(DateTimeOffset now)
    {
        Attempts++;
        UpdatedAt = now;
    }

    /// <summary>The provider accepted the order: from now on the job polls instead of ordering.</summary>
    public void MarkSubmitted(string providerRequestId, string model, string promptVersion, DateTimeOffset now)
    {
        ProviderRequestId = providerRequestId;
        Model = model;
        PromptVersion = promptVersion;
        Status = VisualizationStatus.Running;
        StartedAt = now;
        UpdatedAt = now;
    }

    /// <summary>A poll that found the image still being made.</summary>
    public void Touch(DateTimeOffset now) => UpdatedAt = now;
}

/// <summary>Why a person reported a try-on picture. The codes travel as snake case (<c>wrong_clothes</c>).</summary>
public enum ReportReason
{
    WrongClothes,
    Distorted,

    /// <summary>The picture is taken off the person's screen at once and its file is deleted.</summary>
    Inappropriate,

    Other,
}

/// <summary>
/// A person's report about one try-on picture. The picture id is kept as a plain value, not a foreign key: an inappropriate
/// picture is deleted at once, and the report has to outlive it.
/// </summary>
public sealed class VisualizationReport
{
    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public Guid VisualizationId { get; init; }

    public Guid OutfitId { get; init; }

    public ReportReason Reason { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
