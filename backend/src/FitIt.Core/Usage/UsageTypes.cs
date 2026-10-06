namespace FitIt.Core.Usage;

/// <summary>The three things a person can do a limited number of times a day (product spec 11.1).</summary>
public enum UsageKind
{
    ItemAdded,
    Suggestion,
    Visualization,
}

/// <summary>Calls to AI providers that cost money; each one is written to the usage log.</summary>
public enum AiOperation
{
    BackgroundRemoval,
    Tagging,
    Styling,
    Visualization,
}

public sealed class UsageCounter
{
    public Guid UserId { get; init; }

    public DateOnly Day { get; init; }

    public UsageKind Kind { get; init; }

    public int Count { get; set; }
}

public sealed class AiUsageEntry
{
    public Guid Id { get; init; }

    /// <summary>Null once the person's account is gone; the cost history stays.</summary>
    public Guid? UserId { get; init; }

    public AiOperation Operation { get; init; }

    public required string Model { get; init; }

    public decimal CostUsd { get; init; }

    public int DurationMs { get; init; }

    public bool Success { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
