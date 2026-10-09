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

    public ClothingSize? ClothingSize { get; init; }

    public LegLength? LegLength { get; init; }

    /// <summary>True goes back to "not set".</summary>
    public bool ClearClothingSize { get; init; }

    /// <summary>True goes back to "not set".</summary>
    public bool ClearLegLength { get; init; }

    public WeatherPlace? Place { get; init; }

    /// <summary>True removes the stored place; the weather then has nowhere to be checked until a new one is set.</summary>
    public bool ClearPlace { get; init; }

    public bool? AiConsent { get; init; }

    /// <summary>The first unfinished step of the post-registration flow, 0 to 2. It never moves back.</summary>
    public int? OnboardingStep { get; init; }

    /// <summary>True marks the flow finished (or skipped) for good, on every phone.</summary>
    public bool? OnboardingDone { get; init; }
}

public sealed class ProfileService(AppDbContext db, AppClock clock, IOptions<AccountOptions> accountOptions)
{
    /// <summary>The post-registration flow has three steps: colors, first pieces, recap.</summary>
    public const int MaxOnboardingStep = 2;

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

        if (patch.ClearClothingSize)
        {
            user.ClothingSize = null;
        }
        else if (patch.ClothingSize is { } clothingSize)
        {
            user.ClothingSize = clothingSize;
        }

        if (patch.ClearLegLength)
        {
            user.LegLength = null;
        }
        else if (patch.LegLength is { } legLength)
        {
            user.LegLength = legLength;
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

        // The silhouette must always be one the profile's gender is offered, whichever of the two is being changed.
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

        if (patch.OnboardingStep is { } step)
        {
            if (step is < 0 or > MaxOnboardingStep)
            {
                return ApiError.BadRequest("onboarding_step_invalid", "The step is not one of the post-registration steps.");
            }

            user.OnboardingStep = Math.Max(user.OnboardingStep, step);
        }

        if (patch.OnboardingDone == true)
        {
            user.OnboardingDoneAt ??= clock.UtcNow;
        }

        if (patch.AiConsent is { } consent)
        {
            user.AiConsentAt = consent ? user.AiConsentAt ?? clock.UtcNow : null;
        }

        await db.SaveChangesAsync(cancellationToken);
        return user;
    }
}
