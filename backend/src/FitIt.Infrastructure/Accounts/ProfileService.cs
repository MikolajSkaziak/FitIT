using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Accounts;

/// <summary>Changes to the profile. A null member means "leave as it is".</summary>
public sealed record ProfilePatch
{
    public string? DisplayName { get; init; }

    public DateOnly? BirthDate { get; init; }

    public Gender? Gender { get; init; }

    public Guid? AvatarId { get; init; }

    public IReadOnlyList<string>? Styles { get; init; }

    public ThermalPreference? ThermalPreference { get; init; }

    public WeatherPlace? Place { get; init; }

    /// <summary>True removes the stored place; the weather then has nowhere to be checked until a new one is set.</summary>
    public bool ClearPlace { get; init; }

    public bool? AiConsent { get; init; }
}

public sealed class ProfileService(AppDbContext db, AppClock clock, IOptions<AccountOptions> accountOptions)
{
    public Task<AppUser?> FindAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Users.Include(u => u.Avatar).FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

    public async Task<Result<AppUser>> UpdateAsync(Guid userId, ProfilePatch patch, CancellationToken cancellationToken)
    {
        var user = await FindAsync(userId, cancellationToken);
        if (user is null)
        {
            return ApiError.Unauthorized("account_gone", "The account no longer exists.");
        }

        if (patch.DisplayName is { } name)
        {
            user.DisplayName = name.Trim();
        }

        if (patch.BirthDate is { } birthDate)
        {
            if (ProfileRules.CheckBirthDate(birthDate, clock.Today, accountOptions.Value.MinimumAge) is { } error)
            {
                return error;
            }

            user.BirthDate = birthDate;
        }

        if (patch.Styles is { } styles)
        {
            if (ProfileRules.CheckStyles(styles) is { } error)
            {
                return error;
            }

            user.StylePreferences = [.. styles.Distinct(StringComparer.Ordinal)];
        }

        if (patch.ThermalPreference is { } thermal)
        {
            user.ThermalPreference = thermal;
        }

        if (patch.ClearPlace)
        {
            ProfileRules.Apply(user, null);
        }
        else if (patch.Place is { } place)
        {
            if (ProfileRules.CheckPlace(place) is { } error)
            {
                return error;
            }

            ProfileRules.Apply(user, place);
        }

        // The silhouette must always belong to the profile's gender, whichever of the two is being changed.
        if (patch.Gender is not null || patch.AvatarId is not null)
        {
            var gender = patch.Gender ?? user.Gender;
            var avatarId = patch.AvatarId ?? user.AvatarId;
            var avatar = await db.Avatars.FirstOrDefaultAsync(a => a.Id == avatarId && a.IsActive, cancellationToken);
            if (ProfileRules.CheckAvatar(avatar, gender) is { } error)
            {
                return error;
            }

            user.Gender = gender;
            user.AvatarId = avatar!.Id;
            user.Avatar = avatar;
        }

        if (patch.AiConsent is { } consent)
        {
            user.AiConsentAt = consent ? user.AiConsentAt ?? clock.UtcNow : null;
        }

        await db.SaveChangesAsync(cancellationToken);
        return user;
    }
}
