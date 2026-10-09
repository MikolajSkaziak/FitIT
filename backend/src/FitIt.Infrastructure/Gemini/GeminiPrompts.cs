namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// The fixed instructions of the Gemini adapters. Like the stylist's, they live in the repository as files, so a change of
/// wording is a change that can be reviewed, and each carries its version in its name.
/// </summary>
public static class GeminiPrompts
{
    public const string TaggerVersion = "tagger-v1";
    public const string CriticVersion = "critic-v1";
    public const string ColorAnalystVersion = "color-analyst-v1";

    private static readonly Lazy<string> TaggerText = new(() => Load(TaggerVersion));
    private static readonly Lazy<string> CriticText = new(() => Load(CriticVersion));
    private static readonly Lazy<string> ColorAnalystText = new(() => Load(ColorAnalystVersion));

    public static string Tagger => TaggerText.Value;

    public static string Critic => CriticText.Value;

    public static string ColorAnalyst => ColorAnalystText.Value;

    private static string Load(string version)
    {
        var name = $"{typeof(GeminiPrompts).Namespace}.Prompts.{version}.md";
        using var stream = typeof(GeminiPrompts).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"The prompt {name} is not embedded in the assembly.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
