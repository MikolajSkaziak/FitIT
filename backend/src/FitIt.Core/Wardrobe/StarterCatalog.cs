namespace FitIt.Core.Wardrobe;

/// <summary>One of the common pieces a new person can tick instead of photographing: a fixed code, full tags and a picture under <c>wwwroot/starter/&lt;code&gt;.png</c>.</summary>
public sealed record StarterPiece(string Code, GarmentTags Tags)
{
    /// <summary>Path of the square, transparent picture under the API's static files. Depends on the code and nothing else.</summary>
    public string ImagePath => $"/starter/{Code}.png";
}

/// <summary>
/// About a dozen pieces most people own, chosen so that together they make a valid outfit in every temperature band: tops from
/// light to warm, two mid-layers, five bottoms, two pairs of shoes and a light and a heavy outer layer. Nothing is gendered.
/// The codes are stable: a garment remembers the code it came from.
/// </summary>
public static class StarterCatalog
{
    public static IReadOnlyList<StarterPiece> All { get; } =
    [
        Piece("white_tshirt", Category.Top, Subcategory.TShirt, "White T-shirt", [Color.White], Material.Cotton, 2, 1, false, [StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_tshirt", Category.Top, Subcategory.TShirt, "Black T-shirt", [Color.Black], Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("white_shirt", Category.Top, Subcategory.Shirt, "White button-up shirt", [Color.White], Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("gray_sweater", Category.MidLayer, Subcategory.Sweater, "Gray crewneck sweater", [Color.Grey], Material.Knit, 3, 3, false, [StyleTag.Casual, StyleTag.Smart], [Season.Fall, Season.Winter]),
        Piece("navy_hoodie", Category.MidLayer, Subcategory.Hoodie, "Navy hoodie", [Color.Navy], Material.Cotton, 1, 3, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("blue_jeans", Category.Bottom, Subcategory.Jeans, "Blue jeans", [Color.Blue], Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("black_jeans", Category.Bottom, Subcategory.Jeans, "Black jeans", [Color.Black], Material.Denim, 2, 3, false, [StyleTag.Casual, StyleTag.Smart, StyleTag.Streetwear], [Season.Spring, Season.Fall, Season.Winter]),
        Piece("beige_chinos", Category.Bottom, Subcategory.Chinos, "Beige chinos", [Color.Beige], Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("olive_cargo_pants", Category.Bottom, Subcategory.Trousers, "Olive cargo pants", [Color.Olive], Material.Cotton, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_shorts", Category.Bottom, Subcategory.Shorts, "Black shorts", [Color.Black], Material.Cotton, 2, 1, false, [StyleTag.Casual, StyleTag.Sporty], [Season.Summer]),
        Piece("white_sneakers", Category.Shoes, Subcategory.Sneakers, "White sneakers", [Color.White], Material.Leather, 2, 2, false, [StyleTag.Casual, StyleTag.Streetwear, StyleTag.Sporty], [Season.Spring, Season.Summer, Season.Fall]),
        Piece("black_boots", Category.Shoes, Subcategory.Boots, "Black boots", [Color.Black], Material.Leather, 3, 4, true, [StyleTag.Casual, StyleTag.Smart, StyleTag.Streetwear], [Season.Fall, Season.Winter]),
        Piece("navy_jacket", Category.Outerwear, Subcategory.Jacket, "Navy jacket", [Color.Navy], Material.Synthetic, 2, 2, true, [StyleTag.Casual, StyleTag.Smart], [Season.Spring, Season.Fall]),
        Piece("black_winter_coat", Category.Outerwear, Subcategory.Coat, "Black winter coat", [Color.Black], Material.Wool, 3, 5, true, [StyleTag.Casual, StyleTag.Smart, StyleTag.Elegant], [Season.Winter]),
    ];

    public static StarterPiece? Find(string code) => All.FirstOrDefault(piece => string.Equals(piece.Code, code, StringComparison.Ordinal));

    private static StarterPiece Piece(
        string code, Category category, Subcategory type, string name, Color[] colors, Material material, int formality, int warmth, bool rainOk, StyleTag[] styles, Season[] seasons) =>
        new(code, new GarmentTags(category, type, name, colors, Pattern.Plain, material, formality, warmth, rainOk, styles, seasons));
}
