using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Infrastructure.Styling;

namespace FitIt.Api.Endpoints;

internal static class CalendarEndpoints
{
    public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder app)
    {
        var calendar = app.MapGroup("/api/calendar").WithTags("Calendar").RequireAuthorization();
        calendar.MapGet("", List).WithName("listCalendar")
            .Produces<CalendarResponse>().ProducesProblem(400).ProducesProblem(401);
        calendar.MapPost("", Add).WithName("addCalendarEntry")
            .Produces<CalendarEntryResponse>().Produces<CalendarEntryResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404).ProducesProblem(409);
        calendar.MapPatch("/{id:guid}", Update).WithName("updateCalendarEntry")
            .Produces<CalendarEntryResponse>().ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404);
        calendar.MapDelete("/{id:guid}", Remove).WithName("removeCalendarEntry")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401).ProducesProblem(404);

        app.MapGet("/api/outfits/{id:guid}/days", OfOutfit)
            .WithTags("Calendar").WithName("listOutfitDays").RequireAuthorization()
            .Produces<IReadOnlyList<OutfitDayResponse>>().ProducesProblem(401).ProducesProblem(404);

        return app;
    }

    /// <summary>The days from <c>from</c> to <c>to</c> that hold something, both ends included.</summary>
    private static async Task<IResult> List(DateOnly? from, DateOnly? to, HttpContext http, CalendarService calendar, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var found = await calendar.ListAsync(http.User.UserId(), from, to, cancellationToken);
        if (!found.IsOk)
        {
            return found.Error!.ToProblem();
        }

        var view = found.Value;
        var shaped = await mapper.MapAsync([.. view.Entries.Select(entry => entry.Outfit).DistinctBy(outfit => outfit.Outfit.Id)], cancellationToken);
        var byId = shaped.ToDictionary(outfit => outfit.Id);
        return TypedResults.Ok(new CalendarResponse(
            view.Today,
            view.ForecastUntil,
            CalendarEntry.MaxPerDay,
            [
                .. view.Entries.GroupBy(entry => entry.Entry.Day).Select(day => new CalendarDayResponse(
                    day.Key, [.. day.Select(entry => Shape(entry.Entry, byId[entry.Entry.OutfitId]))])),
            ]));
    }

    private static async Task<IResult> Add(AddCalendarEntryRequest request, HttpContext http, CalendarService calendar, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var added = await calendar.AddAsync(http.User.UserId(), request.Date!.Value, request.OutfitId!.Value, request.Worn, cancellationToken);
        if (!added.IsOk)
        {
            return added.Error!.ToProblem();
        }

        var response = Shape(added.Value.Entry.Entry, await mapper.MapAsync(added.Value.Entry.Outfit, cancellationToken));
        // The same outfit on the same day again is the entry that was there: nothing was created.
        return added.Value.Created ? TypedResults.Created($"/api/calendar/{response.Id}", response) : TypedResults.Ok(response);
    }

    private static async Task<IResult> Update(Guid id, UpdateCalendarEntryRequest request, HttpContext http, CalendarService calendar, OutfitMapper mapper, CancellationToken cancellationToken)
    {
        var marked = await calendar.MarkAsync(http.User.UserId(), id, request.Worn!.Value, cancellationToken);
        return marked.IsOk ? TypedResults.Ok(Shape(marked.Value.Entry, await mapper.MapAsync(marked.Value.Outfit, cancellationToken))) : marked.Error!.ToProblem();
    }

    private static async Task<IResult> Remove(Guid id, HttpContext http, CalendarService calendar, CancellationToken cancellationToken)
    {
        var removed = await calendar.RemoveAsync(http.User.UserId(), id, cancellationToken);
        return removed.IsOk ? TypedResults.NoContent() : removed.Error!.ToProblem();
    }

    private static async Task<IResult> OfOutfit(Guid id, HttpContext http, CalendarService calendar, CancellationToken cancellationToken)
    {
        var days = await calendar.OfOutfitAsync(http.User.UserId(), id, cancellationToken);
        return days.IsOk
            ? TypedResults.Ok<IReadOnlyList<OutfitDayResponse>>([.. days.Value.Select(entry => new OutfitDayResponse(entry.Id, entry.Day, entry.Worn))])
            : days.Error!.ToProblem();
    }

    private static CalendarEntryResponse Shape(CalendarEntry entry, OutfitResponse outfit) => new(entry.Id, entry.Day, entry.Worn, outfit, entry.CreatedAt);
}
