using System.Collections.Concurrent;
using FitIt.Core.Accounts;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Accounts;

/// <summary>
/// Stands in for the mail service until there is one. Messages are kept in memory, where a test can read the code it sent;
/// nothing leaves the process. The log says only that a message was sent: neither the address nor the body is written
/// anywhere, because the body holds a code that opens somebody's account.
/// </summary>
public sealed class FakeEmailSender(ILogger<FakeEmailSender> logger) : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    public IReadOnlyCollection<EmailMessage> Sent => [.. _sent];

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        _sent.Enqueue(message);
        logger.LogInformation("The fake e-mail sender took a message; {Count} kept in memory", _sent.Count);
        return Task.CompletedTask;
    }

    public void Clear() => _sent.Clear();
}
