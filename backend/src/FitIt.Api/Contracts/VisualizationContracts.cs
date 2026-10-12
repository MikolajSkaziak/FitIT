using FitIt.Core.Visualizations;

namespace FitIt.Api.Contracts;

/// <summary>
/// One order for an image of an outfit on the person's silhouette. While <c>Status</c> is <c>pending</c> or <c>running</c>,
/// ask again every two to three seconds. <c>completed</c> has an <c>ImageUrl</c> (signed, valid an hour; cache the picture
/// under <c>ImageKey</c>, which does not change). <c>blocked</c> and <c>failed</c> have an <c>ErrorCode</c>
/// (<c>content_blocked</c>, <c>provider_failed</c>, <c>timeout</c>, <c>invalid_image</c>, <c>budget_exhausted</c>,
/// <c>consent_withdrawn</c>), and the day's allowance was given back. The collage of the outfit stays the faithful picture.
/// </summary>
public sealed record VisualizationResponse(
    Guid Id,
    Guid OutfitId,
    VisualizationStatus Status,
    string? ImageUrl,
    string? ImageKey,
    string? ErrorCode,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);

/// <summary>The newest visualization of an outfit, as much of it as a list of outfits needs. Fetch <c>GET /api/visualizations/{id}</c> for the rest.</summary>
public sealed record OutfitVisualizationResponse(Guid Id, VisualizationStatus Status, string? ImageUrl, string? ImageKey);

/// <summary>
/// A problem with a finished try-on picture. <c>Reason</c> is one of <c>wrong_clothes</c>, <c>distorted</c>,
/// <c>inappropriate</c>, <c>other</c>. An <c>inappropriate</c> report also deletes the picture.
/// </summary>
public sealed class ReportVisualizationRequest
{
    public required ReportReason Reason { get; init; }
}
