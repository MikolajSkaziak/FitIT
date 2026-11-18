namespace FitIt.Core.Usage;

/// <summary>The things a person can do a limited number of times a day (product spec 11.1).</summary>
public enum UsageKind
{
    ItemAdded,
    Suggestion,
    Visualization,
    ColorAnalysis,

    /// <summary>Tips on an outfit the person built themselves.</summary>
    Tips,

    /// <summary>Messages to the person's stylist in the chat.</summary>
    StylistChat,
}

/// <summary>Calls to AI providers that cost money; each one is written to the usage log.</summary>
public enum AiOperation
{
    BackgroundRemoval,
    Tagging,
    Styling,
    Visualization,
    ColorAnalysis,
    Critique,
    StylistChat,
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

    /// <summary>Tokens of the request, as the provider counted them; null when the provider reports none.</summary>
    public int? InputTokens { get; init; }

    /// <summary>Tokens of the answer, without the model's thinking.</summary>
    public int? OutputTokens { get; init; }

    /// <summary>Tokens the model spent thinking; they are charged like output.</summary>
    public int? ThoughtTokens { get; init; }

    public int DurationMs { get; init; }

    public bool Success { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
