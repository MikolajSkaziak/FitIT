using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Wardrobe;
using Microsoft.AspNetCore.Mvc;

namespace FitIt.Api.Endpoints;

internal static class WardrobeEndpoints
{
    private static readonly DictionariesResponse Dictionaries = new(
        [.. Enum.GetValues<Category>().Select(category => new CategoryEntry(
            category,
            GarmentCatalog.Label(category),
            [.. GarmentCatalog.TypesOf(category).Select(type => new TypeEntry(type, GarmentCatalog.Label(type)))]))],
        [.. Enum.GetValues<Color>().Select(color => new ColorEntry(color, GarmentCatalog.Label(color), GarmentCatalog.IsNeutral(color)))],
        [.. Enum.GetValues<Pattern>().Select(pattern => new PatternEntry(pattern, GarmentCatalog.Label(pattern)))],
        [.. Enum.GetValues<Material>().Select(material => new MaterialEntry(material, GarmentCatalog.Label(material)))],
        [.. Enum.GetValues<StyleTag>().Select(style => new StyleEntry(style, GarmentCatalog.Label(style)))],
        [.. GarmentCatalog.FormalityLabels.Select((label, index) => new ScaleEntry(index + 1, label))],
        [.. GarmentCatalog.WarmthLabels.Select((label, index) => new ScaleEntry(index + 1, label))]);

    public static IEndpointRouteBuilder MapWardrobeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/dictionaries", () => TypedResults.Ok(Dictionaries))
            .WithTags("Szafa").WithName("getDictionaries")
            .Produces<DictionariesResponse>();

        app.MapGet("/api/me/usage", GetUsage)
            .WithTags("Konto").WithName("getUsage").RequireAuthorization()
            .Produces<UsageResponse>().ProducesProblem(401);

        app.MapPost("/api/uploads", CreateUpload)
            .WithTags("Szafa").WithName("createUpload").RequireAuthorization()
            .Produces<UploadResponse>().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429);

        var clothes = app.MapGroup("/api/clothes").WithTags("Szafa").RequireAuthorization();
        clothes.MapPost("", Add).WithName("addClothing")
            .Produces<ClothingResponse>(StatusCodes.Status201Created).Produces<ClothingResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429);
        clothes.MapGet("", List).WithName("listClothes")
            .Produces<IReadOnlyList<ClothingResponse>>().ProducesProblem(400).ProducesProblem(401);
        clothes.MapGet("/stats", Stats).WithName("getWardrobeStats")
            .Produces<WardrobeStatsResponse>().ProducesProblem(401);
        clothes.MapGet("/{id:guid}", Get).WithName("getClothing")
            .Produces<ClothingResponse>().ProducesProblem(401).ProducesProblem(404);
        clothes.MapPatch("/{id:guid}", Update).WithName("updateClothing")
            .Produces<ClothingResponse>().ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404).ProducesProblem(409);
        clothes.MapDelete("/{id:guid}", Delete).WithName("deleteClothing")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401).ProducesProblem(404);
        clothes.MapPost("/{id:guid}/reprocess", Reprocess).WithName("reprocessClothing")
            .Produces<ClothingResponse>().ProducesProblem(401).ProducesProblem(403).ProducesProblem(404);

        return app;
    }

    private static async Task<IResult> GetUsage(HttpContext http, UsageCounters usage, CancellationToken cancellationToken)
    {
        var snapshot = await usage.ReadAsync(http.User.UserId(), cancellationToken);
        UsageLineResponse Line(UsageKind kind) => new(snapshot[kind].Used, snapshot[kind].Limit);
        return TypedResults.Ok(new UsageResponse(Line(UsageKind.ItemAdded), Line(UsageKind.Suggestion), Line(UsageKind.Visualization), snapshot.ResetsAt));
    }

    private static async Task<IResult> CreateUpload(HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var ticket = await wardrobe.CreateUploadAsync(http.User.UserId(), cancellationToken);
        return ticket.IsOk
            ? TypedResults.Ok(new UploadResponse(ticket.Value.Key, ticket.Value.Url.AbsoluteUri, "PUT", ticket.Value.Headers, ticket.Value.ExpiresAt, wardrobe.MaxUploadBytes))
            : ticket.Error!.ToProblem();
    }

    private static async Task<IResult> Add(AddClothingRequest request, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var added = await wardrobe.AddAsync(http.User.UserId(), request.Key, cancellationToken);
        if (!added.IsOk)
        {
            return added.Error!.ToProblem();
        }

        var response = mapper.Map(added.Value.Item);
        return added.Value.Created ? TypedResults.Created($"/api/clothes/{response.Id}", response) : TypedResults.Ok(response);
    }

    private static async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? category,
        [FromQuery] bool? forgotten,
        [FromQuery] string? ids,
        HttpContext http,
        WardrobeService wardrobe,
        ClothingMapper mapper,
        CancellationToken cancellationToken)
    {
        Category? wantedCategory = null;
        if (category is not null)
        {
            if (!EnumCodes.TryParse<Category>(category, out var parsed))
            {
                return ApiError.BadRequest("category_invalid", "The category is not on the list.").ToProblem();
            }

            wantedCategory = parsed;
        }

        List<Guid>? wantedIds = null;
        if (ids is not null)
        {
            wantedIds = [];
            foreach (var part in ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!Guid.TryParse(part, out var id) || wantedIds.Count == WardrobeService.MaxIds)
                {
                    return ApiError.BadRequest("ids_invalid", $"Give at most {WardrobeService.MaxIds} garment ids separated by commas.").ToProblem();
                }

                wantedIds.Add(id);
            }
        }

        if (q is { Length: > 80 })
        {
            return ApiError.BadRequest("query_invalid", "The search text is too long.").ToProblem();
        }

        var found = await wardrobe.ListAsync(
            http.User.UserId(),
            new ClothingQuery { Search = q, Category = wantedCategory, Forgotten = forgotten == true, Ids = wantedIds },
            cancellationToken);
        return TypedResults.Ok(found.Select(mapper.Map).ToList());
    }

    private static async Task<IResult> Stats(HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var stats = await wardrobe.StatsAsync(http.User.UserId(), cancellationToken);
        return TypedResults.Ok(new WardrobeStatsResponse(stats.Total, stats.WornLast30Days, stats.Forgotten, stats.Processing, stats.NeedsTags));
    }

    private static async Task<IResult> Get(Guid id, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var item = await wardrobe.FindAsync(http.User.UserId(), id, cancellationToken);
        return item is null ? ApiError.NotFound().ToProblem() : TypedResults.Ok(mapper.Map(item));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateClothingRequest request,
        HttpContext http,
        WardrobeService wardrobe,
        ClothingMapper mapper,
        CancellationToken cancellationToken)
    {
        var updated = await wardrobe.UpdateAsync(
            http.User.UserId(),
            id,
            new ClothingPatch
            {
                Category = request.Category,
                Subcategory = request.Subcategory,
                Name = request.Name,
                Colors = request.Colors,
                Pattern = request.Pattern,
                Material = request.Material,
                Formality = request.Formality,
                Warmth = request.Warmth,
                RainOk = request.RainOk,
                Styles = request.Styles,
                InLaundry = request.InLaundry,
                RarelyWorn = request.RarelyWorn,
            },
            cancellationToken);
        return updated.IsOk ? TypedResults.Ok(mapper.Map(updated.Value)) : updated.Error!.ToProblem();
    }

    private static async Task<IResult> Delete(Guid id, HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var deleted = await wardrobe.DeleteAsync(http.User.UserId(), id, cancellationToken);
        return deleted.IsOk ? TypedResults.NoContent() : deleted.Error!.ToProblem();
    }

    private static async Task<IResult> Reprocess(Guid id, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var restarted = await wardrobe.ReprocessAsync(http.User.UserId(), id, cancellationToken);
        return restarted.IsOk ? TypedResults.Ok(mapper.Map(restarted.Value)) : restarted.Error!.ToProblem();
    }
}

/// <summary>Shapes a garment for the app, with a freshly signed address for its picture.</summary>
internal sealed class ClothingMapper(WardrobeService wardrobe)
{
    public ClothingResponse Map(ClothingItem item)
    {
        // A refused photo has no pictures left to show.
        var hasImage = item.Status != ClothingStatus.Rejected;
        return new ClothingResponse(
            item.Id,
            item.Status,
            item.Name,
            item.Category,
            item.Subcategory,
            [.. item.Colors.Select(EnumCodes.Parse<Color>)],
            item.Pattern,
            item.Material,
            item.Formality,
            item.Warmth,
            item.RainOk,
            [.. item.Styles.Select(EnumCodes.Parse<StyleTag>)],
            item.InLaundry,
            item.RarelyWorn,
            wardrobe.IsForgotten(item),
            item.WearCount,
            item.LastWornOn,
            item.RejectReason,
            hasImage ? wardrobe.ImageUrl(item).AbsoluteUri : null,
            hasImage ? item.ImageKey : null,
            item.CreatedAt);
    }
}
