using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>
/// A garment as the stylist's rules see it: its tags and how it has been used. <see cref="Forgotten"/> and
/// <see cref="RecentlyWorn"/> are already settled against the person's own day, so nothing here needs a clock.
/// </summary>
public sealed record Garment(
    Guid Id,
    GarmentTags Tags,
    string Description = "",
    int WearCount = 0,
    bool Forgotten = false,
    bool RecentlyWorn = false,
    int Likes = 0,
    bool InLaundry = false)
{
    /// <summary>The place a garment takes in an outfit is its category: there is one slot per category, and only accessories share theirs.</summary>
    public Category Role => Tags.Category;
}

/// <summary>A rule of the candidate filter that gave way for one role because the wardrobe had nothing else (product spec 6.4).</summary>
public enum RelaxedRule
{
    /// <summary>The occasion's formality range, widened by one at both ends.</summary>
    Formality,

    /// <summary>The occasion's style rule, dropped.</summary>
    Style,

    /// <summary>The warmth limits of the weather, given a tolerance of one.</summary>
    Warmth,
}

/// <summary>Told to the person with the proposals: "nothing formal enough for outerwear, so here is the closest".</summary>
public sealed record Relaxation(Category Role, RelaxedRule Rule);

/// <summary>A garment the stylist may use, under the short name it has in the request (<c>T3</c>, <c>B2</c>).</summary>
public sealed record Candidate(string Alias, Garment Garment);

/// <summary>What the weather asks of every outfit of one request. Shoe and garment types are already settled by who became a candidate.</summary>
public sealed record WeatherDemands(bool Layer, bool MidLayer, bool Outerwear, int? OuterwearMinWarmth, bool RainOuterwear, bool ClosedShoes)
{
    public static readonly WeatherDemands None = new(false, false, false, null, false, false);
}

/// <summary>
/// The outcome of the candidate filter: the garments the stylist may choose from, what every outfit must contain, which
/// rules gave way, and, when a required role stayed empty, which roles the wardrobe lacks. <see cref="Missing"/> lists
/// roles that are each required; <see cref="MissingEither"/> lists roles of which any one would do (a mid layer or
/// outerwear), and is empty unless the wardrobe has none of them.
/// </summary>
public sealed record CandidateSet(
    IReadOnlyList<Candidate> Items,
    WeatherDemands Demands,
    IReadOnlyList<Relaxation> Relaxations,
    IReadOnlyList<Category> Missing,
    IReadOnlyList<Category> MissingEither,
    bool Umbrella,
    Garment? BaseItem)
{
    /// <summary>False when the wardrobe cannot dress the person for this weather and occasion; the stylist is then not asked at all.</summary>
    public bool IsComplete => Missing.Count == 0 && MissingEither.Count == 0;

    public IReadOnlyList<Garment> Of(Category role) => [.. Items.Where(candidate => candidate.Garment.Role == role).Select(candidate => candidate.Garment)];

    public Candidate? Find(string alias) => Items.FirstOrDefault(candidate => candidate.Alias == alias);

    public string? AliasOf(Guid garmentId) => Items.FirstOrDefault(candidate => candidate.Garment.Id == garmentId)?.Alias;

    /// <summary>
    /// How many slots two proposals must differ in: two when the wardrobe gives a choice in at least two places, fewer
    /// when it does not (product spec 6.6, "as far as the wardrobe allows").
    /// </summary>
    public int MinDifference
    {
        get
        {
            int Count(Category role) => Items.Count(candidate => candidate.Garment.Role == role);
            var open = 0;
            foreach (var role in (Category[])[Category.Top, Category.Bottom, Category.OnePiece, Category.Shoes])
            {
                open += Count(role) > 1 ? 1 : 0;
            }

            // Changing between separates and a one-piece changes three slots at once.
            open += Count(Category.OnePiece) > 0 && Count(Category.Top) > 0 && Count(Category.Bottom) > 0 ? 2 : 0;
            open += Count(Category.MidLayer) > (Demands.MidLayer || BaseItem?.Role == Category.MidLayer ? 1 : 0) ? 1 : 0;
            open += Count(Category.Outerwear) > (Demands.Outerwear || BaseItem?.Role == Category.Outerwear ? 1 : 0) ? 1 : 0;
            open += Items.Any(candidate => candidate.Garment.Role == Category.Accessory && candidate.Garment.Id != BaseItem?.Id) ? 1 : 0;
            return Math.Min(2, open);
        }
    }
}
