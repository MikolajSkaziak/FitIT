using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Common;
using FitIt.Core.Usage;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
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
        [.. Enum.GetValues<GarmentGroup>().Select(group => new GroupEntry(
            group,
            GarmentCatalog.Label(group),
            [.. GarmentCatalog.TypesOf(group).Select(type => new TypeEntry(type, GarmentCatalog.Label(type)))]))],
        [.. Enum.GetValues<Color>().Select(color => new ColorEntry(color, GarmentCatalog.Label(color), GarmentCatalog.IsNeutral(color), GarmentCatalog.Hex(color)))],
        [.. Enum.GetValues<Pattern>().Select(pattern => new PatternEntry(pattern, GarmentCatalog.Label(pattern)))],
        [.. Enum.GetValues<Material>().Select(material => new MaterialEntry(material, GarmentCatalog.Label(material)))],
        [], // styles carry absolute photo links, so the endpoint fills them in per request
        [.. Enum.GetValues<Season>().Select(season => new SeasonEntry(season, GarmentCatalog.Label(season)))],
        [.. GarmentCatalog.FormalityLabels.Select((label, index) => new ScaleEntry(index + 1, label))],
        [.. GarmentCatalog.WarmthLabels.Select((label, index) => new ScaleEntry(index + 1, label))]);

    public static IEndpointRouteBuilder MapWardrobeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/dictionaries", (LinkBuilder links) => TypedResults.Ok(Dictionaries with
            {
                // The photos are absolute links, so this part is built per request.
                Styles = [.. Enum.GetValues<StyleTag>().Select(style => new StyleEntry(
                    style,
                    GarmentCatalog.Label(style),
                    links.Absolute(GarmentCatalog.StylePhotoWoman(style)),
                    links.Absolute(GarmentCatalog.StylePhotoMan(style))))],
            }))
            .WithTags("Wardrobe").WithName("getDictionaries")
            .Produces<DictionariesResponse>();

        app.MapGet("/api/me/usage", GetUsage)
            .WithTags("Account").WithName("getUsage").RequireAuthorization()
            .Produces<UsageResponse>().ProducesProblem(401);

        app.MapPost("/api/uploads", CreateUpload)
            .WithTags("Wardrobe").WithName("createUpload").RequireAuthorization()
            .Produces<UploadResponse>().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429);

        var clothes = app.MapGroup("/api/clothes").WithTags("Wardrobe").RequireAuthorization();
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

        // Extra photos of a garment travel like the main one: an address to PUT to, then a confirmation with the key.
        clothes.MapPost("/{id:guid}/photos/uploads", CreatePhotoUpload).WithName("createClothingPhotoUpload")
            .Produces<UploadResponse>().ProducesProblem(401).ProducesProblem(404).ProducesProblem(409);
        clothes.MapPost("/{id:guid}/photos", AddPhoto).WithName("addClothingPhoto")
            .Produces<ClothingPhotoResponse>(StatusCodes.Status201Created).Produces<ClothingPhotoResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404).ProducesProblem(409);
        clothes.MapDelete("/{id:guid}/photos/{photoId:guid}", DeletePhoto).WithName("deleteClothingPhoto")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401).ProducesProblem(404);

        return app;
    }

    private static async Task<IResult> CreatePhotoUpload(Guid id, HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var ticket = await wardrobe.CreatePhotoUploadAsync(http.User.UserId(), id, cancellationToken);
        return ticket.IsOk
            ? TypedResults.Ok(new UploadResponse(ticket.Value.Key, ticket.Value.Url.AbsoluteUri, "PUT", ticket.Value.Headers, ticket.Value.ExpiresAt, wardrobe.MaxUploadBytes))
            : ticket.Error!.ToProblem();
    }

    private static async Task<IResult> AddPhoto(Guid id, AddClothingPhotoRequest request, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var added = await wardrobe.AddPhotoAsync(http.User.UserId(), id, request.Key, cancellationToken);
        if (!added.IsOk)
        {
            return added.Error!.ToProblem();
        }

        var response = mapper.Map(added.Value.Photo);
        return added.Value.Created ? TypedResults.Created($"/api/clothes/{id}/photos/{response.Id}", response) : TypedResults.Ok(response);
    }

    private static async Task<IResult> DeletePhoto(Guid id, Guid photoId, HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var deleted = await wardrobe.DeletePhotoAsync(http.User.UserId(), id, photoId, cancellationToken);
        return deleted.IsOk ? TypedResults.NoContent() : deleted.Error!.ToProblem();
    }

    private static async Task<IResult> GetUsage(HttpContext http, UsageCounters usage, CancellationToken cancellationToken)
    {
        var snapshot = await usage.ReadAsync(http.User.UserId(), cancellationToken);
        UsageLineResponse Line(UsageKind kind) => new(snapshot[kind].Used, snapshot[kind].Limit);
        return TypedResults.Ok(new UsageResponse(Line(UsageKind.ItemAdded), Line(UsageKind.Suggestion), Line(UsageKind.Visualization), Line(UsageKind.StylistChat), snapshot.ResetsAt));
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

        var response = await mapper.MapAsync(added.Value.Item, cancellationToken);
        return added.Value.Created ? TypedResults.Created($"/api/clothes/{response.Id}", response) : TypedResults.Ok(response);
    }

    private static async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? category,
        [FromQuery] string? group,
        [FromQuery] string? types,
        [FromQuery] string? colors,
        [FromQuery] string? seasons,
        [FromQuery] string? materials,
        [FromQuery] string? usage,
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

        // Several values may be asked for at once, comma separated like the ids: a garment matching any of them is listed.
        // Different filters combine: a garment has to pass every filter that is given.
        var groupProblem = ParseCodes<GarmentGroup>(group, "group_invalid", "The group is not on the list.", out var wantedGroups);
        var typeProblem = ParseCodes<Subcategory>(types, "types_invalid", "A type is not on the list.", out var wantedTypes);
        var colorProblem = ParseCodes<Color>(colors, "colors_invalid", "A colour is not on the list.", out var wantedColors);
        var seasonProblem = ParseCodes<Season>(seasons, "seasons_invalid", "A season is not on the list.", out var wantedSeasons);
        var materialProblem = ParseCodes<Material>(materials, "materials_invalid", "A material is not on the list.", out var wantedMaterials);
        if ((groupProblem ?? typeProblem ?? colorProblem ?? seasonProblem ?? materialProblem) is { } problem)
        {
            return problem.ToProblem();
        }

        WardrobeUsage? wantedUsage = null;
        if (usage is not null)
        {
            wantedUsage = usage switch
            {
                "used" => WardrobeUsage.Used,
                "unused" => WardrobeUsage.Unused,
                _ => null,
            };
            if (wantedUsage is null)
            {
                return ApiError.BadRequest("usage_invalid", "Usage is 'used' or 'unused'.").ToProblem();
            }
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
            new ClothingQuery
            {
                Search = q,
                Category = wantedCategory,
                Groups = wantedGroups,
                Types = wantedTypes,
                Colors = wantedColors,
                Seasons = wantedSeasons,
                Materials = wantedMaterials,
                Usage = wantedUsage,
                Forgotten = forgotten == true,
                Ids = wantedIds,
            },
            cancellationToken);
        return TypedResults.Ok(await mapper.MapAsync(found, cancellationToken));
    }

    /// <summary>Reads a comma separated list of codes. Null means the filter is not used (not given, or no code in it).</summary>
    private static ApiError? ParseCodes<T>(string? text, string errorCode, string message, out List<T>? codes)
        where T : struct, Enum
    {
        codes = null;
        if (text is null)
        {
            return null;
        }

        var parsed = new List<T>();
        foreach (var code in text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!EnumCodes.TryParse<T>(code, out var value))
            {
                return ApiError.BadRequest(errorCode, message);
            }

            parsed.Add(value);
        }

        codes = parsed.Count > 0 ? parsed : null;
        return null;
    }

    private static async Task<IResult> Stats(HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var stats = await wardrobe.StatsAsync(http.User.UserId(), cancellationToken);
        return TypedResults.Ok(new WardrobeStatsResponse(stats.Total, stats.WornLast30Days, stats.Forgotten, stats.Processing, stats.NeedsTags));
    }

    private static async Task<IResult> Get(Guid id, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var item = await wardrobe.FindAsync(http.User.UserId(), id, cancellationToken);
        return item is null ? ApiError.NotFound().ToProblem() : TypedResults.Ok(await mapper.MapAsync(item, cancellationToken));
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
                Seasons = request.Seasons,
                InLaundry = request.InLaundry,
                RarelyWorn = request.RarelyWorn,
            },
            cancellationToken);
        return updated.IsOk ? TypedResults.Ok(await mapper.MapAsync(updated.Value, cancellationToken)) : updated.Error!.ToProblem();
    }

    private static async Task<IResult> Delete(Guid id, HttpContext http, WardrobeService wardrobe, CancellationToken cancellationToken)
    {
        var deleted = await wardrobe.DeleteAsync(http.User.UserId(), id, cancellationToken);
        return deleted.IsOk ? TypedResults.NoContent() : deleted.Error!.ToProblem();
    }

    private static async Task<IResult> Reprocess(Guid id, HttpContext http, WardrobeService wardrobe, ClothingMapper mapper, CancellationToken cancellationToken)
    {
        var restarted = await wardrobe.ReprocessAsync(http.User.UserId(), id, cancellationToken);
        return restarted.IsOk ? TypedResults.Ok(await mapper.MapAsync(restarted.Value, cancellationToken)) : restarted.Error!.ToProblem();
    }
}

/// <summary>Shapes a garment for the app, with freshly signed addresses for its picture and its extra photos.</summary>
internal sealed class ClothingMapper(WardrobeService wardrobe)
{
    public async Task<ClothingResponse> MapAsync(ClothingItem item, CancellationToken cancellationToken) =>
        (await MapAsync([item], cancellationToken))[0];

    /// <summary>Several garments at once: their extra photos are read together.</summary>
    public async Task<IReadOnlyList<ClothingResponse>> MapAsync(IReadOnlyList<ClothingItem> items, CancellationToken cancellationToken)
    {
        var photos = await wardrobe.PhotosOfAsync([.. items.Select(item => item.Id)], cancellationToken);
        var mapped = new List<ClothingResponse>(items.Count);
        foreach (var item in items)
        {
            mapped.Add(Map(item, await wardrobe.TodayOfAsync(item.UserId, cancellationToken), photos[item.Id]));
        }

        return mapped;
    }

    public ClothingPhotoResponse Map(ClothingPhoto photo) => new(photo.Id, wardrobe.ImageUrl(photo).AbsoluteUri, photo.Key, photo.Width, photo.Height);

    private ClothingResponse Map(ClothingItem item, LocalDay today, IEnumerable<ClothingPhoto> photos)
    {
        // A refused photo has no pictures left to show.
        var hasImage = item.Status != ClothingStatus.Rejected;
        return new ClothingResponse(
            item.Id,
            item.Status,
            item.Name,
            item.Category,
            item.Subcategory is { } type ? GarmentCatalog.GroupOf(type) : null,
            item.Subcategory,
            [.. item.Colors.Select(EnumCodes.Parse<Color>)],
            item.Pattern,
            item.Material,
            item.Formality,
            item.Warmth,
            item.RainOk,
            [.. item.Styles.Select(EnumCodes.Parse<StyleTag>)],
            [.. item.Seasons.Select(EnumCodes.Parse<Season>)],
            item.InLaundry,
            item.RarelyWorn,
            WardrobeService.IsForgotten(item, today),
            item.WearCount,
            item.LastWornOn,
            item.RejectReason,
            hasImage ? wardrobe.ImageUrl(item).AbsoluteUri : null,
            hasImage ? item.ImageKey : null,
            item.CreatedAt,
            [.. photos.Select(Map)],
            item.DescribedByAi);
    }
}
