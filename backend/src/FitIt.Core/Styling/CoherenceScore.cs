using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Core.Styling;

/// <summary>
/// How well an outfit holds together, from 0 to 100 (product spec 6.6). Proposals are shown best first, and the
/// rule-based generator picks by it. Every outfit starts at 100 and pays for what the table lists.
/// </summary>
public static class CoherenceScore
{
    public const int Max = 100;

    public const int PerWarmthPoint = 15;
    public const int PerFormalityPoint = 10;
    public const int PerExtraColour = 10;
    public const int PerExtraPattern = 10;
    public const int PerRecentlyWorn = 5;

    public const int FormalitySpread = 2;
    public const int Colours = 3;
    public const int Patterns = 1;

    public static int Of(OutfitDraft outfit, BandRule band)
    {
        var items = outfit.Items.ToList();

        // Top, mid layer and outerwear; a one-piece stands where the top would.
        var warmth = (outfit.Top ?? outfit.OnePiece)?.Tags.Warmth + (outfit.MidLayer?.Tags.Warmth ?? 0) + (outfit.Outerwear?.Tags.Warmth ?? 0) ?? 0;
        var offWarmth = Math.Max(0, band.WarmthSumMin - warmth) + Math.Max(0, warmth - band.WarmthSumMax);

        var spread = items.Max(garment => garment.Tags.Formality) - items.Min(garment => garment.Tags.Formality);
        var colours = items.SelectMany(garment => garment.Tags.Colors).Where(colour => !GarmentCatalog.IsNeutral(colour)).Distinct().Count();
        var patterns = items.Count(garment => garment.Tags.Pattern != Pattern.Plain);

        var penalty = (offWarmth * PerWarmthPoint)
            + (Math.Max(0, spread - FormalitySpread) * PerFormalityPoint)
            + (Math.Max(0, colours - Colours) * PerExtraColour)
            + (Math.Max(0, patterns - Patterns) * PerExtraPattern)
            + (items.Count(garment => garment.RecentlyWorn) * PerRecentlyWorn);
        return Math.Clamp(Max - penalty, 0, Max);
    }
}
