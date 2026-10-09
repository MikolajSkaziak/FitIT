namespace FitIt.Core.Accounts;

/// <summary>
/// A code e-mailed to somebody who forgot their password. Only an HMAC of the code is stored, never the code itself: six
/// digits are easy to guess, so what protects them is the short life, the limited attempts and the single use below.
/// </summary>
public sealed class PasswordResetCode
{
    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public required string CodeHash { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    /// <summary>Wrong guesses so far. Counted in the database by one statement, so parallel guesses cannot all slip through.</summary>
    public int Attempts { get; set; }

    /// <summary>Set when the code was used, or replaced by a newer one. A used code is dead.</summary>
    public DateTimeOffset? UsedAt { get; set; }
}
