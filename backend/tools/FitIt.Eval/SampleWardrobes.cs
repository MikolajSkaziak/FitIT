using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;

namespace FitIt.Eval;

/// <summary>
/// The three sample wardrobes of product spec 6.9. They are built from the garments the fake tagger knows and from a
/// fixed list of pieces in more particular styles, so they are the same on every machine and every run, and each has the
/// mix a real wardrobe has: some garments liked and worn often, some forgotten, a few worn this week.
/// </summary>
public static class SampleWardrobes
{
    /// <summary>The sizes of the three wardrobes.</summary>
    public static readonly IReadOnlyList<int> Sizes = [12, 30, 60];

    /// <summary>
    /// How many garments of each category a wardrobe has: first from the everyday basics the fake tagger knows, then from
    /// <see cref="Styled"/>. The small wardrobe is basics only; the large one is half basics, half pieces with a style of their own.
    /// </summary>
    private static readonly Dictionary<int, (Category Role, int Basics, int Styled)[]> Shares = new()
    {
        [12] = [(Category.Top, 3, 0), (Category.MidLayer, 2, 0), (Category.Bottom, 2, 0), (Category.OnePiece, 1, 0), (Category.Outerwear, 2, 0), (Category.Shoes, 2, 0)],
        [30] = [(Category.Top, 4, 2), (Category.MidLayer, 3, 1), (Category.Bottom, 4, 2), (Category.OnePiece, 1, 1), (Category.Outerwear, 3, 2), (Category.Shoes, 3, 2), (Category.Accessory, 1, 1)],
        [60] = [(Category.Top, 6, 6), (Category.MidLayer, 4, 5), (Category.Bottom, 6, 6), (Category.OnePiece, 2, 1), (Category.Outerwear, 5, 5), (Category.Shoes, 5, 6), (Category.Accessory, 2, 1)],
    };

    /// <summary>
    /// Garments in the styles the basics lack or barely have (gorpcore, boho, old money, streetwear, Y2K, grunge, sporty).
    /// Within a category they are ordered so that a wardrobe that takes only the first few still gets several styles.
    /// </summary>
    internal static readonly GarmentTags[] Styled =
    [
        Piece(Subcategory.Longsleeve, "Olive technical long-sleeve top", [Color.Olive], Pattern.Plain, Material.Synthetic, 1, 2, false, StyleTag.Gorpcore, StyleTag.Sporty),
        Piece(Subcategory.Blouse, "Cream embroidered blouse", [Color.Cream], Pattern.Other, Material.Cotton, 3, 1, false, StyleTag.Boho, StyleTag.Romantic),
        Piece(Subcategory.Shirt, "White linen shirt", [Color.White], Pattern.Plain, Material.Linen, 3, 1, false, StyleTag.OldMoney, StyleTag.Minimalist, StyleTag.Smart),
        Piece(Subcategory.TShirt, "White graphic T-shirt", [Color.White, Color.Black], Pattern.Print, Material.Cotton, 2, 1, false, StyleTag.Streetwear, StyleTag.Casual),
        Piece(Subcategory.TShirt, "Pink baby tee", [Color.Pink], Pattern.Print, Material.Cotton, 2, 1, false, StyleTag.Y2k),
        Piece(Subcategory.TShirt, "Black band T-shirt", [Color.Black], Pattern.Print, Material.Cotton, 2, 1, false, StyleTag.Grunge, StyleTag.Vintage),
        Piece(Subcategory.TShirt, "Gray training T-shirt", [Color.Grey], Pattern.Plain, Material.Synthetic, 1, 1, false, StyleTag.Sporty),
        Piece(Subcategory.Shirt, "Red plaid flannel shirt", [Color.Red, Color.Black], Pattern.Check, Material.Cotton, 2, 3, false, StyleTag.Grunge, StyleTag.Casual),

        Piece(Subcategory.Sweatshirt, "Green fleece pullover", [Color.Green], Pattern.Plain, Material.Synthetic, 1, 4, false, StyleTag.Gorpcore, StyleTag.Casual),
        Piece(Subcategory.Cardigan, "Brown crochet cardigan", [Color.Brown], Pattern.Other, Material.Knit, 2, 3, false, StyleTag.Boho, StyleTag.Vintage),
        Piece(Subcategory.Sweater, "Cream cable-knit sweater", [Color.Cream], Pattern.Plain, Material.Wool, 3, 4, false, StyleTag.OldMoney, StyleTag.Preppy),
        Piece(Subcategory.Hoodie, "Black zip hoodie", [Color.Black], Pattern.Plain, Material.Cotton, 1, 3, false, StyleTag.Streetwear, StyleTag.Sporty),
        Piece(Subcategory.TrackJacket, "Pink velour track jacket", [Color.Pink], Pattern.Plain, Material.Synthetic, 1, 2, false, StyleTag.Y2k, StyleTag.Sporty),

        Piece(Subcategory.Trousers, "Gray hiking pants", [Color.Grey], Pattern.Plain, Material.Synthetic, 1, 3, true, StyleTag.Gorpcore, StyleTag.Sporty),
        Piece(Subcategory.Skirt, "Rust tiered maxi skirt", [Color.Orange], Pattern.Floral, Material.Cotton, 2, 2, false, StyleTag.Boho, StyleTag.Romantic),
        Piece(Subcategory.Trousers, "Cream pleated trousers", [Color.Cream], Pattern.Plain, Material.Wool, 4, 3, false, StyleTag.OldMoney, StyleTag.Elegant),
        Piece(Subcategory.Trousers, "Olive cargo pants", [Color.Olive], Pattern.Plain, Material.Cotton, 2, 3, false, StyleTag.Streetwear, StyleTag.Gorpcore),
        Piece(Subcategory.Leggings, "Black training leggings", [Color.Black], Pattern.Plain, Material.Synthetic, 1, 2, false, StyleTag.Sporty),
        Piece(Subcategory.Jeans, "Light blue flared jeans", [Color.LightBlue], Pattern.Plain, Material.Denim, 2, 2, false, StyleTag.Y2k, StyleTag.Vintage),
        Piece(Subcategory.Jeans, "Black ripped jeans", [Color.Black], Pattern.Plain, Material.Denim, 2, 3, false, StyleTag.Grunge, StyleTag.Edgy),

        Piece(Subcategory.Dress, "Cream floral maxi dress", [Color.Cream, Color.Pink], Pattern.Floral, Material.Cotton, 2, 1, false, StyleTag.Boho, StyleTag.Romantic),
        Piece(Subcategory.Tracksuit, "Gray tracksuit", [Color.Grey], Pattern.Plain, Material.Cotton, 1, 3, false, StyleTag.Sporty, StyleTag.Streetwear),

        Piece(Subcategory.Jacket, "Green shell jacket", [Color.Green], Pattern.Plain, Material.Synthetic, 1, 3, true, StyleTag.Gorpcore, StyleTag.Sporty),
        Piece(Subcategory.Jacket, "Brown suede fringe jacket", [Color.Brown], Pattern.Plain, Material.Suede, 2, 3, false, StyleTag.Boho, StyleTag.Vintage),
        Piece(Subcategory.Parka, "Orange insulated parka", [Color.Orange], Pattern.Plain, Material.Synthetic, 1, 5, true, StyleTag.Gorpcore, StyleTag.Sporty),
        Piece(Subcategory.Jacket, "Navy quilted jacket", [Color.Navy], Pattern.Plain, Material.Synthetic, 3, 3, false, StyleTag.OldMoney, StyleTag.Preppy),
        Piece(Subcategory.BomberJacket, "Black bomber jacket", [Color.Black], Pattern.Plain, Material.Synthetic, 2, 3, false, StyleTag.Streetwear, StyleTag.Casual),
        Piece(Subcategory.Coat, "Brown shearling coat", [Color.Brown], Pattern.Plain, Material.Suede, 3, 5, false, StyleTag.Boho, StyleTag.Vintage),
        Piece(Subcategory.DownJacket, "Black puffer jacket", [Color.Black], Pattern.Plain, Material.Down, 2, 5, true, StyleTag.Streetwear, StyleTag.Casual),

        Piece(Subcategory.Boots, "Brown hiking boots", [Color.Brown], Pattern.Plain, Material.Leather, 1, 4, true, StyleTag.Gorpcore),
        Piece(Subcategory.Boots, "Tan suede ankle boots", [Color.Beige], Pattern.Plain, Material.Suede, 3, 3, false, StyleTag.Boho, StyleTag.Vintage),
        Piece(Subcategory.Loafers, "Brown leather loafers", [Color.Brown], Pattern.Plain, Material.Leather, 4, 2, false, StyleTag.OldMoney, StyleTag.Preppy, StyleTag.Smart),
        Piece(Subcategory.Sneakers, "Black high-top sneakers", [Color.Black, Color.White], Pattern.Plain, Material.Cotton, 2, 2, false, StyleTag.Streetwear, StyleTag.Casual),
        Piece(Subcategory.SportsShoes, "Gray trail running shoes", [Color.Grey, Color.Orange], Pattern.Plain, Material.Synthetic, 1, 2, false, StyleTag.Gorpcore, StyleTag.Sporty),
        Piece(Subcategory.Sneakers, "White platform sneakers", [Color.White, Color.Pink], Pattern.Plain, Material.Leather, 2, 2, false, StyleTag.Y2k, StyleTag.Streetwear),
        Piece(Subcategory.Boots, "Black combat boots", [Color.Black], Pattern.Plain, Material.Leather, 2, 4, true, StyleTag.Grunge, StyleTag.Edgy),

        Piece(Subcategory.Bag, "Woven straw bag", [Color.Beige], Pattern.Plain, Material.Other, 2, 1, false, StyleTag.Boho),
        Piece(Subcategory.Cap, "Black bucket hat", [Color.Black], Pattern.Plain, Material.Cotton, 2, 1, false, StyleTag.Streetwear, StyleTag.Y2k),
        Piece(Subcategory.Scarf, "Navy silk scarf", [Color.Navy, Color.Cream], Pattern.Print, Material.Silk, 4, 1, false, StyleTag.OldMoney, StyleTag.Elegant),
    ];

    private static readonly Color[] Recolours = [Color.Black, Color.Navy, Color.Grey, Color.Beige, Color.White, Color.Olive, Color.Brown];

    public static IReadOnlyList<Garment> Build(int size)
    {
        var basics = FakeGarmentTagger.Wardrobe;
        var tags = new List<GarmentTags>();
        if (Shares.TryGetValue(size, out var shares))
        {
            foreach (var (role, fromBasics, fromStyled) in shares)
            {
                tags.AddRange(basics.Where(entry => entry.Category == role).Take(fromBasics));
                tags.AddRange(Styled.Where(entry => entry.Category == role).Take(fromStyled));
            }
        }
        else
        {
            // Everything there is, then the same garments again in another colour, until the wardrobe is as big as asked.
            GarmentTags[] catalogue = [.. basics, .. Styled];
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

    private static GarmentTags Piece(Subcategory type, string name, Color[] colors, Pattern pattern, Material material, int formality, int warmth, bool rainOk, params StyleTag[] styles) =>
        new(GarmentCatalog.CategoryOf(type), type, name, colors, pattern, material, formality, warmth, rainOk, styles);

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
