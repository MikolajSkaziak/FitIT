using System.Globalization;
using System.Text;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>A garment as the image model is told about it: the model's own English sentence and the role it plays.</summary>
public sealed record PromptGarment(string Description, Category Role);

/// <summary>
/// The request to the image model (product spec 7.4): a template that lives in the repository as a file, filled with the
/// descriptions the tagging model wrote. Nothing the person typed ever enters it. Its version is stored with every order,
/// so a change of wording is a reviewed change and the pictures can be compared across versions.
/// </summary>
public static class VisualizationPrompt
{
    public const string Version = "visualizer-v2";

    /// <summary>The image model takes the silhouette and at most this many garments of the accessory kind; the rest of the outfit always fits.</summary>
    public const int MaxAccessories = 2;

    private const string Placeholder = "{garments}";

    /// <summary>The line about fit; v2 added it. It is dropped from the prompt when the person has not said anything.</summary>
    private const string FitPlaceholder = "{fit}";

    private static readonly Lazy<string> Template = new(() =>
    {
        var name = $"{typeof(VisualizationPrompt).Namespace}.Prompts.{Version}.md";
        using var stream = typeof(VisualizationPrompt).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"The visualization prompt {name} is not embedded in the assembly.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd().Trim();
    });

    /// <summary>
    /// A neutral hint about how the garments should fit, such as "usual clothing size M, longer legs", or null when the
    /// person has said neither. It is made only from the two enums, never from text the person typed.
    /// </summary>
    public static string? FitHint(ClothingSize? size, LegLength? legs)
    {
        var parts = new List<string>();
        if (size is { } known)
        {
            parts.Add($"usual clothing size {EnumCodes.ToCode(known).ToUpperInvariant()}");
        }

        if (legs is { } length)
        {
            parts.Add($"{EnumCodes.ToCode(length)} legs");
        }

        return parts.Count == 0 ? null : string.Join(", ", parts);
    }

    /// <summary>Garments are numbered from 2: image 1 is the silhouette. They must come in the order the images are sent.</summary>
    public static string Build(IReadOnlyList<PromptGarment> garments, string? fit = null)
    {
        var lines = new StringBuilder();
        for (var index = 0; index < garments.Count; index++)
        {
            if (index > 0)
            {
                lines.Append('\n');
            }

            lines.Append(string.Create(CultureInfo.InvariantCulture, $"{index + 2}: {garments[index].Description.Trim()} ({EnumCodes.ToCode(garments[index].Role).Replace('_', ' ')})"));
        }

        var template = Template.Value;
        template = fit is null
            ? template.Replace(FitPlaceholder + "\n", "", StringComparison.Ordinal)
            : template.Replace(FitPlaceholder, $"Fit notes, only for how the garments sit on the body: {fit}.", StringComparison.Ordinal);
        return template.Replace(Placeholder, lines.ToString(), StringComparison.Ordinal);
    }
}
