using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// The fixed instructions of the Gemini adapters. Like the stylist's, they live in the repository as files, so a change of
/// wording is a change that can be reviewed, and each carries its version in its name.
/// </summary>
public static class GeminiPrompts
{
    public const string TaggerVersion = "tagger-v2";
    public const string CriticVersion = "critic-v1";
    public const string ColorAnalystVersion = "color-analyst-v1";
    public const string ChatVersion = "chat-v1";

    /// <summary>The place in the tagger's instructions where the definitions of the styles go; they come from <see cref="StyleGuide"/>, the same text the stylist is sent.</summary>
    public const string StyleGuidePlaceholder = "{{style_guide}}";

    private static readonly Lazy<string> TaggerText = new(() => Load(TaggerVersion).Replace(StyleGuidePlaceholder, StyleGuide.AsList(), StringComparison.Ordinal));
    private static readonly Lazy<string> CriticText = new(() => Load(CriticVersion));
    private static readonly Lazy<string> ColorAnalystText = new(() => Load(ColorAnalystVersion));
    private static readonly Lazy<string> ChatText = new(() => Load(ChatVersion));

    public static string Tagger => TaggerText.Value;

    public static string Critic => CriticText.Value;

    public static string ColorAnalyst => ColorAnalystText.Value;

    public static string Chat => ChatText.Value;

    private static string Load(string version)
    {
        var name = $"{typeof(GeminiPrompts).Namespace}.Prompts.{version}.md";
        using var stream = typeof(GeminiPrompts).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"The prompt {name} is not embedded in the assembly.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
