using FitIt.Core.Common;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Accounts;

/// <summary>What changing a password means in every case: the new password meets the rules, and the old sessions end.</summary>
public sealed class PasswordService(UserManager<AppUser> users, AppDbContext db, AppClock clock)
{
    /// <summary>The rules of Identity (length, characters), asked without changing anything. A user who does not exist is checked as a blank one.</summary>
    public async Task<ApiError?> CheckRulesAsync(AppUser? user, string password)
    {
        var problems = new List<string>();
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, user ?? new AppUser(), password);
            problems.AddRange(result.Errors.Select(error => error.Description));
        }

        return problems.Count == 0 ? null : ApiError.BadRequest("password_invalid", "The password does not meet the rules.", string.Join(" ", problems));
    }

    /// <summary>Replaces the password and lifts a lockout the old one may have caused. The caller has checked <see cref="CheckRulesAsync"/>.</summary>
    public async Task SetAsync(AppUser user, string password)
    {
        user.PasswordHash = users.PasswordHasher.HashPassword(user, password);
        var saved = await users.UpdateAsync(user);
        if (!saved.Succeeded)
        {
            throw new InvalidOperationException($"The password could not be saved: {string.Join(' ', saved.Errors.Select(error => error.Code))}.");
        }

        await users.UpdateSecurityStampAsync(user);
        await users.ResetAccessFailedCountAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
    }

    /// <summary>
    /// Ends every session of the person, or every one but the session that holds <paramref name="keepRefreshToken"/>.
    /// Access tokens already issued live out their few minutes; refresh tokens are what keeps a session alive.
    /// </summary>
    public Task<int> RevokeSessionsAsync(Guid userId, string? keepRefreshToken, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var keep = keepRefreshToken is null ? null : TokenService.Hash(keepRefreshToken);
        return db.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAt == null && (keep == null || token.TokenHash != keep))
            .ExecuteUpdateAsync(set => set.SetProperty(token => token.RevokedAt, now), cancellationToken);
    }
}
