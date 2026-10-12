namespace FitIt.Infrastructure.Styling;

/// <summary>
/// The fixed part of the request to the stylist model (product spec 6.5): role, rules of composing, the three kinds of
/// proposal and the language of the reasoning. It lives in the repository as a file, so a change of wording is a change
/// that can be reviewed and evaluated; its version is stored with every outfit the model proposes.
/// </summary>
public static class StylistPrompt
{
    public const string Version = "stylist-v4";

    private static readonly Lazy<string> Text = new(() =>
    {
        var name = $"{typeof(StylistPrompt).Namespace}.Prompts.{Version}.md";
        using var stream = typeof(StylistPrompt).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"The stylist prompt {name} is not embedded in the assembly.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    });

    public static string System => Text.Value;
}
