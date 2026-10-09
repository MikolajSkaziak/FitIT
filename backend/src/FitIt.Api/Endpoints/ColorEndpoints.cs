using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Infrastructure.Accounts;

namespace FitIt.Api.Endpoints;

internal static class ColorEndpoints
{
    public static IEndpointRouteBuilder MapColorEndpoints(this IEndpointRouteBuilder app)
    {
        var colors = app.MapGroup("/api/me/color-analysis").WithTags("Account").RequireAuthorization();
        colors.MapPost("/upload", CreateUpload).WithName("createSelfieUpload")
            .Produces<UploadResponse>().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429);
        colors.MapPost("", Analyze).WithName("analyzeColors")
            .Produces<ColorAnalysisResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401).ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        colors.MapGet("", Get).WithName("getColorAnalysis")
            .Produces<ColorAnalysisResponse>().ProducesProblem(401).ProducesProblem(404);
        colors.MapDelete("", Remove).WithName("deleteColorAnalysis")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401);
        return app;
    }

    private static async Task<IResult> CreateUpload(HttpContext http, ColorAnalysisService analysis, CancellationToken cancellationToken)
    {
        var ticket = await analysis.CreateUploadAsync(http.User.UserId(), cancellationToken);
        return ticket.IsOk
            ? TypedResults.Ok(new UploadResponse(ticket.Value.Key, ticket.Value.Url.AbsoluteUri, "PUT", ticket.Value.Headers, ticket.Value.ExpiresAt, analysis.MaxUploadBytes))
            : ticket.Error!.ToProblem();
    }

    private static async Task<IResult> Analyze(AnalyzeColorsRequest request, HttpContext http, ColorAnalysisService analysis, CancellationToken cancellationToken)
    {
        var quiz = request.Answers is { } answers ? new ColorQuiz(answers.SkinTone!.Value, answers.Undertone!.Value, answers.Hair!.Value, answers.Eyes!.Value) : null;
        var result = await analysis.AnalyzeAsync(http.User.UserId(), request.Key, quiz, cancellationToken);
        return result.IsOk ? TypedResults.Ok(ResponseMapper.Map(result.Value)) : result.Error!.ToProblem();
    }

    private static async Task<IResult> Get(HttpContext http, ColorAnalysisService analysis, CancellationToken cancellationToken) =>
        await analysis.GetAsync(http.User.UserId(), cancellationToken) is { } colors
            ? TypedResults.Ok(ResponseMapper.Map(colors))
            : ApiError.NotFound("color_analysis_missing", "No color analysis has been made yet.").ToProblem();

    private static async Task<IResult> Remove(HttpContext http, ColorAnalysisService analysis, CancellationToken cancellationToken)
    {
        await analysis.RemoveAsync(http.User.UserId(), cancellationToken);
        return TypedResults.NoContent();
    }
}
