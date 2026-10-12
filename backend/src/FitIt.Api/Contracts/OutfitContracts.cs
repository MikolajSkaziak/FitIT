using System.ComponentModel.DataAnnotations;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Api.Contracts;

public sealed class SuggestOutfitsRequest
{
    [Required]
    public Occasion? Occasion { get; init; }

    /// <summary>A nuance in the person's own words ("presentation for a client"). Passed to the stylist, never treated as a rule.</summary>
    [MaxLength(Outfit.NoteMaxLength)]
    public string? Note { get; init; }

    /// <summary>"Dobierz do tego": a garment that must be in every proposal.</summary>
    public Guid? BaseItemId { get; init; }

    /// <summary>
    /// The day of the person's calendar to dress for: today or one of the next six. Left out, the outfits are for the rest
    /// of today. The request counts against the limit of the day it is made on, whichever day it is for.
    /// </summary>
    public DateOnly? Date { get; init; }
}

public sealed class TodaysOutfitsRequest
{
    [Required]
    public Occasion? Occasion { get; init; }

    /// <summary>True asks for a new set even when today's picks for the occasion exist already.</summary>
    public bool Fresh { get; init; }
}

public enum SuggestionStatus
{
    /// <summary>One to three outfits were proposed and stored.</summary>
    Proposed,

    /// <summary>The wardrobe cannot dress the person for this weather and occasion; <c>Missing</c> names the roles it lacks.</summary>
    MissingGarments,
}

/// <summary>A rule that gave way for one role because the wardrobe had nothing that met it. The app words the sentence.</summary>
public sealed record RelaxationResponse(Category Role, RelaxedRule Rule);

/// <summary>The weather an outfit was proposed for. Temperatures are "feels like", in degrees Celsius.</summary>
public sealed record OutfitWeatherResponse(
    string Place,
    bool ForTomorrow,
    DateTimeOffset From,
    DateTimeOffset To,
    int FeelsMin,
    int FeelsMax,
    Sky Sky,
    bool Rain,
    int RainProbability,
    bool NeedsLayers,
    TemperatureBand Band);

public sealed record OutfitItemResponse(Category Slot, ClothingResponse Clothing);

/// <summary>
/// Where one garment lies on the outfit's board. <c>X</c> and <c>Y</c> are its centre in fractions of the board,
/// <c>Scale</c> its width as a fraction of the board's width, <c>Z</c> the stacking order: higher lies in front.
/// </summary>
public sealed record OutfitPlacementResponse(Guid ClothingId, double X, double Y, double Scale, int Z);

/// <summary>One garment's place on the board, as the person arranged it. The garment must be one of the outfit's, and named once.</summary>
public sealed class OutfitPlacementRequest
{
    [Required]
    public Guid? ClothingId { get; init; }

    [Required]
    [Range(0d, 1d)]
    public double? X { get; init; }

    [Required]
    [Range(0d, 1d)]
    public double? Y { get; init; }

    [Required]
    [Range(Outfit.PlacementMinScale, Outfit.PlacementMaxScale)]
    public double? Scale { get; init; }

    [Required]
    [Range(0, Outfit.PlacementMaxZ)]
    public int? Z { get; init; }

    public OutfitPlacement ToPlacement() => new(ClothingId!.Value, X!.Value, Y!.Value, Scale!.Value, Z!.Value);
}

/// <summary>
/// One outfit. <c>Kind</c> is null when the outfit did not earn a label. <c>Style</c> is the style the outfit was proposed in,
/// null when the stylist named none and for outfits the person built. <c>Reasoning</c> and <c>WeatherNote</c> are the
/// stylist's own sentences; everything else is codes the app words itself. <c>Umbrella</c> means rain is coming
/// and the wardrobe had no outerwear for it. <c>Source</c> is <c>rules</c> when the fallback composed the outfit.
/// <c>Visualization</c> is the newest visualization made for the outfit, or null when none was ever ordered.
/// <c>Layout</c> is the person's own arrangement of the garments on the board, or null while the app lays them out itself;
/// a garment it does not name keeps its automatic place. <c>FigureLayout</c> is the same for the "On figure" view.
/// </summary>
public sealed record OutfitResponse(
    Guid Id,
    Guid RequestId,
    Occasion Occasion,
    string? OccasionNote,
    string? Name,
    OutfitKind? Kind,
    StyleTag? Style,
    int Score,
    string Reasoning,
    string? WeatherNote,
    bool Umbrella,
    IReadOnlyList<RelaxationResponse> Relaxations,
    OutfitSource Source,
    OutfitRating Rating,
    bool IsSaved,
    DateOnly? WornOn,
    OutfitWeatherResponse? Weather,
    IReadOnlyList<OutfitItemResponse> Items,
    OutfitVisualizationResponse? Visualization,
    IReadOnlyList<OutfitPlacementResponse>? Layout,
    IReadOnlyList<OutfitPlacementResponse>? FigureLayout,
    DateTimeOffset CreatedAt);

/// <summary>
/// The answer to a request for proposals. With <c>Status</c> <c>proposed</c>, <c>Outfits</c> holds one to three outfits,
/// best score first. With <c>missing_garments</c>, <c>Outfits</c> is empty and the request did not count against the daily
/// limit. <c>Missing</c> lists the roles the wardrobe lacks that are each required; <c>MissingEither</c> lists roles of which
/// any one would do (a mid layer or outerwear when the weather asks for a layer), and is empty otherwise.
/// <c>Date</c> is the day of the person's calendar the outfits are for, and <c>Weather</c> the weather of it.
/// </summary>
public sealed record SuggestionsResponse(
    SuggestionStatus Status,
    DateOnly Date,
    IReadOnlyList<Category> Missing,
    IReadOnlyList<Category> MissingEither,
    bool Fallback,
    Occasion Occasion,
    WeatherResponse Weather,
    IReadOnlyList<RelaxationResponse> Relaxations,
    bool Umbrella,
    IReadOnlyList<OutfitResponse> Outfits);

/// <summary>An outfit the person put together: two to eight of their own garments. Weather and style never refuse it.</summary>
public sealed class CreateOutfitRequest
{
    [Required]
    public List<Guid>? Items { get; init; }

    /// <summary>Everyday when left out.</summary>
    public Occasion? Occasion { get; init; }

    [MaxLength(Outfit.NameMaxLength)]
    public string? Name { get; init; }

    /// <summary>
    /// False stores the outfit without saving it, like a proposal: enough to order a try-on picture of an outfit that is
    /// still being put together. Saved when left out.
    /// </summary>
    public bool? Saved { get; init; }

    /// <summary>
    /// The unsaved outfit (made with <c>saved: false</c>) this one replaces. Its try-on pictures move to the new outfit and
    /// it is deleted. An id that is not such an outfit of the person is ignored.
    /// </summary>
    public Guid? DraftId { get; init; }

    /// <summary>How the person arranged the garments on the board; left out, the app lays them out itself.</summary>
    public List<OutfitPlacementRequest>? Layout { get; init; }

    /// <summary>How the person arranged the garments on the figure; left out, the app places them itself.</summary>
    public List<OutfitPlacementRequest>? FigureLayout { get; init; }
}

/// <summary>A combination to get tips on: one to eight of the person's own garments, and the occasion if they named one.</summary>
public sealed class OutfitTipsRequest
{
    [Required]
    public List<Guid>? Items { get; init; }

    public Occasion? Occasion { get; init; }
}

public sealed record OutfitImprovementResponse(string Code, string Text);

/// <summary>What works (<c>Positives</c>, up to three), what could be better (<c>Improvements</c>, up to three) and how well the outfit holds together (<c>Score</c>, 0 to 100). The sentences are the server's own.</summary>
public sealed record OutfitTipsResponse(IReadOnlyList<string> Positives, IReadOnlyList<OutfitImprovementResponse> Improvements, int Score);

/// <summary>
/// Any subset: keep or drop the outfit, rate it (<c>none</c> clears the rating), say "I am wearing this" with <c>worn: true</c>,
/// or arrange its board with <c>layout</c> (null or an empty list goes back to the automatic layout; left out, the board stays as it is).
/// <c>figureLayout</c> does the same for the "On figure" view, independently of the board.
/// </summary>
public sealed class UpdateOutfitRequest
{
    private readonly List<OutfitPlacementRequest>? layout;
    private readonly List<OutfitPlacementRequest>? figureLayout;

    public bool? Saved { get; init; }

    public OutfitRating? Rating { get; init; }

    public bool? Worn { get; init; }

    public List<OutfitPlacementRequest>? Layout
    {
        get => layout;
        init
        {
            layout = value;
            LayoutGiven = true;
        }
    }

    /// <summary>Whether the request named <c>layout</c> at all: a null there clears the arrangement, leaving it out does not.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public bool LayoutGiven { get; private init; }

    public List<OutfitPlacementRequest>? FigureLayout
    {
        get => figureLayout;
        init
        {
            figureLayout = value;
            FigureLayoutGiven = true;
        }
    }

    /// <summary>Whether the request named <c>figureLayout</c> at all: a null there clears the arrangement, leaving it out does not.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public bool FigureLayoutGiven { get; private init; }
}
