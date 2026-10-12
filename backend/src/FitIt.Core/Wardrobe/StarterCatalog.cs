namespace FitIt.Core.Wardrobe;

/// <summary>Who a starter piece is cut for. The phone shows a woman <c>Women</c> and <c>Everyone</c>, a man <c>Men</c> and <c>Everyone</c>, and anybody else all of them.</summary>
public enum StarterAudience
{
    Women,
    Men,
    Everyone,
}

/// <summary>One of the common pieces a new person can tick instead of photographing: a fixed code, full tags and a picture under <c>wwwroot/starter/&lt;code&gt;.png</c>.</summary>
public sealed record StarterPiece(string Code, StarterAudience Audience, GarmentTags Tags)
{
    /// <summary>Path of the transparent, tightly trimmed picture under the API's static files. Depends on the code and nothing else.</summary>
    public string ImagePath => $"/starter/{Code}.png";
}

/// <summary>
/// The pieces most people own, chosen so that together they make a valid outfit in every temperature band, for any audience:
/// the fourteen original pieces (all <see cref="StarterAudience.Everyone"/>) alone cover tops, mid-layers, bottoms, shoes and outer layers,
/// and the rest widen the choice: dresses, skirts, blouses, flats, a trench and a bag for women, a blazer for men, more colour for everyone. Names never say "women's": the audience is its own field.
/// The codes are stable: a garment remembers the code it came from.
/// </summary>
public static class StarterCatalog
{
    public static IReadOnlyList<StarterPiece> All { get; } =
    [
        // Tops
        Piece("white_tshirt", Everyone, Category.Top, Subcategory.TShirt, "White T-shirt", [Color.White], Material.Cotton, 2, 1, false, [StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_tshirt", Everyone, Category.Top, Subcategory.TShirt, "Black T-shirt", [Color.Black], Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("white_shirt", Everyone, Category.Top, Subcategory.Shirt, "White button-up shirt", [Color.White], Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("white_blouse", Women, Category.Top, Subcategory.Blouse, "White blouse", [Color.White], Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Minimalist], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("cream_camisole", Women, Category.Top, Subcategory.TankTop, "Cream silk-look camisole", [Color.Cream], Material.Silk, 3, 1, false, [StyleTag.Elegant, StyleTag.Minimalist], [Season.Spring, Season.Summer]),

        // Mid-layers
        Piece("gray_sweater", Everyone, Category.MidLayer, Subcategory.Sweater, "Gray crewneck sweater", [Color.Grey], Material.Knit, 3, 3, false, [StyleTag.Casual, StyleTag.Smart], [Season.Fall, Season.Winter]),
        Piece("navy_hoodie", Everyone, Category.MidLayer, Subcategory.Hoodie, "Navy hoodie", [Color.Navy], Material.Cotton, 1, 3, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("green_sweater", Everyone, Category.MidLayer, Subcategory.Sweater, "Forest green sweater", [Color.Green], Material.Knit, 3, 4, false, [StyleTag.Casual, StyleTag.Preppy], [Season.Fall, Season.Winter]),
        Piece("burgundy_cardigan", Women, Category.MidLayer, Subcategory.Cardigan, "Burgundy cardigan", [Color.Burgundy], Material.Knit, 3, 3, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("navy_blazer", Men, Category.MidLayer, Subcategory.Blazer, "Navy blazer", [Color.Navy], Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Business, StyleTag.Elegant], [Season.Spring, Season.Fall, Season.Winter]),

        // Bottoms
        Piece("blue_jeans", Everyone, Category.Bottom, Subcategory.Jeans, "Blue jeans", [Color.Blue], Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("black_jeans", Everyone, Category.Bottom, Subcategory.Jeans, "Black jeans", [Color.Black], Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Smart, StyleTag.Streetwear], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("beige_chinos", Everyone, Category.Bottom, Subcategory.Chinos, "Beige chinos", [Color.Beige], Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("navy_chinos", Everyone, Category.Bottom, Subcategory.Chinos, "Navy chinos", [Color.Navy], Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual, StyleTag.Preppy], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("olive_cargo_pants", Everyone, Category.Bottom, Subcategory.Trousers, "Olive cargo pants", [Color.Olive], Material.Cotton, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_shorts", Everyone, Category.Bottom, Subcategory.Shorts, "Black shorts", [Color.Black], Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Sporty], [Season.Summer]),
        Piece("black_midi_skirt", Women, Category.Bottom, Subcategory.Skirt, "Black midi skirt", [Color.Black], Material.Synthetic, 3, 2, false, [StyleTag.Elegant, StyleTag.Smart, StyleTag.Minimalist], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("denim_skirt", Women, Category.Bottom, Subcategory.Skirt, "Denim skirt", [Color.Blue], Material.Denim, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("wide_leg_trousers", Women, Category.Bottom, Subcategory.Trousers, "High-waisted wide-leg trousers", [Color.Grey], Material.Wool, 4, 3, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Business], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("black_leggings", Women, Category.Bottom, Subcategory.Leggings, "Black leggings", [Color.Black], Material.Synthetic, 1, 2, false, [StyleTag.Casual, StyleTag.Sporty], [Season.Spring, Season.Fall, Season.Winter]),

        // Dresses
        Piece("little_black_dress", Women, Category.OnePiece, Subcategory.Dress, "Little black dress", [Color.Black], Material.Synthetic, 4, 2, false, [StyleTag.Elegant, StyleTag.Smart], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("olive_midi_dress", Women, Category.OnePiece, Subcategory.Dress, "Olive midi dress", [Color.Olive], Material.Cotton, 3, 2, false, [StyleTag.Casual, StyleTag.Minimalist], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("floral_summer_dress", Women, Category.OnePiece, Subcategory.Dress, "Floral summer dress", [Color.Cream, Color.Pink], Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Romantic, StyleTag.Boho], [Season.Spring, Season.Summer], Pattern.Floral),

        // Shoes
        Piece("white_sneakers", Everyone, Category.Shoes, Subcategory.Sneakers, "White sneakers", [Color.White], Material.Leather, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_boots", Everyone, Category.Shoes, Subcategory.Boots, "Black boots", [Color.Black], Material.Leather, 3, 4, true, [StyleTag.Casual, StyleTag.Smart, StyleTag.Streetwear], [Season.Fall, Season.Winter]),
        Piece("brown_loafers", Everyone, Category.Shoes, Subcategory.Loafers, "Brown leather loafers", [Color.Brown], Material.Leather, 4, 2, false, [StyleTag.Smart, StyleTag.Preppy, StyleTag.Elegant], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_ankle_boots", Women, Category.Shoes, Subcategory.Boots, "Black heeled ankle boots", [Color.Black], Material.Leather, 3, 4, true, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Casual], [Season.Fall, Season.Winter]),
        Piece("nude_ballet_flats", Women, Category.Shoes, Subcategory.Flats, "Nude ballet flats", [Color.Beige], Material.Leather, 3, 1, false, [StyleTag.Smart, StyleTag.Elegant, StyleTag.Minimalist], [Season.Spring, Season.Summer, Season.Fall]),

        // Outer layers
        Piece("navy_jacket", Everyone, Category.Outerwear, Subcategory.Jacket, "Navy jacket", [Color.Navy], Material.Synthetic, 2, 2, true, [StyleTag.Casual, StyleTag.Smart], [Season.Spring, Season.Fall]),
        Piece("black_winter_coat", Everyone, Category.Outerwear, Subcategory.Coat, "Black winter coat", [Color.Black], Material.Wool, 3, 5, true, [StyleTag.Casual, StyleTag.Smart, StyleTag.Elegant], [Season.Winter]),
        Piece("denim_jacket", Everyone, Category.Outerwear, Subcategory.DenimJacket, "Denim jacket", [Color.Blue], Material.Denim, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Vintage], [Season.Spring, Season.Fall]),
        Piece("beige_trench", Women, Category.Outerwear, Subcategory.TrenchCoat, "Beige trench coat", [Color.Beige], Material.Cotton, 3, 2, true, [StyleTag.Smart, StyleTag.Elegant, StyleTag.OldMoney], [Season.Spring, Season.Fall]),

        // Accessories
        Piece("brown_leather_belt", Everyone, Category.Accessory, Subcategory.Belt, "Brown leather belt", [Color.Brown], Material.Leather, 3, 1, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall, Season.Winter]),
        Piece("brown_tote_bag", Women, Category.Accessory, Subcategory.Bag, "Brown leather tote bag", [Color.Brown], Material.Leather, 3, 1, false, [StyleTag.Smart, StyleTag.Casual, StyleTag.Minimalist], [Season.Spring, Season.Summer, Season.Fall, Season.Winter]),
    ];

    public static StarterPiece? Find(string code) => All.FirstOrDefault(piece => string.Equals(piece.Code, code, StringComparison.Ordinal));

    private const StarterAudience Women = StarterAudience.Women;
    private const StarterAudience Men = StarterAudience.Men;
    private const StarterAudience Everyone = StarterAudience.Everyone;

    private static StarterPiece Piece(
        string code, StarterAudience audience, Category category, Subcategory type, string name, Color[] colors, Material material, int formality, int warmth, bool rainOk, StyleTag[] styles, Season[] seasons,
        Pattern pattern = Pattern.Plain) =>
        new(code, audience, new GarmentTags(category, type, name, colors, pattern, material, formality, warmth, rainOk, styles, seasons));
}
