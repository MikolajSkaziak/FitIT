using FitIt.Core.Common;
using FitIt.Core.Styling;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Styling;

/// <summary>An outfit on a day of the calendar, with the outfit as the lists show it.</summary>
public sealed record CalendarEntryView(CalendarEntry Entry, OutfitView Outfit);

/// <summary>
/// A stretch of the person's calendar: the days that hold something, in order, each with its entries in the order they
/// were added. <see cref="Today"/> is the person's own day and <see cref="ForecastUntil"/> the last day outfits can be suggested for.
/// </summary>
public sealed record CalendarView(DateOnly Today, DateOnly ForecastUntil, IReadOnlyList<CalendarEntryView> Entries);

/// <summary>
/// The person's calendar of outfits: what is planned for a day and what was worn on it. Days are plain calendar dates
/// where the person's weather place lies, like every other day the service counts in.
/// </summary>
public sealed class CalendarService(AppDbContext db, AppClock clock, PersonalCalendar calendar, OutfitService outfits)
{
    public static readonly ApiError RangeInvalid = ApiError.BadRequest(
        "calendar_range_invalid", $"Name the first and the last day of the stretch, in order and no more than {CalendarEntry.MaxRangeDays} days in all.");

    public static readonly ApiError DateInvalid = ApiError.BadRequest(
        "calendar_date_invalid", "That day is too far away to keep in the calendar: up to a year ahead, or five years back.");

    public static readonly ApiError NotYetWorn = ApiError.BadRequest(
        "calendar_day_ahead", "An outfit can be worn today or on a day that has passed, not on one that is still to come.");

    public static readonly ApiError DayFull = ApiError.Conflict(
        "calendar_day_full", $"A day holds up to {CalendarEntry.MaxPerDay} outfits. Take one off it first.");

    public async Task<Result<CalendarView>> ListAsync(Guid userId, DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        if (from is not { } first || to is not { } last || last < first || last.DayNumber - first.DayNumber >= CalendarEntry.MaxRangeDays)
        {
            return RangeInvalid;
        }

        var today = (await calendar.OfAsync(userId, cancellationToken)).Today;
        var entries = await db.CalendarEntries.AsNoTracking()
            .Where(entry => entry.UserId == userId && entry.Day >= first && entry.Day <= last)
            .OrderBy(entry => entry.Day).ThenBy(entry => entry.CreatedAt).ThenBy(entry => entry.Id)
            .ToListAsync(cancellationToken);
        return new CalendarView(today, today.AddDays(WeatherProfile.HorizonDays - 1), await ViewAsync(userId, entries, cancellationToken));
    }

    /// <summary>The days one outfit stands on, oldest first; somebody else's outfit is not found.</summary>
    public async Task<Result<IReadOnlyList<CalendarEntry>>> OfOutfitAsync(Guid userId, Guid outfitId, CancellationToken cancellationToken)
    {
        if (!await db.Outfits.AnyAsync(outfit => outfit.Id == outfitId && outfit.UserId == userId, cancellationToken))
        {
            return ApiError.NotFound();
        }

        return Result.Ok<IReadOnlyList<CalendarEntry>>(await db.CalendarEntries.AsNoTracking()
            .Where(entry => entry.UserId == userId && entry.OutfitId == outfitId)
            .OrderBy(entry => entry.Day)
            .ToListAsync(cancellationToken));
    }

    /// <summary>
    /// Puts an outfit on a day. Today and the days ahead are planned (today may be said worn at once); a day that has passed
    /// is history being filled in, so it is recorded as worn. The same outfit on the same day again is the entry that is
    /// already there (<c>Created</c> false). A lock per person and day makes requests that arrive together wait for one
    /// another, so the day's cap holds.
    /// </summary>
    public async Task<Result<(CalendarEntryView Entry, bool Created)>> AddAsync(Guid userId, DateOnly day, Guid outfitId, bool? worn, CancellationToken cancellationToken)
    {
        var today = (await calendar.OfAsync(userId, cancellationToken)).Today;
        if (day > today.AddDays(CalendarEntry.MaxDaysAhead) || day < today.AddDays(-CalendarEntry.MaxDaysBack))
        {
            return DateInvalid;
        }

        if (day > today && worn == true)
        {
            return NotYetWorn;
        }

        var outfit = await db.Outfits.Include(found => found.Items).FirstOrDefaultAsync(found => found.Id == outfitId && found.UserId == userId, cancellationToken);
        if (outfit is null)
        {
            return ApiError.NotFound();
        }

        var asWorn = day < today || worn == true;
        var key = $"calendar:{userId:N}:{day:O}";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // Given back with the transaction.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);

        var onDay = await db.CalendarEntries.Where(entry => entry.UserId == userId && entry.Day == day).ToListAsync(cancellationToken);
        var entry = onDay.FirstOrDefault(found => found.OutfitId == outfitId);
        var created = entry is null;
        if (entry is null)
        {
            if (onDay.Count >= CalendarEntry.MaxPerDay)
            {
                return DayFull;
            }

            // A day's outfits are shown in the order they were added; two added within the same instant still keep theirs.
            var now = clock.UtcNow;
            var added = onDay.Count > 0 && onDay.Max(found => found.CreatedAt) is var newest && newest >= now ? newest.AddTicks(TimeSpan.TicksPerMicrosecond) : now;
            entry = CalendarEntry.Of(userId, outfitId, day, worn: false, added);
            db.CalendarEntries.Add(entry);
        }

        if (asWorn && !entry.Worn)
        {
            entry.Mark(worn: true);
            await outfits.RecordWearAsync(outfit, day, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ((await ViewAsync(userId, [entry], cancellationToken))[0], created);
    }

    /// <summary>"I wore this" for an entry of today or a day that has passed, or taking that back.</summary>
    public async Task<Result<CalendarEntryView>> MarkAsync(Guid userId, Guid id, bool worn, CancellationToken cancellationToken)
    {
        var entry = await db.CalendarEntries.FirstOrDefaultAsync(found => found.Id == id && found.UserId == userId, cancellationToken);
        if (entry is null)
        {
            return ApiError.NotFound();
        }

        if (worn && entry.Day > (await calendar.OfAsync(userId, cancellationToken)).Today)
        {
            return NotYetWorn;
        }

        if (entry.Worn != worn)
        {
            var outfit = await db.Outfits.Include(found => found.Items).FirstAsync(found => found.Id == entry.OutfitId, cancellationToken);
            entry.Mark(worn);
            if (worn)
            {
                await outfits.RecordWearAsync(outfit, entry.Day, cancellationToken);
            }
            else
            {
                outfit.LastWorn(await LastWornAsync(outfit.Id, except: entry.Id, cancellationToken));
            }

            await db.SaveChangesAsync(cancellationToken);
        }

        return (await ViewAsync(userId, [entry], cancellationToken))[0];
    }

    /// <summary>Takes an outfit off a day. The outfit itself stays; when the day was a worn one, its last worn day is told anew.</summary>
    public async Task<Result<Unit>> RemoveAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        var entry = await db.CalendarEntries.FirstOrDefaultAsync(found => found.Id == id && found.UserId == userId, cancellationToken);
        if (entry is null)
        {
            return ApiError.NotFound();
        }

        if (entry.Worn)
        {
            var outfit = await db.Outfits.FirstAsync(found => found.Id == entry.OutfitId, cancellationToken);
            outfit.LastWorn(await LastWornAsync(outfit.Id, except: entry.Id, cancellationToken));
        }

        db.CalendarEntries.Remove(entry);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }

    /// <summary>The newest worn day of an outfit, leaving one entry out of the count; null when it was never worn otherwise.</summary>
    private Task<DateOnly?> LastWornAsync(Guid outfitId, Guid except, CancellationToken cancellationToken) =>
        db.CalendarEntries.Where(entry => entry.OutfitId == outfitId && entry.Worn && entry.Id != except)
            .MaxAsync(entry => (DateOnly?)entry.Day, cancellationToken);

    private async Task<IReadOnlyList<CalendarEntryView>> ViewAsync(Guid userId, IReadOnlyList<CalendarEntry> entries, CancellationToken cancellationToken)
    {
        var ids = entries.Select(entry => entry.OutfitId).Distinct().ToList();
        var found = await db.Outfits.AsNoTracking().Include(outfit => outfit.Items)
            .Where(outfit => outfit.UserId == userId && ids.Contains(outfit.Id))
            .ToListAsync(cancellationToken);
        var views = (await outfits.ViewAsync(found, cancellationToken)).ToDictionary(view => view.Outfit.Id);
        return [.. entries.Select(entry => new CalendarEntryView(entry, views[entry.OutfitId]))];
    }
}
