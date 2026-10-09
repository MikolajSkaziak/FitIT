using FitIt.Core.Wardrobe;

namespace FitIt.Core.Accounts;

/// <summary>The English name, the two sentences that explain a type, and its palette: the colours to wear more of and the ones to go easy on.</summary>
public sealed record ColorSeasonInfo(ColorSeason Season, string Name, string Summary, IReadOnlyList<ColorSwatch> Best, IReadOnlyList<ColorSwatch> Soften);

public static class ColorSeasons
{
    public static ColorSeasonInfo Of(ColorSeason season) => All[(int)season];

    /// <summary>Indexed by the enum, so the order here is the order of <see cref="ColorSeason"/>.</summary>
    public static readonly IReadOnlyList<ColorSeasonInfo> All =
    [
        new(ColorSeason.LightSpring, "Light spring",
            "Your coloring is warm, light and fresh. Clear, sunny colors suit you best, and heavy dark shades can overpower you.",
            [new("Peach", "#F8B79B", null), new("Warm ivory", "#FBF1DC", Color.Cream), new("Light aqua", "#8ED8CF", null), new("Coral", "#F28B7A", null), new("Buttercup", "#F6DC70", Color.Yellow), new("Spring green", "#A9D673", Color.Green), new("Camel", "#C8A27B", Color.Beige)],
            [new("Black", "#1C1F1E", Color.Black), new("Burgundy", "#6E2433", Color.Burgundy), new("Cool gray", "#77808A", Color.Grey), new("Dark navy", "#1E2A4A", Color.Navy)]),
        new(ColorSeason.WarmSpring, "Warm spring",
            "Your coloring is warm, golden and bright. Sunny, rich colors bring out your glow, while icy or cool shades make you look tired.",
            [new("Golden yellow", "#F2C230", Color.Yellow), new("Tangerine", "#F58B34", Color.Orange), new("Warm coral", "#EE6F57", null), new("Leaf green", "#7FB84A", Color.Green), new("Turquoise", "#2FB5A6", null), new("Camel", "#C69C6D", Color.Beige), new("Cream", "#F6EBCF", Color.Cream)],
            [new("Black", "#1C1F1E", Color.Black), new("Icy gray", "#C9D1D9", Color.Grey), new("Cool pink", "#E8A0BF", Color.Pink), new("Dark navy", "#1E2A4A", Color.Navy)]),
        new(ColorSeason.BrightSpring, "Bright spring",
            "Your coloring is clear and vivid, with strong contrast. Bright, saturated colors suit you, and soft muted tones look washed out.",
            [new("Bright coral", "#FF6F61", null), new("Clear turquoise", "#14B8C4", null), new("Vivid green", "#2DBE60", Color.Green), new("Sunny yellow", "#FFD23F", Color.Yellow), new("Warm pink", "#FF7EA8", Color.Pink), new("Cobalt blue", "#2F6FDB", Color.Blue), new("Pure white", "#FFFFFF", Color.White)],
            [new("Dusty rose", "#C9A0A0", null), new("Taupe", "#9A8C80", null), new("Muted olive", "#8A8C5E", Color.Olive), new("Charcoal gray", "#55595C", Color.Grey)]),
        new(ColorSeason.LightSummer, "Light summer",
            "Your coloring is cool, light and gentle. Soft, airy colors suit you best, while strong dark or orange-based shades feel heavy.",
            [new("Powder blue", "#A9C9E8", Color.LightBlue), new("Soft pink", "#F2B8C6", Color.Pink), new("Lavender", "#C3B1E1", Color.Purple), new("Mint", "#B5E0CF", null), new("Rose", "#F08FA8", null), new("Soft white", "#F4F1F2", Color.White), new("Light gray", "#BFC5CC", Color.Grey)],
            [new("Orange", "#E8883A", Color.Orange), new("Black", "#1C1F1E", Color.Black), new("Mustard", "#C99A2E", Color.Yellow), new("Rust", "#A5502F", null)]),
        new(ColorSeason.CoolSummer, "Cool summer",
            "Your coloring is cool, soft and a little muted. Dusty blues, roses and cool neutrals look natural on you, and golden shades can clash.",
            [new("Slate blue", "#6C84A8", Color.Blue), new("Rose pink", "#D87A99", Color.Pink), new("Plum", "#7A4F7A", Color.Purple), new("Soft teal", "#4F8F94", null), new("Cool gray", "#8E99A5", Color.Grey), new("Raspberry", "#B03A6B", null), new("Icy white", "#F2F5F8", Color.White)],
            [new("Orange", "#E8883A", Color.Orange), new("Mustard", "#C99A2E", Color.Yellow), new("Warm brown", "#8A5A3C", Color.Brown), new("Olive", "#6F7A3A", Color.Olive)]),
        new(ColorSeason.SoftSummer, "Soft summer",
            "Your coloring is cool-leaning and muted, with low contrast. Gentle, dusty colors blend with you, and very bright or very dark shades stand out too much.",
            [new("Dusty blue", "#7F9BB8", Color.Blue), new("Mauve", "#B08AA6", null), new("Sage", "#9CAF98", Color.Green), new("Soft teal", "#5F9496", null), new("Rose taupe", "#A98A8F", null), new("Heather gray", "#9AA0A6", Color.Grey), new("Soft navy", "#3E4A6B", Color.Navy)],
            [new("Black", "#1C1F1E", Color.Black), new("Bright orange", "#F2791F", Color.Orange), new("Stark white", "#F8F8F8", Color.White), new("Bright yellow", "#F7D708", Color.Yellow)]),
        new(ColorSeason.SoftAutumn, "Soft autumn",
            "Your coloring is warm-leaning and muted, with gentle contrast. Earthy, softened colors suit you best, while stark or icy shades look harsh.",
            [new("Sage green", "#A3B18A", Color.Green), new("Warm taupe", "#A68F7D", Color.Beige), new("Terracotta", "#C4745A", null), new("Muted teal", "#5E8C87", null), new("Soft olive", "#8A8F5A", Color.Olive), new("Cream", "#F1E6D0", Color.Cream), new("Dusty rose", "#C99A8E", null)],
            [new("Black", "#1C1F1E", Color.Black), new("Icy blue", "#BFE3F2", Color.LightBlue), new("Hot pink", "#E0488A", Color.Pink), new("Pure white", "#FFFFFF", Color.White)]),
        new(ColorSeason.WarmAutumn, "Warm autumn",
            "Your coloring is warm, rich and golden. Spicy, earthy colors make you glow, and cool or pastel shades pull the warmth out of your face.",
            [new("Rust", "#B7410E", null), new("Mustard", "#D9A21B", Color.Yellow), new("Olive", "#6B7A2A", Color.Olive), new("Pumpkin", "#E07B1A", Color.Orange), new("Chocolate brown", "#6B4226", Color.Brown), new("Teal", "#1F6F73", null), new("Cream", "#F3E5C3", Color.Cream)],
            [new("Icy pink", "#F3D1E0", Color.Pink), new("Cool gray", "#8A93A0", Color.Grey), new("Fuchsia", "#D62E8C", null), new("Black", "#1C1F1E", Color.Black)]),
        new(ColorSeason.DeepAutumn, "Deep autumn",
            "Your coloring is deep, warm and rich. Dark, earthy colors with depth suit you, and light pastels look faded next to you.",
            [new("Forest green", "#2E5A3C", Color.Green), new("Burgundy", "#6D1F2F", Color.Burgundy), new("Espresso brown", "#4A2E1F", Color.Brown), new("Rust", "#B7410E", null), new("Deep teal", "#17595A", null), new("Burnt orange", "#C85A17", Color.Orange), new("Warm cream", "#F0E2C0", Color.Cream)],
            [new("Pastel pink", "#F5D5E0", Color.Pink), new("Light gray", "#C4C9CE", Color.Grey), new("Icy blue", "#BFE3F2", Color.LightBlue), new("Pale lavender", "#D8D0EE", Color.Purple)]),
        new(ColorSeason.DeepWinter, "Deep winter",
            "Your coloring is deep and cool, with strong contrast. Dark, rich colors and crisp white suit you best, and soft muted shades fade away.",
            [new("Black", "#111315", Color.Black), new("Navy", "#14213D", Color.Navy), new("Burgundy", "#6D1F2F", Color.Burgundy), new("Pine green", "#0F4C3A", Color.Green), new("Royal purple", "#4B2A7B", Color.Purple), new("Crisp white", "#FFFFFF", Color.White), new("True red", "#B3202A", Color.Red)],
            [new("Camel", "#C69C6D", Color.Beige), new("Warm beige", "#D8C3A5", Color.Beige), new("Peach", "#F8B79B", null), new("Mustard", "#C99A2E", Color.Yellow)]),
        new(ColorSeason.CoolWinter, "Cool winter",
            "Your coloring is cool, clear and high in contrast. Icy and jewel-toned colors suit you, while warm earthy shades dull your skin.",
            [new("Royal blue", "#2B4DC3", Color.Blue), new("Fuchsia", "#D6246E", null), new("Emerald", "#0B8A5F", Color.Green), new("True red", "#B3202A", Color.Red), new("Pure white", "#FFFFFF", Color.White), new("Charcoal", "#3B4252", Color.Grey), new("Icy lilac", "#C7B8F2", Color.Purple)],
            [new("Orange", "#E8883A", Color.Orange), new("Mustard", "#C99A2E", Color.Yellow), new("Camel", "#C69C6D", Color.Beige), new("Olive", "#6F7A3A", Color.Olive)]),
        new(ColorSeason.BrightWinter, "Bright winter",
            "Your coloring is cool, vivid and striking. Clear, saturated colors and sharp contrast suit you, and dusty or muted shades look dull.",
            [new("Hot pink", "#F02B84", Color.Pink), new("Cobalt", "#1F4FE0", Color.Blue), new("Pure white", "#FFFFFF", Color.White), new("Black", "#111315", Color.Black), new("Emerald", "#0FA36B", Color.Green), new("Lemon yellow", "#F7E733", Color.Yellow), new("Electric purple", "#7B2FF2", Color.Purple)],
            [new("Beige", "#D8C3A5", Color.Beige), new("Dusty rose", "#C9A0A0", null), new("Khaki", "#9C9A6B", Color.Olive), new("Taupe", "#9A8C80", null)]),
    ];

    // How dark each answer is, 0 (lightest) to 100 (darkest). The skin tone runs on the same scale.
    private static readonly int[] HairDepth = [5, 20, 35, 55, 50, 78, 100, 25, 0];
    private static readonly int[] EyeDepth = [10, 30, 40, 55, 60, 85, 100];

    // Warm (+) or cool (-) nudges from the features that lean one way: golden and red hair, amber eyes; ash and gray hair, gray eyes.
    private static readonly int[] HairWarmth = [-1, 1, 1, 1, 0, 0, 0, -1, 0];
    private static readonly int[] EyeWarmth = [0, -1, 0, 0, 1, 0, 0];

    /// <summary>
    /// The fixed table behind the questionnaire. The row is the temperature (warm, neutral, cool: the undertone counts two, the
    /// features that lean one way one each), the column group the depth (light, medium, deep: the weighted average of skin, hair
    /// and eyes, hair left out when it is dyed) and the column inside it the contrast (low, medium, high: the largest gap between
    /// the skin and the hair or eyes). Every one of the twelve types can be reached.
    /// </summary>
    private static readonly ColorSeason[][][] QuizTable =
    [
        // Warm: light, medium, deep
        [
            [ColorSeason.LightSpring, ColorSeason.LightSpring, ColorSeason.WarmSpring],
            [ColorSeason.SoftAutumn, ColorSeason.WarmAutumn, ColorSeason.WarmSpring],
            [ColorSeason.DeepAutumn, ColorSeason.DeepAutumn, ColorSeason.WarmAutumn],
        ],
        // Neutral
        [
            [ColorSeason.LightSummer, ColorSeason.LightSpring, ColorSeason.BrightSpring],
            [ColorSeason.SoftSummer, ColorSeason.SoftAutumn, ColorSeason.BrightSpring],
            [ColorSeason.DeepAutumn, ColorSeason.DeepWinter, ColorSeason.BrightWinter],
        ],
        // Cool
        [
            [ColorSeason.LightSummer, ColorSeason.LightSummer, ColorSeason.BrightWinter],
            [ColorSeason.SoftSummer, ColorSeason.CoolSummer, ColorSeason.CoolWinter],
            [ColorSeason.DeepWinter, ColorSeason.DeepWinter, ColorSeason.CoolWinter],
        ],
    ];

    /// <summary>A pure function of the four answers: the same answers always give the same type.</summary>
    public static ColorSeason FromQuiz(ColorQuiz quiz)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(quiz.SkinTone, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(quiz.SkinTone, ColorQuiz.SkinTones);

        var skin = (quiz.SkinTone - 1) * 100 / (ColorQuiz.SkinTones - 1);
        var eyes = EyeDepth[(int)quiz.Eyes];
        var dyed = quiz.Hair == HairColor.Dyed;
        var hair = HairDepth[(int)quiz.Hair];

        var depthScore = dyed ? (2 * skin + eyes) / 3 : (2 * skin + 2 * hair + eyes) / 5;
        var depth = depthScore < 35 ? 0 : depthScore < 65 ? 1 : 2;

        var gap = Math.Max(dyed ? 0 : Math.Abs(skin - hair), Math.Abs(skin - eyes));
        var contrast = gap < 30 ? 0 : gap < 50 ? 1 : 2;

        var warmth = quiz.Undertone switch { SkinUndertone.Warm => 2, SkinUndertone.Cool => -2, _ => 0 }
            + HairWarmth[(int)quiz.Hair] + EyeWarmth[(int)quiz.Eyes];
        var temperature = warmth >= 2 ? 0 : warmth <= -2 ? 2 : 1;

        return QuizTable[temperature][depth][contrast];
    }
}
