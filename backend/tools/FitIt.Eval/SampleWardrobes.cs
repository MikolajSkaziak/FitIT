using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;

namespace FitIt.Eval;

/// <summary>
/// The three sample wardrobes of product spec 6.9. They are built from the garments the fake tagger knows, so they are
/// the same on every machine and every run, and each has the mix a real wardrobe has: some garments liked and worn
/// often, some forgotten, a few worn this week.
/// </summary>
public static class SampleWardrobes
{
    /// <summary>The sizes of the three wardrobes.</summary>
    public static readonly IReadOnlyList<int> Sizes = [12, 30, 60];

    /// <summary>How many garments of each category the small and the medium wardrobe have; the large one takes everything the catalogue has and then variants of it.</summary>
    private static readonly Dictionary<int, (Category Role, int Count)[]> Shares = new()
    {
        [12] = [(Category.Top, 3), (Category.MidLayer, 2), (Category.Bottom, 2), (Category.OnePiece, 1), (Category.Outerwear, 2), (Category.Shoes, 2)],
        [30] = [(Category.Top, 6), (Category.MidLayer, 4), (Category.Bottom, 6), (Category.OnePiece, 2), (Category.Outerwear, 5), (Category.Shoes, 5), (Category.Accessory, 2)],
    };

    private static readonly Color[] Recolours = [Color.Black, Color.Navy, Color.Grey, Color.Beige, Color.White, Color.Olive, Color.Brown];

    public static IReadOnlyList<Garment> Build(int size)
    {
        var catalogue = FakeGarmentTagger.Wardrobe;
        var tags = new List<GarmentTags>();
        if (Shares.TryGetValue(size, out var shares))
        {
            foreach (var (role, count) in shares)
            {
                tags.AddRange(catalogue.Where(entry => entry.Category == role).Take(count));
            }
        }
        else
        {
            // Everything the catalogue has, then the same garments again in another colour, until the wardrobe is as big as asked.
            tags.AddRange(catalogue);
            for (var round = 0; tags.Count < size; round++)
            {
                var original = catalogue[round % catalogue.Length];
                var colour = Recolours[round % Recolours.Length];
                tags.Add(original with { Name = $"{original.Name} ({GarmentCatalog.Label(colour).ToLowerInvariant()})", Colors = [colour] });
            }

            tags = tags.Take(size).ToList();
        }

        return [.. tags.Select((entry, index) => Wear(entry, index))];
    }

    /// <summary>Every third garment is forgotten, the rest have been worn between one and six times, every fourth of those was liked, and a few were worn in the last two days.</summary>
    private static Garment Wear(GarmentTags tags, int index)
    {
        var forgotten = index % 3 == 0;
        return new Garment(
            // The same ids on every run: nothing in the evaluation may depend on chance.
            new Guid(index + 1, 0, 0, [0, 0, 0, 0, 0, 0, 0, 1]),
            tags,
            tags.Describe(),
            WearCount: forgotten ? 0 : 1 + (index % 6),
            Forgotten: forgotten,
            RecentlyWorn: !forgotten && index % 5 == 0,
            Likes: !forgotten && index % 4 == 0 ? 1 : 0);
    }
}
