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
/// One proposal as it was made, and what the person did with it afterwards: saved it, rated it, wore it. The three
/// proposals of one request share <see cref="RequestId"/>.
/// </summary>
public sealed class Outfit
{
    public const int NoteMaxLength = 200;
    public const int ReasoningMaxLength = 600;
    public const int WeatherNoteMaxLength = 300;
    public const int NameMaxLength = 60;

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

    /// <summary>The last day, as the person counts days, on which they said "I am wearing this".</summary>
    public DateOnly? WornOn { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>The person's own day these proposals are the picks of, as shown on the Today tab; null for everything asked for elsewhere.</summary>
    public DateOnly? DailyOn { get; init; }

    public List<OutfitItem> Items { get; init; } = [];

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

    public static string RelaxationCode(Relaxation relaxation) => $"{Common.EnumCodes.ToCode(relaxation.Role)}:{Common.EnumCodes.ToCode(relaxation.Rule)}";

    public static Relaxation ParseRelaxation(string code)
    {
        var parts = code.Split(':');
        return new Relaxation(Common.EnumCodes.Parse<Category>(parts[0]), Common.EnumCodes.Parse<RelaxedRule>(parts[1]));
    }
}
