using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;

namespace FitIt.Api.Endpoints;

internal static class StarterEndpoints
{
    public static IEndpointRouteBuilder MapStarterEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/starter-pieces", List)
            .WithTags("Wardrobe").WithName("listStarterPieces")
            .Produces<IReadOnlyList<StarterPieceResponse>>();

        app.MapGet("/api/me/starter-pieces", ListMine)
            .WithTags("Wardrobe").WithName("listMyStarterPieces").RequireAuthorization()
            .Produces<IReadOnlyList<MyStarterPieceResponse>>().ProducesProblem(401);

        app.MapPost("/api/me/starter-pieces", Add)
            .WithTags("Wardrobe").WithName("addStarterPieces").RequireAuthorization()
            .Produces<StarterAdditionResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401);
        return app;
    }

    private static Microsoft.AspNetCore.Http.HttpResults.Ok<IReadOnlyList<StarterPieceResponse>> List(LinkBuilder links) =>
        TypedResults.Ok<IReadOnlyList<StarterPieceResponse>>(
        [
            .. StarterCatalog.All.Select(piece => new StarterPieceResponse(
                piece.Code, piece.Tags.Name, piece.Tags.Category, piece.Tags.Subcategory, piece.Tags.Colors, links.Absolute(piece.ImagePath))),
        ]);

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.Ok<IReadOnlyList<MyStarterPieceResponse>>> ListMine(
        HttpContext http, StarterPieceService starter, LinkBuilder links, CancellationToken cancellationToken)
    {
        var added = await starter.AddedCodesAsync(http.User.UserId(), cancellationToken);
        return TypedResults.Ok<IReadOnlyList<MyStarterPieceResponse>>(
        [
            .. StarterCatalog.All.Select(piece => new MyStarterPieceResponse(
                piece.Code, piece.Tags.Name, piece.Tags.Category, piece.Tags.Subcategory, piece.Tags.Colors, links.Absolute(piece.ImagePath), added.Contains(piece.Code))),
        ]);
    }

    private static async Task<IResult> Add(AddStarterPiecesRequest request, HttpContext http, StarterPieceService starter, CancellationToken cancellationToken)
    {
        var added = await starter.AddAsync(http.User.UserId(), request.Codes, cancellationToken);
        return added.IsOk ? TypedResults.Ok(new StarterAdditionResponse(added.Value.Added, added.Value.AlreadyThere)) : added.Error!.ToProblem();
    }
}
