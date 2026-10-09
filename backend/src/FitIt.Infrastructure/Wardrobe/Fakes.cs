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
        new(Category.Top, Subcategory.TShirt, "White T-shirt", [Color.White], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Minimalist], [Season.Spring, Season.Summer]),
        new(Category.Top, Subcategory.TShirt, "Black T-shirt", [Color.Black], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer]),
        new(Category.Top, Subcategory.Shirt, "Navy oxford shirt", [Color.Navy], Pattern.Plain, Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Top, Subcategory.Shirt, "Light blue striped shirt", [Color.LightBlue, Color.White], Pattern.Stripes, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Top, Subcategory.Shirt, "White shirt", [Color.White], Pattern.Plain, Material.Cotton, 5, 2, false, [StyleTag.Elegant, StyleTag.Smart], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Top, Subcategory.Turtleneck, "Black turtleneck", [Color.Black], Pattern.Plain, Material.Knit, 3, 3, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Minimalist], [Season.Spring, Season.Fall, Season.Winter]),
        new(Category.Top, Subcategory.Longsleeve, "Gray long-sleeve top", [Color.Grey], Pattern.Plain, Material.Cotton, 2, 2, false, [StyleTag.Casual], [Season.Spring, Season.Fall]),
        new(Category.Top, Subcategory.Polo, "Navy polo shirt", [Color.Navy], Pattern.Plain, Material.Cotton, 3, 1, false, [StyleTag.Smart, StyleTag.Sporty, StyleTag.Preppy], [Season.Spring, Season.Summer]),

        new(Category.MidLayer, Subcategory.Sweater, "Burgundy wool sweater", [Color.Burgundy], Pattern.Plain, Material.Wool, 3, 4, false, [StyleTag.Smart, StyleTag.Casual], [Season.Fall, Season.Winter]),
        new(Category.MidLayer, Subcategory.Sweater, "Cream sweater", [Color.Cream], Pattern.Plain, Material.Knit, 3, 4, false, [StyleTag.Casual, StyleTag.Smart], [Season.Fall, Season.Winter]),
        new(Category.MidLayer, Subcategory.Hoodie, "Gray hoodie", [Color.Grey], Pattern.Plain, Material.Cotton, 1, 3, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty], [Season.Spring, Season.Fall]),
        new(Category.MidLayer, Subcategory.Blazer, "Navy blazer", [Color.Navy], Pattern.Plain, Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Business, StyleTag.Preppy], [Season.Spring, Season.Fall]),
        new(Category.MidLayer, Subcategory.Cardigan, "Beige cardigan", [Color.Beige], Pattern.Plain, Material.Knit, 3, 3, false, [StyleTag.Casual, StyleTag.Smart], [Season.Spring, Season.Fall]),

        new(Category.Bottom, Subcategory.Jeans, "Blue jeans", [Color.Blue], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Fall, Season.Winter]),
        new(Category.Bottom, Subcategory.Jeans, "Black jeans", [Color.Black], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Smart, StyleTag.Grunge], [Season.Spring, Season.Fall, Season.Winter]),
        new(Category.Bottom, Subcategory.Chinos, "Beige chinos", [Color.Beige], Pattern.Plain, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer]),
        new(Category.Bottom, Subcategory.Trousers, "Gray dress pants", [Color.Grey], Pattern.Plain, Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Fall, Season.Winter]),
        new(Category.Bottom, Subcategory.Trousers, "Navy suit pants", [Color.Navy], Pattern.Plain, Material.Wool, 5, 3, false, [StyleTag.Elegant, StyleTag.Business], [Season.Spring, Season.Fall, Season.Winter]),
        new(Category.Bottom, Subcategory.Shorts, "Navy shorts", [Color.Navy], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Sporty], [Season.Summer]),
        new(Category.Bottom, Subcategory.Sweatpants, "Black sweatpants", [Color.Black], Pattern.Plain, Material.Cotton, 1, 2, false, [StyleTag.Sporty, StyleTag.Casual], [Season.Spring, Season.Fall]),
        new(Category.Bottom, Subcategory.Skirt, "Black skirt", [Color.Black], Pattern.Plain, Material.Synthetic, 3, 2, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Summer, Season.Fall]),

        new(Category.OnePiece, Subcategory.Dress, "Navy dress", [Color.Navy], Pattern.Plain, Material.Synthetic, 4, 2, false, [StyleTag.Elegant, StyleTag.Smart], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.OnePiece, Subcategory.Dress, "Red floral summer dress", [Color.Red, Color.White], Pattern.Floral, Material.Linen, 2, 1, false, [StyleTag.Casual, StyleTag.Boho, StyleTag.Romantic], [Season.Spring, Season.Summer]),

        new(Category.Outerwear, Subcategory.Coat, "Beige wool coat", [Color.Beige], Pattern.Plain, Material.Wool, 4, 4, false, [StyleTag.Elegant, StyleTag.Smart, StyleTag.OldMoney], [Season.Fall, Season.Winter]),
        new(Category.Outerwear, Subcategory.DownJacket, "Black down jacket", [Color.Black], Pattern.Plain, Material.Down, 2, 5, true, [StyleTag.Casual, StyleTag.Sporty], [Season.Winter]),
        new(Category.Outerwear, Subcategory.Parka, "Olive parka", [Color.Olive], Pattern.Plain, Material.Synthetic, 2, 4, true, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Gorpcore], [Season.Fall, Season.Winter]),
        new(Category.Outerwear, Subcategory.Raincoat, "Navy raincoat", [Color.Navy], Pattern.Plain, Material.Synthetic, 2, 2, true, [StyleTag.Casual, StyleTag.Sporty], [Season.Spring, Season.Fall]),
        new(Category.Outerwear, Subcategory.DenimJacket, "Denim jacket", [Color.Blue], Pattern.Plain, Material.Denim, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Vintage], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Outerwear, Subcategory.LeatherJacket, "Black leather jacket", [Color.Black], Pattern.Plain, Material.Leather, 3, 3, true, [StyleTag.Streetwear, StyleTag.Casual, StyleTag.Edgy], [Season.Spring, Season.Fall]),
        new(Category.Outerwear, Subcategory.TrenchCoat, "Beige trench coat", [Color.Beige], Pattern.Plain, Material.Cotton, 4, 3, true, [StyleTag.Elegant, StyleTag.Smart, StyleTag.OldMoney], [Season.Spring, Season.Fall]),

        new(Category.Shoes, Subcategory.Sneakers, "White sneakers", [Color.White], Pattern.Plain, Material.Leather, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Shoes, Subcategory.Boots, "Brown ankle boots", [Color.Brown], Pattern.Plain, Material.Leather, 3, 4, true, [StyleTag.Smart, StyleTag.Casual], [Season.Fall, Season.Winter]),
        new(Category.Shoes, Subcategory.DressShoes, "Black dress shoes", [Color.Black], Pattern.Plain, Material.Leather, 5, 2, false, [StyleTag.Elegant, StyleTag.Business], [Season.Spring, Season.Summer, Season.Fall, Season.Winter]),
        new(Category.Shoes, Subcategory.WinterBoots, "Black winter boots", [Color.Black], Pattern.Plain, Material.Leather, 2, 5, true, [StyleTag.Casual], [Season.Winter]),
        new(Category.Shoes, Subcategory.Loafers, "Brown suede loafers", [Color.Brown], Pattern.Plain, Material.Suede, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.OldMoney, StyleTag.Preppy], [Season.Spring, Season.Summer, Season.Fall]),
        new(Category.Shoes, Subcategory.Sandals, "Beige leather sandals", [Color.Beige], Pattern.Plain, Material.Leather, 2, 1, false, [StyleTag.Casual], [Season.Summer]),
        new(Category.Shoes, Subcategory.SportsShoes, "Gray athletic shoes", [Color.Grey], Pattern.Plain, Material.Synthetic, 1, 2, false, [StyleTag.Sporty], [Season.Spring, Season.Summer, Season.Fall]),

        new(Category.Accessory, Subcategory.Scarf, "Gray wool scarf", [Color.Grey], Pattern.Plain, Material.Wool, 3, 4, false, [StyleTag.Casual, StyleTag.Smart], [Season.Fall, Season.Winter]),
        new(Category.Accessory, Subcategory.Hat, "Black beanie", [Color.Black], Pattern.Plain, Material.Knit, 2, 4, false, [StyleTag.Casual], [Season.Fall, Season.Winter]),
        new(Category.Accessory, Subcategory.Belt, "Brown leather belt", [Color.Brown], Pattern.Plain, Material.Leather, 3, 2, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall, Season.Winter]),
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
