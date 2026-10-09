using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>One thing worth changing in an outfit the person put together: a stable code for the app and one plain English sentence.</summary>
public sealed record Improvement(string Code, string Text);

/// <summary>What is good about the outfit, up to three things worth changing, and how well it holds together (0 to 100).</summary>
public sealed record Critique(IReadOnlyList<string> Positives, IReadOnlyList<Improvement> Improvements, int Score, AiCost Cost);

/// <summary>Today's weather where the person is, with the place's name for the sentences.</summary>
public sealed record CritiqueWeather(string Place, WeatherProfile Profile);

/// <summary>The garments the person chose, the occasion if they named one, and today's weather if they have a place.</summary>
public sealed record CritiqueRequest(IReadOnlyList<Garment> Garments, Occasion? Occasion, CritiqueWeather? Weather);

/// <summary>
/// Feedback on an outfit the person built themselves. Nothing here refuses an outfit: the person is free to choose, and the
/// answer only says what works and what could be better.
/// </summary>
public interface IOutfitCritic
{
    /// <exception cref="ProviderException">The provider failed or answered with something unusable.</exception>
    Task<Critique> CritiqueAsync(CritiqueRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// The rules behind the tips, in plain sentences: the hard rules of the stylist (<see cref="ViolationCode"/>), the penalties of
/// <see cref="CoherenceScore"/> and the weather table, each finding worded once and naming the garments it is about. The same
/// garments always get the same sentences.
/// </summary>
public static class RuleBasedCritique
{
    public const int MaxImprovements = 3;
    public const int MaxPositives = 3;

    private const int MissingPiece = 25;
    private const int WrongBody = 20;
    private const int WeatherMiss = 15;

    private static readonly string[] Numbers = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

    private sealed record Finding(int Priority, string Code, string Text, int Penalty);

    public static Critique Of(CritiqueRequest request, AiCost cost)
    {
        var items = request.Garments;
        Garment? One(Category role) => items.FirstOrDefault(garment => garment.Role == role);
        var top = One(Category.Top);
        var mid = One(Category.MidLayer);
        var bottom = One(Category.Bottom);
        var onePiece = One(Category.OnePiece);
        var outer = One(Category.Outerwear);
        var shoes = One(Category.Shoes);
        var dressed = items.Where(garment => garment.Role != Category.Accessory).ToList();

        var found = new List<Finding>();
        var structure = false;

        if (shoes is null)
        {
            found.Add(new Finding(1, "no_shoes", "No shoes yet. Add a pair to finish the outfit.", MissingPiece));
            structure = true;
        }

        if (onePiece is not null && (top is not null || bottom is not null))
        {
            found.Add(new Finding(1, "mixed_body", $"The {Named(onePiece)} already covers a top and a bottom, so leave out the {Named(top ?? bottom!)} or choose separates instead.", WrongBody));
            structure = true;
        }
        else if (onePiece is null && top is null && bottom is null)
        {
            found.Add(new Finding(1, "no_body", "Add a top and a bottom, or a dress, to build the outfit around.", MissingPiece));
            structure = true;
        }
        else if (onePiece is null && bottom is null)
        {
            found.Add(new Finding(1, "no_bottom", $"Add a bottom to go with the {Named(top!)}: trousers, a skirt or shorts.", MissingPiece));
            structure = true;
        }
        else if (onePiece is null && top is null)
        {
            found.Add(new Finding(1, "no_top", $"Add a top to go with the {Named(bottom!)}.", MissingPiece));
            structure = true;
        }

        var weatherOk = request.Weather is not null;
        if (request.Weather is { } here)
        {
            weatherOk = AddWeather(found, here, top ?? onePiece, mid, outer, dressed);
        }

        var mostFormal = items.MaxBy(garment => garment.Tags.Formality);
        var leastFormal = items.MinBy(garment => garment.Tags.Formality);
        var spread = items.Count == 0 ? 0 : mostFormal!.Tags.Formality - leastFormal!.Tags.Formality;
        if (spread > CoherenceScore.FormalitySpread)
        {
            found.Add(new Finding(4, "formality_gap", $"The {Named(mostFormal!)} is far more formal than the {Named(leastFormal!)}. Bring the two closer together.", (spread - CoherenceScore.FormalitySpread) * CoherenceScore.PerFormalityPoint));
        }

        var occasionOk = request.Occasion is not null;
        if (request.Occasion is { } occasion)
        {
            occasionOk = AddOccasion(found, occasion, dressed);
        }

        var strong = items.SelectMany(garment => garment.Tags.Colors).Where(colour => !GarmentCatalog.IsNeutral(colour)).Distinct().ToList();
        var paletteOk = strong.Count <= CoherenceScore.Colours;
        if (!paletteOk)
        {
            var swap = dressed.OrderByDescending(garment => garment.Tags.Colors.Count(colour => !GarmentCatalog.IsNeutral(colour))).First();
            found.Add(new Finding(6, "colors_compete", $"{Capital(Count(strong.Count))} strong colors compete here. Swap the {Named(swap)} for a neutral one.", (strong.Count - CoherenceScore.Colours) * CoherenceScore.PerExtraColour));
        }

        var patterned = items.Where(garment => garment.Tags.Pattern != Pattern.Plain).ToList();
        var patternsOk = patterned.Count <= CoherenceScore.Patterns;
        if (!patternsOk)
        {
            var text = patterned.Count == 2
                ? $"The {Named(patterned[0])} and the {Named(patterned[1])} are both patterned and compete. Keep one pattern and make the other piece plain."
                : $"{Capital(Count(patterned.Count))} patterned pieces compete. Keep one pattern and make the others plain.";
            found.Add(new Finding(7, "patterns_compete", text, (patterned.Count - CoherenceScore.Patterns) * CoherenceScore.PerExtraPattern));
        }

        var improvements = found.OrderBy(finding => finding.Priority).Take(MaxImprovements).Select(finding => new Improvement(finding.Code, finding.Text)).ToList();
        var score = Math.Clamp(CoherenceScore.Max - found.Sum(finding => finding.Penalty), 0, CoherenceScore.Max);

        var positives = new List<string>();
        if (!structure)
        {
            positives.Add(onePiece is not null
                ? $"The {Named(onePiece)} with the {Named(shoes!)} makes a complete outfit."
                : $"The {Named(top!)} and the {Named(bottom!)} make a complete outfit with the {Named(shoes!)}.");
        }

        if (request.Weather is { } weather && weatherOk)
        {
            positives.Add(weather.Profile.Rain && outer is { Tags.RainOk: true }
                ? $"The {Named(outer)} will keep you dry in {weather.Place} today."
                : $"It suits the {Temperature(weather.Profile)} forecast for {weather.Place} today.");
        }

        if (paletteOk && patternsOk && items.Count > 1)
        {
            positives.Add(strong.Count switch
            {
                0 => "The neutral palette is easy to wear and goes with everything.",
                1 => "One accent color keeps the palette calm.",
                _ => "The colors sit well together.",
            });
        }

        if (spread <= CoherenceScore.FormalitySpread && items.Count >= 3 && !found.Any(finding => finding.Code is "formality_gap"))
        {
            positives.Add("All the pieces sit at a similar level of dress.");
        }

        if (request.Occasion is { } named && occasionOk)
        {
            positives.Add($"The pieces suit the occasion: {OccasionRule.For(named).Label.ToLowerInvariant()}.");
        }

        return new Critique(positives.Take(MaxPositives).ToList(), improvements, score, cost);
    }

    /// <summary>Adds what the weather asks for and the outfit lacks; true when it found nothing.</summary>
    private static bool AddWeather(List<Finding> found, CritiqueWeather here, Garment? body, Garment? mid, Garment? outer, List<Garment> dressed)
    {
        var profile = here.Profile;
        var band = profile.Rule;
        var temp = Temperature(profile);
        var before = found.Count;
        var rainHandled = false;

        if (profile.Rain)
        {
            if (outer is null)
            {
                found.Add(new Finding(2, "rain_gear", $"It is {temp} and {(profile.Sky == Sky.Snow ? "snowy" : "rainy")} in {here.Place} today: add a jacket that handles rain.", WeatherMiss));
                rainHandled = true;
            }
            else if (!outer.Tags.RainOk)
            {
                found.Add(new Finding(2, "rain_gear", $"Rain is on the way in {here.Place} and the {Named(outer)} will not keep you dry. Choose a rain-proof jacket.", WeatherMiss));
                rainHandled = true;
            }
        }

        if (!rainHandled && band.NeedsOuterwear && outer is null)
        {
            found.Add(new Finding(3, "outerwear_needed", $"It feels like {temp} in {here.Place} today. Add a {(band.OuterwearMinWarmth >= 4 ? "warm coat" : "coat or jacket")}.", WeatherMiss));
        }
        else if (outer is not null && band.OuterwearMinWarmth is { } minimum && outer.Tags.Warmth < minimum)
        {
            found.Add(new Finding(3, "outerwear_light", $"The {Named(outer)} is too light for {temp}. Choose a warmer coat.", WeatherMiss));
        }

        if (band.NeedsMidLayer && mid is null)
        {
            found.Add(new Finding(3, "mid_layer_needed", $"At {temp}, add a sweater or another warm layer.", WeatherMiss));
        }
        else if (band.NeedsLayer && mid is null && outer is null)
        {
            found.Add(new Finding(3, "layer_needed", $"It feels like {temp} in {here.Place} today. Add a sweater or a light jacket you can take off.", WeatherMiss));
        }

        foreach (var garment in dressed.Where(garment => band.Excludes(garment.Tags)))
        {
            var name = Named(garment);
            var (code, text) = garment.Role switch
            {
                Category.Outerwear when !band.Outerwear => ("outerwear_not_needed", $"You will not need the {name} at {temp}. It will feel too warm."),
                Category.Bottom when garment.Tags.Subcategory == Subcategory.Shorts => ("cold_legs", $"Shorts will feel cold at {temp}. Try trousers or a long skirt instead of the {name}."),
                Category.Shoes when BandRule.IsOpen(garment.Tags.Subcategory) => ("cold_feet", $"The {name} will leave your feet cold at {temp}. Closed shoes are the better choice."),
                _ => ("too_warm", $"The {name} is too warm for {temp}. Swap it for something lighter."),
            };
            found.Add(new Finding(3, code, text, WeatherMiss / 2));
        }

        if (found.Count == before && body is not null)
        {
            var warmth = body.Tags.Warmth + (mid?.Tags.Warmth ?? 0) + (outer?.Tags.Warmth ?? 0);
            if (warmth < band.WarmthSumMin)
            {
                found.Add(new Finding(3, "too_cool", $"This is a bit light for {temp} in {here.Place}. Swap a piece for something warmer or add a layer.", (band.WarmthSumMin - warmth) * CoherenceScore.PerWarmthPoint));
            }
            else if (warmth > band.WarmthSumMax)
            {
                found.Add(new Finding(3, "too_warm_overall", $"This is warmer than {temp} in {here.Place} needs. Choose lighter pieces.", (warmth - band.WarmthSumMax) * CoherenceScore.PerWarmthPoint));
            }
        }

        return found.Count == before;
    }

    /// <summary>Adds the first piece that is too formal or too casual for the occasion, and the first of the wrong style; true when it found nothing.</summary>
    private static bool AddOccasion(List<Finding> found, Occasion occasion, List<Garment> dressed)
    {
        var rule = OccasionRule.For(occasion);
        var label = rule.Label.ToLowerInvariant();
        var before = found.Count;

        if (dressed.FirstOrDefault(garment => !rule.AllowsFormality(garment.Tags.Formality)) is { } off)
        {
            var casual = off.Tags.Formality < rule.FormalityMin;
            found.Add(new Finding(5, "occasion_formality", $"The {Named(off)} is too {(casual ? "casual" : "formal")} for this occasion ({label}).", CoherenceScore.PerFormalityPoint));
        }

        if (dressed.FirstOrDefault(garment => !rule.AllowsStyle(garment.Tags.Styles)) is { } wrong)
        {
            found.Add(new Finding(5, "occasion_style", rule.Only is { } only
                ? $"The {Named(wrong)} is not {only.ToString().ToLowerInvariant()} enough for this occasion ({label})."
                : $"The {Named(wrong)} is too {rule.Without?.ToString().ToLowerInvariant()} for this occasion ({label}).", CoherenceScore.PerFormalityPoint));
        }

        return found.Count == before;
    }

    private static string Temperature(WeatherProfile profile) => $"{Math.Round(profile.FeelsMin):0}°C";

    private static string Count(int number) => number < Numbers.Length ? Numbers[number] : number.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static string Capital(string word) => char.ToUpperInvariant(word[0]) + word[1..];

    /// <summary>The garment's own name, lower-cased at the start unless it opens with capitals of its own ("UGG boots"): "white T-shirt", "blue jeans".</summary>
    private static string Named(Garment garment)
    {
        var name = garment.Tags.Name.Trim();
        return name.Length > 1 && !char.IsUpper(name[1]) ? char.ToLowerInvariant(name[0]) + name[1..] : name;
    }
}
