using FitIt.Core.Wardrobe;

namespace FitIt.Core.Weather;

/// <summary>
/// The thresholds of product spec 6.2. Starting values kept in configuration (section "Weather"): they are to be
/// calibrated on testers, and changing one must not need a release.
/// </summary>
public sealed class WeatherRules
{
    public const string Section = "Weather";

    /// <summary>Reference temperature from which a day counts as hot.</summary>
    public double HotFrom { get; set; } = 25;

    public double WarmFrom { get; set; } = 18;

    public double MildFrom { get; set; } = 11;

    /// <summary>Below this it is freezing.</summary>
    public double ColdFrom { get; set; } = 3;

    /// <summary>Degrees the reference temperature moves for a person who usually feels cold (down) or warm (up).</summary>
    public double ThermalShift { get; set; } = 3;

    /// <summary>Highest chance of rain in the window, in percent, from which the day counts as rainy.</summary>
    public int RainProbability { get; set; } = 50;

    /// <summary>Total rain in the window, in millimetres, from which the day counts as rainy.</summary>
    public double RainMm { get; set; } = 1;

    /// <summary>Difference between the warmest and the coldest hour from which the outfit should come in layers.</summary>
    public double LayersAmplitude { get; set; } = 8;

    /// <summary>The hour an outfit is worn until. Asked later than this, the rest of the evening counts.</summary>
    public int DayEndHour { get; set; } = 22;

    public bool AreConsistent() =>
        HotFrom > WarmFrom && WarmFrom > MildFrom && MildFrom > ColdFrom
        && ThermalShift >= 0 && LayersAmplitude > 0
        && DayEndHour is > 0 and < 24;

    public TemperatureBand BandOf(double reference) =>
        reference >= HotFrom ? TemperatureBand.Hot
        : reference >= WarmFrom ? TemperatureBand.Warm
        : reference >= MildFrom ? TemperatureBand.Mild
        : reference >= ColdFrom ? TemperatureBand.Cold
        : TemperatureBand.Freezing;
}

/// <summary>The five rows of the weather table, warmest first.</summary>
public enum TemperatureBand
{
    Hot,
    Warm,
    Mild,
    Cold,
    Freezing,
}

/// <summary>
/// What one row of the weather table asks of an outfit and forbids in it. The warmth sum counts top, mid layer and outerwear.
/// </summary>
public sealed record BandRule(
    int WarmthSumMin,
    int WarmthSumMax,
    int MaxWarmth,
    bool Outerwear,
    bool NeedsLayer,
    int? OuterwearMinWarmth,
    bool NeedsMidLayer,
    bool ClosedShoes,
    bool Shorts,
    int MinShoeWarmth)
{
    private static readonly Dictionary<TemperatureBand, BandRule> Rules = new()
    {
        [TemperatureBand.Hot] = new(1, 2, MaxWarmth: 3, Outerwear: false, NeedsLayer: false, null, NeedsMidLayer: false, ClosedShoes: false, Shorts: true, MinShoeWarmth: 1),
        [TemperatureBand.Warm] = new(1, 3, MaxWarmth: 4, Outerwear: true, NeedsLayer: false, null, NeedsMidLayer: false, ClosedShoes: false, Shorts: true, MinShoeWarmth: 1),
        [TemperatureBand.Mild] = new(4, 6, MaxWarmth: 4, Outerwear: true, NeedsLayer: true, null, NeedsMidLayer: false, ClosedShoes: true, Shorts: true, MinShoeWarmth: 1),
        [TemperatureBand.Cold] = new(6, 9, MaxWarmth: 5, Outerwear: true, NeedsLayer: false, 3, NeedsMidLayer: false, ClosedShoes: true, Shorts: false, MinShoeWarmth: 1),
        [TemperatureBand.Freezing] = new(9, 13, MaxWarmth: 5, Outerwear: true, NeedsLayer: false, 4, NeedsMidLayer: true, ClosedShoes: true, Shorts: false, MinShoeWarmth: 2),
    };

    public static BandRule For(TemperatureBand band) => Rules[band];

    /// <summary>True when outerwear is not optional in this band.</summary>
    public bool NeedsOuterwear => OuterwearMinWarmth is not null;

    /// <summary>
    /// True when the garment has no place in any outfit for this band. <paramref name="warmthTolerance"/> is the last
    /// relaxation of the candidate filter (spec 6.4): the warmth limits give way by that much, the garment types do not.
    /// </summary>
    public bool Excludes(GarmentTags garment, int warmthTolerance = 0)
    {
        if (garment.Category == Category.Accessory)
        {
            return false;
        }

        if (garment.Warmth > MaxWarmth + warmthTolerance)
        {
            return true;
        }

        return garment.Category switch
        {
            Category.Outerwear => !Outerwear,
            Category.Bottom => !Shorts && garment.Subcategory == Subcategory.Shorts,
            Category.Shoes => (ClosedShoes && IsOpen(garment.Subcategory)) || garment.Warmth < MinShoeWarmth - warmthTolerance,
            _ => false,
        };
    }

    public static bool IsOpen(Subcategory shoes) => shoes is Subcategory.Sandals or Subcategory.FlipFlops;
}
