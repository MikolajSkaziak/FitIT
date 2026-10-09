using FitIt.Core.Accounts;

namespace FitIt.Infrastructure.Accounts;

/// <summary>The e-mail with the code. Plain English text, second person.</summary>
public static class PasswordResetMessage
{
    public const string Subject = "Your fitit. password reset code";

    public static EmailMessage For(string to, string code, int validMinutes) => new(
        to,
        Subject,
        $"""
        Your fitit. password reset code: {code}

        Enter it in the app together with your new password. The code works once and is valid for {validMinutes} minutes.

        If you did not ask for this, ignore this message. Your password will stay the same.
        """);
}
