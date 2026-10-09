using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Tests.Styling;

/// <summary>Garments and weather for the stylist's unit tests, written as briefly as the rule under test allows.</summary>
internal static class Looks
{
    private static int _next;

    /// <summary>A plain black cotton garment of formality 2 and warmth 2 unless said otherwise. Ids rise in the order of creation.</summary>
    public static Garment Garment(
        Subcategory type,
        int formality = 2,
        int warmth = 2,
        StyleTag[]? styles = null,
        bool rainOk = false,
        Material material = Material.Cotton,
        Color[]? colors = null,
        Pattern pattern = Pattern.Plain,
        bool forgotten = false,
        int wearCount = 0,
        int likes = 0,
        bool recentlyWorn = false,
        bool inLaundry = false,
        string? name = null)
    {
        var id = new Guid(Interlocked.Increment(ref _next), 0, 0, new byte[8]);
        var tags = new GarmentTags(
            GarmentCatalog.CategoryOf(type), type, name ?? GarmentCatalog.Label(type), colors ?? [Color.Black], pattern, material, formality, warmth, rainOk, styles ?? [StyleTag.Casual]);
        return new Garment(id, tags, tags.Describe(), wearCount, forgotten, recentlyWorn, likes, inLaundry);
    }

    /// <summary>A day whose coldest hour feels like <paramref name="feels"/>; the band follows from the default thresholds.</summary>
    public static WeatherProfile Day(double feels, bool rain = false, bool needsLayers = false)
    {
        var from = new DateTimeOffset(2026, 10, 6, 10, 0, 0, TimeSpan.FromHours(9));
        return new WeatherProfile(
            from, from.AddHours(12), false, feels, needsLayers ? feels + 9 : feels + 2, from, from.AddHours(5), rain ? 80 : 10, rain ? 4 : 0, rain ? from : null,
            feels, new WeatherRules().BandOf(feels), rain, needsLayers, rain ? Sky.Rain : Sky.CloudSun);
    }

    public const double Hot = 28;
    public const double Warm = 20;
    public const double Mild = 14;
    public const double Cold = 6;
    public const double Freezing = -5;

    public static IReadOnlyList<Garment> In(this CandidateSet candidates, Category role) => candidates.Of(role);

    public static string Alias(this CandidateSet candidates, Garment garment) =>
        candidates.AliasOf(garment.Id) ?? throw new InvalidOperationException($"{garment.Tags.Name} is not a candidate.");
}
