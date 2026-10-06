using System.Text;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>
/// Stands in for background removal until there is a provider key: the photo itself becomes the "cutout".
/// Everything downstream (storage, signed addresses, the wardrobe grid) works as it will with the real service.
/// </summary>
public sealed class FakeBackgroundRemover(IImageStorage storage) : IBackgroundRemover
{
    public const string Model = "fake-background-remover";

    public async Task<BackgroundRemoval> RemoveAsync(ImageSource photo, CancellationToken cancellationToken) =>
        new(await storage.ReadAsync(photo.Key, null, cancellationToken), "image/jpeg", "jpg", AiCost.None(Model));
}

/// <summary>
/// Stands in for the tagging model until there is a provider key. It cannot see the photo: it picks a garment from a
/// fixed, varied list by the photo's key, so the same photo always gets the same tags and a wardrobe of twenty photos
/// has tops, bottoms, shoes and coats for the stylist to work with. The tags can be corrected by hand in the app.
/// </summary>
public sealed class FakeGarmentTagger : IGarmentTagger
{
    public const string Model = "fake-garment-tagger";

    internal static readonly GarmentTags[] Wardrobe =
    [
        new(Category.Top, Subcategory.TShirt, "Biały T-shirt", [Color.White], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual]),
        new(Category.Top, Subcategory.TShirt, "Czarny T-shirt", [Color.Black], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Streetwear]),
        new(Category.Top, Subcategory.Shirt, "Granatowa koszula oxford", [Color.Navy], Pattern.Plain, Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant]),
        new(Category.Top, Subcategory.Shirt, "Błękitna koszula w paski", [Color.LightBlue, Color.White], Pattern.Stripes, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual]),
        new(Category.Top, Subcategory.Shirt, "Biała koszula", [Color.White], Pattern.Plain, Material.Cotton, 5, 2, false, [StyleTag.Elegant, StyleTag.Smart]),
        new(Category.Top, Subcategory.Turtleneck, "Czarny golf", [Color.Black], Pattern.Plain, Material.Knit, 3, 3, false, [StyleTag.Smart, StyleTag.Elegant]),
        new(Category.Top, Subcategory.Longsleeve, "Szary longsleeve", [Color.Grey], Pattern.Plain, Material.Cotton, 2, 2, false, [StyleTag.Casual]),
        new(Category.Top, Subcategory.Polo, "Granatowa koszulka polo", [Color.Navy], Pattern.Plain, Material.Cotton, 3, 1, false, [StyleTag.Smart, StyleTag.Sporty]),

        new(Category.MidLayer, Subcategory.Sweater, "Bordowy sweter z wełny", [Color.Burgundy], Pattern.Plain, Material.Wool, 3, 4, false, [StyleTag.Smart, StyleTag.Casual]),
        new(Category.MidLayer, Subcategory.Sweater, "Kremowy sweter", [Color.Cream], Pattern.Plain, Material.Knit, 3, 4, false, [StyleTag.Casual, StyleTag.Smart]),
        new(Category.MidLayer, Subcategory.Hoodie, "Szara bluza z kapturem", [Color.Grey], Pattern.Plain, Material.Cotton, 1, 3, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty]),
        new(Category.MidLayer, Subcategory.Blazer, "Granatowa marynarka", [Color.Navy], Pattern.Plain, Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Elegant]),
        new(Category.MidLayer, Subcategory.Cardigan, "Beżowy kardigan", [Color.Beige], Pattern.Plain, Material.Knit, 3, 3, false, [StyleTag.Casual, StyleTag.Smart]),

        new(Category.Bottom, Subcategory.Jeans, "Niebieskie jeansy", [Color.Blue], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Streetwear]),
        new(Category.Bottom, Subcategory.Jeans, "Czarne jeansy", [Color.Black], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Smart]),
        new(Category.Bottom, Subcategory.Chinos, "Beżowe chinosy", [Color.Beige], Pattern.Plain, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual]),
        new(Category.Bottom, Subcategory.Trousers, "Szare spodnie materiałowe", [Color.Grey], Pattern.Plain, Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Elegant]),
        new(Category.Bottom, Subcategory.Trousers, "Granatowe spodnie garniturowe", [Color.Navy], Pattern.Plain, Material.Wool, 5, 3, false, [StyleTag.Elegant]),
        new(Category.Bottom, Subcategory.Shorts, "Granatowe szorty", [Color.Navy], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Sporty]),
        new(Category.Bottom, Subcategory.Sweatpants, "Czarne spodnie dresowe", [Color.Black], Pattern.Plain, Material.Cotton, 1, 2, false, [StyleTag.Sporty, StyleTag.Casual]),
        new(Category.Bottom, Subcategory.Skirt, "Czarna spódnica", [Color.Black], Pattern.Plain, Material.Synthetic, 3, 2, false, [StyleTag.Smart, StyleTag.Elegant]),

        new(Category.OnePiece, Subcategory.Dress, "Granatowa sukienka", [Color.Navy], Pattern.Plain, Material.Synthetic, 4, 2, false, [StyleTag.Elegant, StyleTag.Smart]),
        new(Category.OnePiece, Subcategory.Dress, "Letnia sukienka w kwiaty", [Color.Red, Color.White], Pattern.Floral, Material.Linen, 2, 1, false, [StyleTag.Casual]),

        new(Category.Outerwear, Subcategory.Coat, "Beżowy płaszcz z wełny", [Color.Beige], Pattern.Plain, Material.Wool, 4, 4, false, [StyleTag.Elegant, StyleTag.Smart]),
        new(Category.Outerwear, Subcategory.DownJacket, "Czarna kurtka puchowa", [Color.Black], Pattern.Plain, Material.Down, 2, 5, true, [StyleTag.Casual, StyleTag.Sporty]),
        new(Category.Outerwear, Subcategory.Parka, "Oliwkowa parka", [Color.Olive], Pattern.Plain, Material.Synthetic, 2, 4, true, [StyleTag.Casual, StyleTag.Streetwear]),
        new(Category.Outerwear, Subcategory.Raincoat, "Granatowa kurtka przeciwdeszczowa", [Color.Navy], Pattern.Plain, Material.Synthetic, 2, 2, true, [StyleTag.Casual, StyleTag.Sporty]),
        new(Category.Outerwear, Subcategory.DenimJacket, "Kurtka jeansowa", [Color.Blue], Pattern.Plain, Material.Denim, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear]),
        new(Category.Outerwear, Subcategory.LeatherJacket, "Czarna kurtka skórzana", [Color.Black], Pattern.Plain, Material.Leather, 3, 3, true, [StyleTag.Streetwear, StyleTag.Casual]),
        new(Category.Outerwear, Subcategory.TrenchCoat, "Beżowy trencz", [Color.Beige], Pattern.Plain, Material.Cotton, 4, 3, true, [StyleTag.Elegant, StyleTag.Smart]),

        new(Category.Shoes, Subcategory.Sneakers, "Białe sneakersy", [Color.White], Pattern.Plain, Material.Leather, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear]),
        new(Category.Shoes, Subcategory.Boots, "Brązowe botki", [Color.Brown], Pattern.Plain, Material.Leather, 3, 4, true, [StyleTag.Smart, StyleTag.Casual]),
        new(Category.Shoes, Subcategory.DressShoes, "Czarne półbuty", [Color.Black], Pattern.Plain, Material.Leather, 5, 2, false, [StyleTag.Elegant]),
        new(Category.Shoes, Subcategory.WinterBoots, "Czarne buty zimowe", [Color.Black], Pattern.Plain, Material.Leather, 2, 5, true, [StyleTag.Casual]),
        new(Category.Shoes, Subcategory.Loafers, "Brązowe mokasyny", [Color.Brown], Pattern.Plain, Material.Suede, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant]),
        new(Category.Shoes, Subcategory.Sandals, "Beżowe sandały", [Color.Beige], Pattern.Plain, Material.Leather, 2, 1, false, [StyleTag.Casual]),
        new(Category.Shoes, Subcategory.SportsShoes, "Szare buty sportowe", [Color.Grey], Pattern.Plain, Material.Synthetic, 1, 2, false, [StyleTag.Sporty]),

        new(Category.Accessory, Subcategory.Scarf, "Szary szalik", [Color.Grey], Pattern.Plain, Material.Wool, 3, 4, false, [StyleTag.Casual, StyleTag.Smart]),
        new(Category.Accessory, Subcategory.Hat, "Czarna czapka", [Color.Black], Pattern.Plain, Material.Knit, 2, 4, false, [StyleTag.Casual]),
        new(Category.Accessory, Subcategory.Belt, "Brązowy pasek", [Color.Brown], Pattern.Plain, Material.Leather, 3, 2, false, [StyleTag.Smart, StyleTag.Casual]),
    ];

    public Task<TaggingOutcome> TagAsync(ImageSource cutout, CancellationToken cancellationToken)
    {
        var tags = Wardrobe[Fnv1A(cutout.Key) % (uint)Wardrobe.Length];
        return Task.FromResult(TaggingOutcome.Accepted(tags, tags.Describe(), AiCost.None(Model)));
    }

    /// <summary>A hash that is the same in every process (unlike <see cref="string.GetHashCode()"/>), so a retried job picks the same garment.</summary>
    private static uint Fnv1A(string text)
    {
        var hash = 2166136261u;
        foreach (var value in Encoding.UTF8.GetBytes(text))
        {
            hash = (hash ^ value) * 16777619u;
        }

        return hash;
    }
}
