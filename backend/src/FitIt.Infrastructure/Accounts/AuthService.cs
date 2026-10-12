using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Accounts;

public sealed record RegisterCommand(
    string Email,
    string Password,
    string DisplayName,
    DateOnly BirthDate,
    Gender? Gender,
    Guid? AvatarId,
    IReadOnlyList<string> Styles,
    ThermalPreference ThermalPreference,
    WeatherPlace? Place,
    ClothingSize? ClothingSize = null,
    LegLength? LegLength = null);

public sealed record AuthOutcome(AppUser User, AuthTokens Tokens);

public sealed class AuthService(
    UserManager<AppUser> users,
    AppDbContext db,
    TokenService tokens,
    AppClock clock,
    IOptions<AccountOptions> accountOptions,
    IOptions<JwtOptions> jwtOptions)
{
    private static readonly ApiError InvalidCredentials = ApiError.Unauthorized("invalid_credentials", "The e-mail or the password is wrong.");
    private static readonly ApiError InvalidRefreshToken = ApiError.Unauthorized("invalid_refresh_token", "The session has ended. Sign in again.");
    private static readonly ApiError LockedOut = ApiError.TooManyRequests("locked_out", "Too many failed attempts. Try again in a few minutes.");

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public async Task<bool> IsEmailAvailableAsync(string email) => await users.FindByEmailAsync(NormalizeEmail(email)) is null;

    public async Task<Result<AuthOutcome>> RegisterAsync(RegisterCommand command, CancellationToken cancellationToken)
    {
        if (ProfileRules.CheckBirthDate(command.BirthDate, clock.Today, accountOptions.Value.MinimumAge) is { } birthError)
        {
            return birthError;
        }

        if (ProfileRules.CheckStyles(command.Styles) is { } styleError)
        {
            return styleError;
        }

        if (ProfileRules.CheckPlace(command.Place) is { } placeError)
        {
            return placeError;
        }

        // The app asks for the gender and the body shape in the first step after sign-up. Until then the account holds
        // "unspecified" and the first silhouette on offer: the columns are required, and that step replaces both.
        var gender = command.Gender ?? Gender.Unspecified;
        var anySet = gender.OffersAllSilhouettes();
        var avatar = command.AvatarId is { } avatarId
            ? await db.Avatars.FirstOrDefaultAsync(a => a.Id == avatarId && a.IsActive, cancellationToken)
            : await db.Avatars.Where(a => a.IsActive && (anySet || a.Gender == gender)).OrderBy(a => a.Gender).ThenBy(a => a.SortOrder).FirstOrDefaultAsync(cancellationToken);
        if (ProfileRules.CheckAvatar(avatar, gender) is { } avatarError)
        {
            return avatarError;
        }

        var email = NormalizeEmail(command.Email);
        if (await users.FindByEmailAsync(email) is not null)
        {
            return ApiError.Conflict("email_taken", "An account with this e-mail already exists.");
        }

        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            DisplayName = command.DisplayName.Trim(),
            BirthDate = command.BirthDate,
            Gender = gender,
            AvatarId = avatar!.Id,
            StylePreferences = [.. command.Styles.Distinct(StringComparer.Ordinal)],
            ThermalPreference = command.ThermalPreference,
            ClothingSize = command.ClothingSize,
            LegLength = command.LegLength,
            CreatedAt = clock.UtcNow,
            // No consent to AI processing yet: the app asks in context, before the first photo leaves the phone (PATCH /api/me).
        };
        ProfileRules.Apply(user, command.Place);

        var created = await users.CreateAsync(user, command.Password);
        if (!created.Succeeded)
        {
            return created.Errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName))
                ? ApiError.Conflict("email_taken", "An account with this e-mail already exists.")
                : ApiError.BadRequest("password_invalid", "The password does not meet the rules.", string.Join(" ", created.Errors.Select(e => e.Description)));
        }

        user.Avatar = avatar;
        return new AuthOutcome(user, await IssueAsync(user.Id, cancellationToken));
    }

    public async Task<Result<AuthOutcome>> LoginAsync(string email, string password, CancellationToken cancellationToken)
    {
        var normalized = users.NormalizeEmail(NormalizeEmail(email));
        var user = await users.Users.Include(u => u.Avatar).FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, cancellationToken);
        if (user is null)
        {
            // Spend the same time as a real check so the answer does not reveal whether the address exists.
            users.PasswordHasher.HashPassword(new AppUser(), password);
            return InvalidCredentials;
        }

        if (await users.IsLockedOutAsync(user))
        {
            return LockedOut;
        }

        if (!await users.CheckPasswordAsync(user, password))
        {
            await users.AccessFailedAsync(user);
            return await users.IsLockedOutAsync(user) ? LockedOut : InvalidCredentials;
        }

        await users.ResetAccessFailedCountAsync(user);
        return new AuthOutcome(user, await IssueAsync(user.Id, cancellationToken));
    }

    /// <summary>Rotates the refresh token: the presented one stops working and a new pair is returned.</summary>
    public async Task<Result<AuthTokens>> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var hash = TokenService.Hash(refreshToken);
        var now = clock.UtcNow;
        var stored = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (stored is null)
        {
            return InvalidRefreshToken;
        }

        if (stored.RevokedAt is not null)
        {
            // A token that was already rotated is being replayed: treat it as stolen and end every session of this user.
            await db.RefreshTokens
                .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
            return InvalidRefreshToken;
        }

        if (stored.ExpiresAt <= now)
        {
            return InvalidRefreshToken;
        }

        // Only one of two concurrent requests may win the rotation.
        var rotated = await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
        if (rotated == 0 || !await db.Users.AnyAsync(u => u.Id == stored.UserId, cancellationToken))
        {
            return InvalidRefreshToken;
        }

        return await IssueAsync(stored.UserId, cancellationToken);
    }

    public async Task LogoutAsync(Guid userId, string refreshToken, CancellationToken cancellationToken)
    {
        var hash = TokenService.Hash(refreshToken);
        var now = clock.UtcNow;
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
    }

    private async Task<AuthTokens> IssueAsync(Guid userId, CancellationToken cancellationToken)
    {
        var (accessToken, expiresIn) = tokens.CreateAccessToken(userId);
        var refreshToken = TokenService.NewRefreshToken();
        var now = clock.UtcNow;
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            TokenHash = TokenService.Hash(refreshToken),
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays),
        });
        await db.SaveChangesAsync(cancellationToken);
        return new AuthTokens(accessToken, refreshToken, expiresIn);
    }
}

/// <summary>Checks shared by registration and profile edits.</summary>
internal static class ProfileRules
{
    public static ApiError? CheckBirthDate(DateOnly birthDate, DateOnly today, int minimumAge)
    {
        if (!AgeRule.IsPlausible(birthDate, today))
        {
            return ApiError.BadRequest("birth_date_invalid", "The birth date is not a possible date.");
        }

        return AgeRule.IsOldEnough(birthDate, today, minimumAge)
            ? null
            : ApiError.BadRequest("underage", $"An account can be created from the age of {minimumAge}.") with
            {
                Extensions = new Dictionary<string, object?> { ["minimumAge"] = minimumAge },
            };
    }

    public static ApiError? CheckStyles(IReadOnlyList<string> styles) =>
        styles.Count <= GarmentCatalog.MaxPreferredStyles && styles.All(s => EnumCodes.TryParse<StyleTag>(s, out _))
            ? null
            : ApiError.BadRequest("styles_invalid", "A style is not on the list.");

    public static ApiError? CheckPlace(WeatherPlace? place) =>
        place is null || (WeatherPlace.IsValid(place.Lat, place.Lon) && place.Name.Trim().Length is > 0 and <= WeatherPlace.NameMaxLength)
            ? null
            : ApiError.BadRequest("location_invalid", "The place needs a name and valid coordinates.");

    public static ApiError? CheckAvatar(Avatar? avatar, Gender gender)
    {
        if (avatar is null)
        {
            return ApiError.BadRequest("avatar_invalid", "The silhouette does not exist.");
        }

        return gender.OffersAllSilhouettes() || avatar.Gender == gender
            ? null
            : ApiError.BadRequest("avatar_gender_mismatch", "The silhouette belongs to the other gender.");
    }

    public static void Apply(AppUser user, WeatherPlace? place)
    {
        user.LocationSource = place?.Source;
        user.LocationName = place?.Name.Trim();
        user.Lat = place is null ? null : WeatherPlace.RoundCoordinate(place.Lat);
        user.Lon = place is null ? null : WeatherPlace.RoundCoordinate(place.Lon);
    }
}
