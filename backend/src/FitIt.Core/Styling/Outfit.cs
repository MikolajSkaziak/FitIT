using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>Who composed an outfit: the model, the rules standing in for it, or the person themselves.</summary>
public enum OutfitSource
{
    Model,
    Rules,
    Manual,
}

public enum OutfitRating
{
    None,
    Like,
    Dislike,
}

/// <summary>The weather an outfit was proposed for, kept with it: context, choice and reaction stay together (product spec 8).</summary>
public sealed record WeatherSnapshot(
    string Place,
    bool ForTomorrow,
    DateTimeOffset From,
    DateTimeOffset To,
    double FeelsMin,
    double FeelsMax,
    int RainProbability,
    double RainMm,
    bool Rain,
    bool NeedsLayers,
    double Reference,
    TemperatureBand Band,
    Sky Sky)
{
    public static WeatherSnapshot Of(string place, WeatherProfile profile) => new(
        place, profile.ForTomorrow, profile.From, profile.To, profile.FeelsMin, profile.FeelsMax, profile.RainProbability, profile.RainMm,
        profile.Rain, profile.NeedsLayers, profile.Reference, profile.Band, profile.Sky);
}

/// <summary>A garment's place in a stored outfit.</summary>
public sealed class OutfitItem
{
    public Guid OutfitId { get; init; }

    public Guid ClothingItemId { get; init; }

    public Category Slot { get; init; }
}

/// <summary>
/// Where one garment lies on the outfit's board, as the person arranged it. <see cref="X"/> and <see cref="Y"/> are the
/// garment's centre in fractions of the board (0 to 1), <see cref="Scale"/> its width as a fraction of the board's width,
/// <see cref="Z"/> the stacking order: higher lies in front.
/// </summary>
public sealed record OutfitPlacement(Guid ClothingId, double X, double Y, double Scale, int Z);

/// <summary>
/// One proposal as it was made, and what the person did with it afterwards: saved it, rated it, wore it. The three
/// proposals of one request share <see cref="RequestId"/>.
/// </summary>
public sealed class Outfit
{
    public const int NoteMaxLength = 200;
    public const int ReasoningMaxLength = 600;
    public const int WeatherNoteMaxLength = 300;
    public const int NameMaxLength = 60;
    public const double PlacementMinScale = 0.05;
    public const double PlacementMaxScale = 1;
    public const int PlacementMaxZ = 99;

    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public Guid RequestId { get; init; }

    public Occasion Occasion { get; init; }

    public string? OccasionNote { get; init; }

    /// <summary>The name the person gave an outfit they built; null for proposals.</summary>
    public string? Name { get; init; }

    /// <summary>Null for an outfit the person built themselves while no weather place was set (or the forecast was unavailable).</summary>
    public WeatherSnapshot? Weather { get; init; }

    /// <summary>Rules that gave way for this request, as <c>role:rule</c> codes (<c>outerwear:formality</c>).</summary>
    public string[] Relaxations { get; init; } = [];

    /// <summary>Rain is coming and the wardrobe had no outerwear for it: the app adds "take an umbrella".</summary>
    public bool Umbrella { get; init; }

    public OutfitSource Source { get; init; }

    /// <summary>Null when the outfit did not meet the kind it was offered as, and for outfits the person built.</summary>
    public OutfitKind? Kind { get; init; }

    /// <summary>
    /// The style the outfit was proposed in: one the person liked at the time, or one near those. Null when the stylist named
    /// none, for outfits the person built, and for proposals made before styles were recorded.
    /// </summary>
    public StyleTag? Style { get; init; }

    public int Score { get; init; }

    public required string Reasoning { get; init; }

    public string? WeatherNote { get; init; }

    /// <summary>Null for outfits composed by the rules.</summary>
    public string? PromptVersion { get; init; }

    public string? Model { get; init; }

    public OutfitRating Rating { get; private set; }

    /// <summary>When the rating last changed; the newest liked and disliked outfits are the stylist's examples.</summary>
    public DateTimeOffset? RatedAt { get; private set; }

    public bool IsSaved { get; private set; }

    /// <summary>
    /// The last day, as the person counts days, on which they wore this: the newest worn day of its calendar entries, kept
    /// here for the lists and the stylist's history, which only ask "when last".
    /// </summary>
    public DateOnly? WornOn { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>The person's own day these proposals are the picks of, as shown on the Today tab; null for everything asked for elsewhere.</summary>
    public DateOnly? DailyOn { get; init; }

    public List<OutfitItem> Items { get; init; } = [];

    /// <summary>The person's own arrangement of the garments on the board; null while the app lays them out itself.</summary>
    public List<OutfitPlacement>? Layout { get; private set; }

    /// <summary>The person's own arrangement of the garments on the figure in the "On figure" view; null while the app places them itself. Independent of <see cref="Layout"/>.</summary>
    public List<OutfitPlacement>? FigureLayout { get; private set; }

    /// <summary>
    /// Whether an arrangement can belong to an outfit of these garments: each placement names one of them, none twice,
    /// and lies on the board at a size that can be seen. Garments left out keep their automatic place.
    /// </summary>
    public static bool FitsLayout(IReadOnlyList<OutfitPlacement> layout, IReadOnlyCollection<Guid> garments) =>
        layout.Count <= garments.Count
        && layout.Select(placement => placement.ClothingId).Distinct().Count() == layout.Count
        && layout.All(placement =>
            garments.Contains(placement.ClothingId)
            && placement.X is >= 0 and <= 1
            && placement.Y is >= 0 and <= 1
            && placement.Scale is >= PlacementMinScale and <= PlacementMaxScale
            && placement.Z is >= 0 and <= PlacementMaxZ);

    /// <summary>Keeps the arrangement; none, or an empty one, goes back to the automatic layout.</summary>
    public void Arrange(IReadOnlyList<OutfitPlacement>? layout) => Layout = layout is { Count: > 0 } ? [.. layout] : null;

    /// <summary>Keeps the arrangement on the figure; none, or an empty one, goes back to the automatic placement.</summary>
    public void ArrangeFigure(IReadOnlyList<OutfitPlacement>? layout) => FigureLayout = layout is { Count: > 0 } ? [.. layout] : null;

    public void Rate(OutfitRating rating, DateTimeOffset now)
    {
        if (Rating != rating)
        {
            Rating = rating;
            RatedAt = rating == OutfitRating.None ? null : now;
        }
    }

    public void Save(bool saved) => IsSaved = saved;

    public void Wear(DateOnly day) => WornOn = WornOn is { } last && last > day ? last : day;

    /// <summary>Sets the last worn day anew after a worn day was taken off the calendar; null when none is left.</summary>
    public void LastWorn(DateOnly? day) => WornOn = day;

    public static string RelaxationCode(Relaxation relaxation) => $"{Common.EnumCodes.ToCode(relaxation.Role)}:{Common.EnumCodes.ToCode(relaxation.Rule)}";

    public static Relaxation ParseRelaxation(string code)
    {
        var parts = code.Split(':');
        return new Relaxation(Common.EnumCodes.Parse<Category>(parts[0]), Common.EnumCodes.Parse<RelaxedRule>(parts[1]));
    }
}
