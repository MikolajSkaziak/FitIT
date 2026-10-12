using System.ComponentModel.DataAnnotations;

namespace FitIt.Api.Contracts;

/// <summary>
/// Puts an outfit on a day of the person's calendar. Today and the days ahead are planned (<c>worn: true</c> is allowed
/// for today only); a day that has passed is recorded as worn, whatever <c>worn</c> says.
/// </summary>
public sealed class AddCalendarEntryRequest
{
    [Required]
    public DateOnly? Date { get; init; }

    [Required]
    public Guid? OutfitId { get; init; }

    public bool? Worn { get; init; }
}

/// <summary>"I wore this" with <c>worn: true</c> (today or a day that has passed), or taking it back with <c>false</c>.</summary>
public sealed class UpdateCalendarEntryRequest
{
    [Required]
    public bool? Worn { get; init; }
}

/// <summary>One outfit on one day: planned while <c>Worn</c> is false, also once the day has passed.</summary>
public sealed record CalendarEntryResponse(Guid Id, DateOnly Date, bool Worn, OutfitResponse Outfit, DateTimeOffset CreatedAt);

/// <summary>A day that holds something, with its entries in the order they were added.</summary>
public sealed record CalendarDayResponse(DateOnly Date, IReadOnlyList<CalendarEntryResponse> Entries);

/// <summary>
/// A stretch of the calendar: only the days that hold something, in order. <c>Today</c> is the day where the person's
/// weather place lies, <c>ForecastUntil</c> the last day outfits can be suggested for, and <c>MaxPerDay</c> how many
/// outfits a day can be planned with.
/// </summary>
public sealed record CalendarResponse(DateOnly Today, DateOnly ForecastUntil, int MaxPerDay, IReadOnlyList<CalendarDayResponse> Days);

/// <summary>One day an outfit stands on.</summary>
public sealed record OutfitDayResponse(Guid Id, DateOnly Date, bool Worn);
