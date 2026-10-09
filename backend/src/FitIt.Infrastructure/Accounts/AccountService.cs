using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Accounts;

/// <summary>What a signed-in person does to their own account that needs the password: change it, or end the account.</summary>
public sealed class AccountService(
    UserManager<AppUser> users,
    AppDbContext db,
    PasswordService passwords,
    IBackgroundJobs jobs,
    ILogger<AccountService> logger)
{
    private static readonly ApiError WrongPassword = ApiError.BadRequest("wrong_password", "The password is wrong.");
    private static readonly ApiError LockedOut = ApiError.TooManyRequests("locked_out", "Too many failed attempts. Try again in a few minutes.");

    /// <summary>Sets a new password and ends the person's other sessions; <paramref name="keepRefreshToken"/> names the session that stays.</summary>
    public async Task<Result<Unit>> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, string? keepRefreshToken, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return ApiError.Unauthorized("account_gone", "The account no longer exists.");
        }

        if (await VerifyAsync(user, currentPassword) is { } refused)
        {
            return refused;
        }

        if (await passwords.CheckRulesAsync(user, newPassword) is { } weak)
        {
            return weak;
        }

        await passwords.SetAsync(user, newPassword);
        await passwords.RevokeSessionsAsync(userId, keepRefreshToken, cancellationToken);
        return Unit.Value;
    }

    /// <summary>
    /// Ends the account, confirmed with the password. Everything the person owns goes with the user row (the database
    /// cascades); their files go in a job, because storage is not part of the database. The cost log keeps its rows with
    /// no user id, so what the service spent stays known although who it was spent on does not.
    /// </summary>
    public async Task<Result<Unit>> DeleteAsync(Guid userId, string password, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return ApiError.Unauthorized("account_gone", "The account no longer exists.");
        }

        if (await VerifyAsync(user, password) is { } refused)
        {
            return refused;
        }

        var deleted = await db.Users.Where(found => found.Id == userId).ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0)
        {
            return ApiError.Unauthorized("account_gone", "The account no longer exists.");
        }

        // After the rows: a job that fails to delete a file can be run again, a file kept for a person who no longer exists cannot be found.
        jobs.Enqueue<AccountCleanup>(cleanup => cleanup.DeleteFilesAsync(userId));
        logger.LogInformation("An account was deleted");
        return Unit.Value;
    }

    /// <summary>A wrong password counts toward the same lockout as at login: a stolen access token must not make guessing free.</summary>
    private async Task<ApiError?> VerifyAsync(AppUser user, string password)
    {
        if (await users.IsLockedOutAsync(user))
        {
            return LockedOut;
        }

        if (await users.CheckPasswordAsync(user, password))
        {
            await users.ResetAccessFailedCountAsync(user);
            return null;
        }

        await users.AccessFailedAsync(user);
        return await users.IsLockedOutAsync(user) ? LockedOut : WrongPassword;
    }
}

/// <summary>The background half of deleting an account: every file under the person's prefix.</summary>
public sealed class AccountCleanup(IImageStorage storage, ILogger<AccountCleanup> logger)
{
    private const int Batch = 200;

    /// <summary>Safe to run again: it deletes what is there. Files written by jobs that were still running at the time are caught by the nightly sweep for files no row points to.</summary>
    public async Task<int> DeleteFilesAsync(Guid userId)
    {
        var removed = 0;
        var batch = new List<string>(Batch);
        await foreach (var stored in storage.ListAsync(ObjectKeys.PrefixOf(userId), CancellationToken.None))
        {
            batch.Add(stored.Key);
            if (batch.Count == Batch)
            {
                await storage.DeleteAsync(batch, CancellationToken.None);
                removed += batch.Count;
                batch.Clear();
            }
        }

        await storage.DeleteAsync(batch, CancellationToken.None);
        removed += batch.Count;
        logger.LogInformation("Deleted {Count} files of a deleted account", removed);
        return removed;
    }
}
