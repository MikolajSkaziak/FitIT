using System.Security.Cryptography;
using System.Text;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Accounts;

/// <summary>
/// Resetting a forgotten password with a six digit code sent by e-mail (plan 5.2). Three rules carry the security of a code
/// that short: it lives fifteen minutes, it dies after a few wrong guesses, and it works once. Nothing the service says
/// depends on whether an address has an account, so it cannot be used to find out who has one.
/// </summary>
public sealed class PasswordResetService(
    UserManager<AppUser> users,
    AppDbContext db,
    IEmailSender email,
    PasswordService passwords,
    AppClock clock,
    IOptions<AccountOptions> accountOptions,
    IOptions<JwtOptions> jwtOptions,
    ILogger<PasswordResetService> logger)
{
    public static readonly ApiError InvalidCode = ApiError.BadRequest("invalid_reset_code", "The code is wrong or has expired. Ask for a new one.");

    /// <summary>
    /// Sends a code to the address if it has an account, and does nothing otherwise; the caller answers the same either way.
    /// Beyond a few codes an hour for one address it also sends nothing, again without saying so.
    /// </summary>
    public async Task RequestAsync(string address, CancellationToken cancellationToken)
    {
        var options = accountOptions.Value;
        var user = await FindAsync(address, cancellationToken);
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
        var id = Guid.CreateVersion7();
        // The same work whether or not the account exists, so the time the answer takes does not tell.
        var hash = Hash(id, code);
        if (user is null)
        {
            return;
        }

        var now = clock.UtcNow;
        if (await db.PasswordResetCodes.CountAsync(entry => entry.UserId == user.Id && entry.CreatedAt > now.AddHours(-1), cancellationToken) >= options.ResetRequestsPerHour)
        {
            return;
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            // Only the newest code counts: asking again cancels the one before.
            await db.PasswordResetCodes.Where(entry => entry.UserId == user.Id && entry.UsedAt == null)
                .ExecuteUpdateAsync(set => set.SetProperty(entry => entry.UsedAt, now), cancellationToken);
            db.PasswordResetCodes.Add(new PasswordResetCode
            {
                Id = id,
                UserId = user.Id,
                CodeHash = hash,
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(options.ResetCodeMinutes),
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        try
        {
            await email.SendAsync(PasswordResetMessage.For(user.Email!, code, options.ResetCodeMinutes), cancellationToken);
        }
        catch (ProviderException exception)
        {
            // Said to nobody: a failure that only some addresses could cause would reveal which ones have an account.
            logger.LogWarning(exception, "The password reset message could not be sent");
        }
    }

    /// <summary>
    /// Sets the new password if the code is the newest, unexpired, unused one for the address and has not been guessed at
    /// too often. Every way for the code to be wrong gives the same answer. A used code is dead, and so are all sessions.
    /// </summary>
    public async Task<Result<Unit>> ConfirmAsync(string address, string code, string newPassword, CancellationToken cancellationToken)
    {
        var user = await FindAsync(address, cancellationToken);

        // The rules for a password do not depend on the account, so asking first reveals nothing and burns no guess.
        if (await passwords.CheckRulesAsync(user, newPassword) is { } weak)
        {
            return weak;
        }

        var now = clock.UtcNow;
        var entry = user is null
            ? null
            : await db.PasswordResetCodes.AsNoTracking()
                .Where(found => found.UserId == user.Id && found.UsedAt == null)
                .OrderByDescending(found => found.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        if (user is null || entry is null || entry.ExpiresAt <= now)
        {
            Hash(Guid.Empty, code);
            return InvalidCode;
        }

        // The guess is counted before it is judged, by one statement, so parallel guesses cannot all go through under the limit.
        var counted = await db.PasswordResetCodes
            .Where(found => found.Id == entry.Id && found.UsedAt == null && found.Attempts < accountOptions.Value.ResetCodeAttempts)
            .ExecuteUpdateAsync(set => set.SetProperty(found => found.Attempts, found => found.Attempts + 1), cancellationToken);
        if (counted == 0 || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(entry.Id, code)), Encoding.ASCII.GetBytes(entry.CodeHash)))
        {
            return InvalidCode;
        }

        // Single use: of two requests with the right code at once, one wins.
        var used = await db.PasswordResetCodes.Where(found => found.Id == entry.Id && found.UsedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(found => found.UsedAt, now), cancellationToken);
        if (used == 0)
        {
            return InvalidCode;
        }

        await passwords.SetAsync(user, newPassword);
        await passwords.RevokeSessionsAsync(user.Id, keepRefreshToken: null, cancellationToken);
        return Unit.Value;
    }

    private Task<AppUser?> FindAsync(string address, CancellationToken cancellationToken)
    {
        var normalized = users.NormalizeEmail(AuthService.NormalizeEmail(address));
        return users.Users.FirstOrDefaultAsync(user => user.NormalizedEmail == normalized, cancellationToken);
    }

    /// <summary>
    /// A keyed hash of the code, bound to the code's own id. The key is the server's secret: with only a copy of the table
    /// the million possible codes cannot be tried offline, which a plain hash of six digits would allow.
    /// </summary>
    private string Hash(Guid id, string code) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes($"fitit.password-reset.v1:{jwtOptions.Value.SigningKey}"), Encoding.UTF8.GetBytes($"{id:N}:{code}")));
}
