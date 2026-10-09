namespace FitIt.Core.Accounts;

/// <summary>A plain text message. Its body may hold a secret (a code), so nothing but its existence is ever logged.</summary>
public sealed record EmailMessage(string To, string Subject, string Body);

/// <summary>Sends mail. The only caller so far is the password reset.</summary>
public interface IEmailSender
{
    /// <exception cref="Wardrobe.ProviderException">The mail service did not take the message.</exception>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
