using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Infrastructure.Styling;

namespace FitIt.Api.Endpoints;

internal static class StylistEndpoints
{
    /// <summary>Messages to the stylist per person per minute, on top of the daily allowance.</summary>
    public const string ChatRateLimit = "stylist-chat";

    public static IEndpointRouteBuilder MapStylistEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/stylist/chat", Chat)
            .WithTags("Stylist").WithName("chatWithStylist").RequireAuthorization().RequireRateLimiting(ChatRateLimit)
            .Produces<StylistReplyResponse>().ProducesValidationProblem().ProducesProblem(400).ProducesProblem(401).ProducesProblem(429);

        return app;
    }

    private static async Task<IResult> Chat(StylistChatRequest request, HttpContext http, StylistChatService stylist, ClothingMapper clothes, CancellationToken cancellationToken)
    {
        var messages = request.Messages!.Select(message => new ChatMessage(message.Role!.Value, message.Text!.Trim())).ToList();
        var replied = await stylist.ReplyAsync(http.User.UserId(), messages, request.Occasion, request.Date, cancellationToken);
        if (!replied.IsOk)
        {
            return replied.Error!.ToProblem();
        }

        var (reply, owned) = replied.Value;
        var outfit = reply.Outfit?.Draft.Items.ToList() ?? [];
        // The garments of the outfit and those the text mentions are shaped in one go, so their extra photos are read once.
        var shaped = await clothes.MapAsync([.. outfit.Concat(reply.Mentioned).Select(garment => garment.Id).Distinct().Select(id => owned[id])], cancellationToken);
        var byId = shaped.ToDictionary(garment => garment.Id);
        return TypedResults.Ok(new StylistReplyResponse(
            reply.Text,
            reply.Outfit is { } chosen
                ? new StylistOutfitResponse(chosen.Occasion, [.. outfit.Select(garment => new OutfitItemResponse(garment.Role, byId[garment.Id]))], chosen.Note)
                : null,
            [.. reply.Mentioned.Select(garment => byId[garment.Id])],
            [.. reply.Shopping.Select(idea => new ShoppingSuggestionResponse(idea.Name, idea.Category, idea.Why, idea.Colors))],
            reply.FollowUps,
            reply.FromRules ? StylistReplySource.Rules : StylistReplySource.Ai));
    }
}
