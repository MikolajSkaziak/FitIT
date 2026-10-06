using FitIt.Core.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Persistence;

/// <summary>Brings the database to the current schema and makes sure the fixed reference rows exist.</summary>
public sealed class DatabaseInitializer(AppDbContext db, ILogger<DatabaseInitializer> logger)
{
    public async Task MigrateAsync(CancellationToken cancellationToken)
    {
        await db.Database.MigrateAsync(cancellationToken);
        logger.LogInformation("Database schema is up to date");
    }

    /// <summary>Inserts or updates the silhouettes by their fixed ids, so a restart never duplicates them.</summary>
    public async Task SeedAvatarsAsync(CancellationToken cancellationToken)
    {
        var existing = await db.Avatars.ToDictionaryAsync(a => a.Id, cancellationToken);
        foreach (var seed in AvatarCatalog.All)
        {
            if (existing.TryGetValue(seed.Id, out var row))
            {
                row.Gender = seed.Gender;
                row.BodyType = seed.BodyType;
                row.Label = seed.Label;
                row.ImagePath = seed.ImagePath;
                row.ThumbPath = seed.ThumbPath;
                row.SortOrder = seed.SortOrder;
            }
            else
            {
                db.Avatars.Add(new Avatar
                {
                    Id = seed.Id,
                    Gender = seed.Gender,
                    BodyType = seed.BodyType,
                    Label = seed.Label,
                    ImagePath = seed.ImagePath,
                    ThumbPath = seed.ThumbPath,
                    SortOrder = seed.SortOrder,
                    IsActive = true,
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
