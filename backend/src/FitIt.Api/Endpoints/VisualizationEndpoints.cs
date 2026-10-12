using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Common;
using FitIt.Core.Visualizations;
using FitIt.Infrastructure.Visualizations;
using Microsoft.AspNetCore.Mvc;

namespace FitIt.Api.Endpoints;

internal static class VisualizationEndpoints
{
    public const string IdempotencyHeader = "Idempotency-Key";
    public const string ReportRateLimit = "report";

    private static readonly ApiError KeyInvalid =
        ApiError.BadRequest("idempotency_key_invalid", $"The {IdempotencyHeader} header must hold 8 to {Visualization.IdempotencyKeyMaxLength} letters, digits, dashes or underscores.");

    public static IEndpointRouteBuilder MapVisualizationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/outfits/{id:guid}/visualizations", Create)
            .WithTags("Visualizations").WithName("createVisualization").RequireAuthorization()
            .Produces<VisualizationResponse>(StatusCodes.Status202Accepted).Produces<VisualizationResponse>()
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(409).ProducesProblem(429).ProducesProblem(503);

        app.MapGet("/api/visualizations/{id:guid}", Get)
            .WithTags("Visualizations").WithName("getVisualization").RequireAuthorization()
            .Produces<VisualizationResponse>().ProducesProblem(401).ProducesProblem(404);

        app.MapPost("/api/visualizations/{id:guid}/reports", Report)
            .WithTags("Visualizations").WithName("reportVisualization").RequireAuthorization().RequireRateLimiting(ReportRateLimit)
            .Produces(StatusCodes.Status204NoContent).ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404).ProducesProblem(409).ProducesProblem(429);

        return app;
    }

    /// <summary>204. The report is stored; <c>inappropriate</c> also deletes the picture, so the outfit comes back without a try-on.</summary>
    private static async Task<IResult> Report(Guid id, ReportVisualizationRequest request, HttpContext http, VisualizationReportService reports)
    {
        var reported = await reports.ReportAsync(http.User.UserId(), id, request.Reason, http.RequestAborted);
        return reported.IsOk ? TypedResults.NoContent() : reported.Error!.ToProblem();
    }

    /// <summary>
    /// 202 with a new order. 200 with the order that already exists when the same <c>Idempotency-Key</c> is sent again, or
    /// when this outfit already has an order in progress: neither is counted again.
    /// </summary>
    private static async Task<IResult> Create(
        Guid id,
        [FromHeader(Name = IdempotencyHeader)] string idempotencyKey,
        HttpContext http,
        VisualizationService visualizations,
        VisualizationMapper mapper)
    {
        if (!IsValid(idempotencyKey))
        {
            return KeyInvalid.ToProblem();
        }

        var requested = await visualizations.RequestAsync(http.User.UserId(), id, idempotencyKey, http.RequestAborted);
        if (!requested.IsOk)
        {
            return requested.Error!.ToProblem();
        }

        var response = mapper.Map(requested.Value.Item);
        return requested.Value.Created ? TypedResults.Accepted($"/api/visualizations/{response.Id}", response) : TypedResults.Ok(response);
    }

    private static async Task<IResult> Get(Guid id, HttpContext http, VisualizationService visualizations, VisualizationMapper mapper)
    {
        var found = await visualizations.GetAsync(http.User.UserId(), id, http.RequestAborted);
        return found.IsOk ? TypedResults.Ok(mapper.Map(found.Value)) : found.Error!.ToProblem();
    }

    private static bool IsValid(string key) =>
        key.Length is >= 8 and <= Visualization.IdempotencyKeyMaxLength && key.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_');
}

/// <summary>Shapes a visualization for the app, with a freshly signed address for its picture once there is one.</summary>
internal sealed class VisualizationMapper(VisualizationService visualizations)
{
    public VisualizationResponse Map(Visualization visualization) => new(
        visualization.Id,
        visualization.OutfitId,
        visualization.Status,
        visualizations.ImageUrl(visualization)?.AbsoluteUri,
        visualization.Status == VisualizationStatus.Completed ? visualization.ImageKey : null,
        visualization.ErrorCode,
        visualization.CreatedAt,
        visualization.CompletedAt);

    public OutfitVisualizationResponse Summarize(Visualization visualization) => new(
        visualization.Id,
        visualization.Status,
        visualizations.ImageUrl(visualization)?.AbsoluteUri,
        visualization.Status == VisualizationStatus.Completed ? visualization.ImageKey : null);
}
