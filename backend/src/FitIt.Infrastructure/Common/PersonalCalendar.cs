using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Common;

/// <summary>
/// A person's own "today": the day at the weather place in their profile. Looked up once per request, so every
/// count and comparison within one request agrees on what day it is.
/// </summary>
public sealed class PersonalCalendar(AppDbContext db, AppClock clock)
{
    private readonly Dictionary<Guid, LocalDay> _days = [];

    public async Task<LocalDay> OfAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (_days.TryGetValue(userId, out var known))
        {
            return known;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);
        return _days[userId] = clock.DayAt(user?.Place);
    }
}
