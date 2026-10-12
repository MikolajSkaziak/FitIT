using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Infrastructure.Styling;
using Microsoft.AspNetCore.Mvc;

namespace FitIt.Api.Endpoints;

internal static class OutfitEndpoints
{
    private static readonly ApiError WearCannotBeUndone =
        ApiError.BadRequest("wear_cannot_be_undone", "Wearing an outfit can be recorded but not taken back; send worn: true or leave it out.");

    public static IEndpointRouteBuilder MapOutfitEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/outfits/suggestions", Suggest)
            .WithTags("Stylist").WithName("suggestOutfits").RequireAuthorization()
            .Produces<SuggestionsResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401).ProducesProblem(409).ProducesProblem(429).ProducesProblem(503);

        app.MapPost("/api/outfits/suggestions/today", Today)
            .WithTags("Stylist").WithName("getTodaysOutfits").RequireAuthorization()
            .Produces<SuggestionsResponse>().ProducesValidationProblem().ProducesProblem(401).ProducesProblem(409).ProducesProblem(429).ProducesProblem(503);

        var outfits = app.MapGroup("/api/outfits").WithTags("Outfits").RequireAuthorization();
        outfits.MapPost("", Create).WithName("createOutfit")
            .Produces<OutfitResponse>(StatusCodes.Status201Created).ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401);
        outfits.MapPost("/tips", Tips).WithName("getOutfitTips")
            .Produces<OutfitTipsResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401).ProducesProblem(429);
        outfits.MapGet("", List).WithName("listOutfits")
            .Produces<IReadOnlyList<OutfitResponse>>().ProducesProblem(401);
        outfits.MapGet("/{id:guid}", Get).WithName("getOutfit")
            .Produces<OutfitResponse>().ProducesProblem(401).ProducesProblem(404);
        outfits.MapPatch("/{id:guid}", Update).WithName("updateOutfit")
            .Produces<OutfitResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401).ProducesProblem(404);
        outfits.MapDelete("/{id:guid}", Delete).WithName("deleteOutfit")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401).ProducesProblem(404);

        return app;
    }

    private static async Task<IResult> Suggest(SuggestOutfitsRequest request, HttpContext http, StylistService stylist, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var suggested = await stylist.SuggestAsync(http.User.UserId(), request.Occasion!.Value, request.Note, request.BaseItemId, cancellationToken, day: request.Date);
        return await AnswerAsync(suggested, mapper, cancellationToken);
    }

    /// <summary>Today's picks for an occasion: the stored set, or a new one when there is none yet or a fresh one is asked for.</summary>
    private static async Task<IResult> Today(TodaysOutfitsRequest request, HttpContext http, StylistService stylist, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var picks = await stylist.TodayAsync(http.User.UserId(), request.Occasion!.Value, request.Fresh, cancellationToken);
        return await AnswerAsync(picks, mapper, cancellationToken);
    }

    private static async Task<IResult> AnswerAsync(Result<Suggestions> suggested, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        if (!suggested.IsOk)
        {
            return suggested.Error!.ToProblem();
        }

        var answer = suggested.Value;
        return TypedResults.Ok(new SuggestionsResponse(
            answer.Missing.Count > 0 || answer.MissingEither.Count > 0 ? SuggestionStatus.MissingGarments : SuggestionStatus.Proposed,
            answer.Weather.Day,
            answer.Missing,
            answer.MissingEither,
            answer.Fallback,
            answer.Occasion,
            WeatherEndpoints.Shape(answer.Weather),
            [.. answer.Relaxations.Select(relaxation => new RelaxationResponse(relaxation.Role, relaxation.Rule))],
            answer.Umbrella,
            await mapper.MapAsync(answer.Outfits, cancellationToken)));
    }

    private static async Task<IResult> Create(CreateOutfitRequest request, HttpContext http, OutfitBuilderService builder, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var created = await builder.CreateAsync(http.User.UserId(), request.Items!, request.Occasion, request.Name, request.Saved ?? true, request.DraftId, request.Layout is { } layout ? [.. layout.Select(placement => placement.ToPlacement())] : null,
            request.FigureLayout is { } figureLayout ? [.. figureLayout.Select(placement => placement.ToPlacement())] : null, cancellationToken);
        if (!created.IsOk)
        {
            return created.Error!.ToProblem();
        }

        var response = await mapper.MapAsync(created.Value, cancellationToken);
        return TypedResults.Created($"/api/outfits/{response.Id}", response);
    }

    private static async Task<IResult> Tips(OutfitTipsRequest request, HttpContext http, OutfitBuilderService builder, CancellationToken cancellationToken)
    {
        var tips = await builder.TipsAsync(http.User.UserId(), request.Items!, request.Occasion, cancellationToken);
        return tips.IsOk
            ? TypedResults.Ok(new OutfitTipsResponse(tips.Value.Positives, [.. tips.Value.Improvements.Select(item => new OutfitImprovementResponse(item.Code, item.Text))], tips.Value.Score))
            : tips.Error!.ToProblem();
    }

    private static async Task<IResult> List([FromQuery] bool? saved, HttpContext http, OutfitService outfits, OutfitMapper mapper, CancellationToken cancellationToken) =>
        TypedResults.Ok(await mapper.MapAsync(await outfits.ListAsync(http.User.UserId(), saved, cancellationToken), cancellationToken));

    private static async Task<IResult> Get(Guid id, HttpContext http, OutfitService outfits, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var found = await outfits.GetAsync(http.User.UserId(), id, cancellationToken);
        return found.IsOk ? TypedResults.Ok(await mapper.MapAsync(found.Value, cancellationToken)) : found.Error!.ToProblem();
    }

    private static async Task<IResult> Update(Guid id, UpdateOutfitRequest request, HttpContext http, OutfitService outfits, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        if (request.Worn == false)
        {
            return WearCannotBeUndone.ToProblem();
        }

        var patch = new OutfitPatch(request.Saved, request.Rating, request.Worn == true, request.LayoutGiven, request.Layout is { } layout ? [.. layout.Select(placement => placement.ToPlacement())] : null,
            request.FigureLayoutGiven, request.FigureLayout is { } figureLayout ? [.. figureLayout.Select(placement => placement.ToPlacement())] : null);
        var updated = await outfits.UpdateAsync(http.User.UserId(), id, patch, cancellationToken);
        return updated.IsOk ? TypedResults.Ok(await mapper.MapAsync(updated.Value, cancellationToken)) : updated.Error!.ToProblem();
    }

    private static async Task<IResult> Delete(Guid id, HttpContext http, OutfitService outfits, CancellationToken cancellationToken)
    {
        var deleted = await outfits.DeleteAsync(http.User.UserId(), id, cancellationToken);
        return deleted.IsOk ? TypedResults.NoContent() : deleted.Error!.ToProblem();
    }
}

/// <summary>Shapes an outfit for the app: its garments come with freshly signed picture addresses, like everywhere else.</summary>
internal sealed class OutfitMapper(ClothingMapper clothes, VisualizationMapper visualizations)
{
    public async Task<IReadOnlyList<OutfitResponse>> MapAsync(IReadOnlyList<OutfitView> views, CancellationToken cancellationToken)
    {
        // The garments of all the outfits are shaped in one go, so their extra photos are read once.
        var garments = await clothes.MapAsync([.. views.SelectMany(view => view.Garments).DistinctBy(garment => garment.Id)], cancellationToken);
        return [.. views.Select(view => Map(view, garments))];
    }

    public async Task<OutfitResponse> MapAsync(OutfitView view, CancellationToken cancellationToken) =>
        Map(view, await clothes.MapAsync(view.Garments, cancellationToken));

    private OutfitResponse Map(OutfitView view, IReadOnlyList<ClothingResponse> garments)
    {
        var outfit = view.Outfit;
        var items = new List<OutfitItemResponse>(view.Garments.Count);
        foreach (var garment in view.Garments)
        {
            items.Add(new OutfitItemResponse(outfit.Items.First(item => item.ClothingItemId == garment.Id).Slot, garments.First(mapped => mapped.Id == garment.Id)));
        }

        var weather = outfit.Weather;
        return new OutfitResponse(
            outfit.Id,
            outfit.RequestId,
            outfit.Occasion,
            outfit.OccasionNote,
            outfit.Name,
            outfit.Kind,
            outfit.Style,
            outfit.Score,
            outfit.Reasoning,
            outfit.WeatherNote,
            outfit.Umbrella,
            [.. outfit.Relaxations.Select(Outfit.ParseRelaxation).Select(relaxation => new RelaxationResponse(relaxation.Role, relaxation.Rule))],
            outfit.Source,
            outfit.Rating,
            outfit.IsSaved,
            outfit.WornOn,
            weather is null
                ? null
                : new OutfitWeatherResponse(
                    weather.Place, weather.ForTomorrow, weather.From, weather.To, WeatherEndpoints.Whole(weather.FeelsMin), WeatherEndpoints.Whole(weather.FeelsMax),
                    weather.Sky, weather.Rain, weather.RainProbability, weather.NeedsLayers, weather.Band),
            items,
            view.Visualization is { } visualization ? visualizations.Summarize(visualization) : null,
            outfit.Layout is { } layout ? [.. layout.Select(placement => new OutfitPlacementResponse(placement.ClothingId, placement.X, placement.Y, placement.Scale, placement.Z))] : null,
            outfit.FigureLayout is { } figureLayout ? [.. figureLayout.Select(placement => new OutfitPlacementResponse(placement.ClothingId, placement.X, placement.Y, placement.Scale, placement.Z))] : null,
            outfit.CreatedAt);
    }
}
