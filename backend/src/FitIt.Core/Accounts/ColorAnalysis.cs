using FitIt.Core.Wardrobe;

namespace FitIt.Core.Accounts;

/// <summary>The twelve seasonal colour types. The codes are the snake case names; the English name is in <see cref="ColorSeasons"/>.</summary>
public enum ColorSeason
{
    LightSpring,
    WarmSpring,
    BrightSpring,
    LightSummer,
    CoolSummer,
    SoftSummer,
    SoftAutumn,
    WarmAutumn,
    DeepAutumn,
    DeepWinter,
    CoolWinter,
    BrightWinter,
}

/// <summary>The skin undertone, as the person judges it.</summary>
public enum SkinUndertone
{
    Warm,
    Cool,
    Neutral,
}

/// <summary>The hair colour, as the person sees it in daylight, from the lightest to the darkest. <see cref="Dyed"/> says "not natural or none of these".</summary>
public enum HairColor
{
    PlatinumBlond,
    GoldenBlond,
    Red,
    Auburn,
    LightBrown,
    DarkBrown,
    Black,
    Gray,
    Dyed,
}

/// <summary>The eye colour, from the lightest to the darkest.</summary>
public enum EyeColor
{
    LightBlue,
    Gray,
    Green,
    Hazel,
    Amber,
    DarkBrown,
    NearBlack,
}

/// <summary>
/// The answers of the questionnaire that replaces the photo. <paramref name="SkinTone"/> runs from 1 (very fair) to
/// <see cref="SkinTones"/> (deep); the undertone is asked separately.
/// </summary>
public sealed record ColorQuiz(int SkinTone, SkinUndertone Undertone, HairColor Hair, EyeColor Eyes)
{
    public const int SkinTones = 8;
}

/// <summary>Where the result came from. Only the result is kept, never the photo.</summary>
public enum ColorAnalysisSource
{
    Photo,
    Quiz,
}

/// <summary>A named colour. <paramref name="Wardrobe"/> is the wardrobe colour it corresponds to, where there is one.</summary>
public sealed record ColorSwatch(string Name, string Hex, Color? Wardrobe);

/// <summary>What the profile keeps: the type and its palette. This is all that is stored of an analysis.</summary>
public sealed record ColorProfile(
    ColorSeason Season,
    ColorAnalysisSource Source,
    IReadOnlyList<ColorSwatch> Best,
    IReadOnlyList<ColorSwatch> Soften,
    DateTimeOffset AnalyzedAt);

/// <summary>Either a stored photo to look at or the answers of the questionnaire.</summary>
public sealed record ColorAnalysisRequest(ImageSource? Photo, ColorQuiz? Quiz);

public sealed record ColorAnalysisOutcome(ColorSeason Season, IReadOnlyList<ColorSwatch> Best, IReadOnlyList<ColorSwatch> Soften, AiCost Cost);

/// <summary>Works out a person's seasonal colour type and palette, from a face photo or from three answers.</summary>
public interface IColorAnalyst
{
    /// <exception cref="ProviderException">The provider failed or answered with something unusable.</exception>
    Task<ColorAnalysisOutcome> AnalyzeAsync(ColorAnalysisRequest request, CancellationToken cancellationToken);
}
