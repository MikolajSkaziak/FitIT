namespace FitIt.Core.Styling;

/// <summary>
/// An outfit on one day of a person's calendar: planned for it, or worn on it. A day is a plain calendar date where the
/// person's weather place lies. One outfit can stand on many days, and a day holds up to <see cref="MaxPerDay"/> planned outfits.
/// </summary>
public sealed class CalendarEntry
{
    /// <summary>How many outfits can be planned for one day (work and an evening out, say).</summary>
    public const int MaxPerDay = 3;

    /// <summary>How far ahead a day can be planned.</summary>
    public const int MaxDaysAhead = 365;

    /// <summary>How far back history can be filled in.</summary>
    public const int MaxDaysBack = 5 * 365;

    /// <summary>The longest stretch of days one question about the calendar may cover: two months side by side.</summary>
    public const int MaxRangeDays = 62;

    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public Guid OutfitId { get; init; }

    public DateOnly Day { get; init; }

    /// <summary>False while the outfit is only planned for the day. A planned day that has passed stays planned until the person says they wore it.</summary>
    public bool Worn { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    public static CalendarEntry Of(Guid userId, Guid outfitId, DateOnly day, bool worn, DateTimeOffset now) =>
        new() { Id = Guid.CreateVersion7(now), UserId = userId, OutfitId = outfitId, Day = day, Worn = worn, CreatedAt = now };

    public void Mark(bool worn) => Worn = worn;
}
