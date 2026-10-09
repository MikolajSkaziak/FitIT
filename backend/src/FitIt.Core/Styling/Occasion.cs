using System.Collections.Frozen;
using FitIt.Core.Wardrobe;

namespace FitIt.Core.Styling;

/// <summary>What the outfit is for (product spec 6.3). The order is the order of the tiles in the app.</summary>
public enum Occasion
{
    Everyday,
    Work,
    Business,
    Date,
    Friends,
    Workout,
}

/// <summary>
/// The hard range an occasion sets: formality from-to, and at most one rule about style. A preferred style is only a
/// hint for the stylist; it shuts nothing out.
/// </summary>
public sealed record OccasionRule(string Label, int FormalityMin, int FormalityMax, StyleTag? Without = null, StyleTag? Only = null, StyleTag? Prefers = null)
{
    private static readonly FrozenDictionary<Occasion, OccasionRule> Rules = new Dictionary<Occasion, OccasionRule>
    {
        [Occasion.Everyday] = new("Everyday", 1, 3),
        [Occasion.Work] = new("Work or school", 2, 4, Without: StyleTag.Sporty),
        [Occasion.Business] = new("Business meeting", 4, 5),
        [Occasion.Date] = new("Date or evening out", 2, 4, Prefers: StyleTag.Elegant),
        [Occasion.Friends] = new("Out with friends", 1, 3),
        [Occasion.Workout] = new("Workout", 1, 1, Only: StyleTag.Sporty),
    }.ToFrozenDictionary();

    public static OccasionRule For(Occasion occasion) => Rules[occasion];

    /// <summary><paramref name="widenedBy"/> is the first relaxation of the candidate filter: the range grows by that much at both ends.</summary>
    public bool AllowsFormality(int formality, int widenedBy = 0) => formality >= FormalityMin - widenedBy && formality <= FormalityMax + widenedBy;

    /// <summary>A garment carries several styles: one forbidden style among them is enough to shut it out, one required style is enough to let it in.</summary>
    public bool AllowsStyle(IReadOnlyList<StyleTag> styles) =>
        (Without is not { } without || !styles.Contains(without)) && (Only is not { } only || styles.Contains(only));
}
