using System.Collections.Frozen;
using FitIt.Core.Common;

namespace FitIt.Core.Wardrobe;

/// <summary>
/// What the dictionary codes mean: which group and category a type belongs to, the English label a person reads, and the English
/// word the image and language models read.
/// </summary>
public static class GarmentCatalog
{
    /// <summary>A person may prefer every style on the list.</summary>
    public const int MaxPreferredStyles = 16;

    public const int ScaleMin = 1;
    public const int ScaleMax = 5;

    private static readonly FrozenDictionary<Subcategory, (Category Category, GarmentGroup Group, string Label, string English)> Types =
        new Dictionary<Subcategory, (Category, GarmentGroup, string, string)>
        {
            [Subcategory.TShirt] = (Category.Top, GarmentGroup.TShirtsAndTops, "T-shirt", "t-shirt"),
            [Subcategory.Shirt] = (Category.Top, GarmentGroup.ShirtsAndBlouses, "Shirt", "shirt"),
            [Subcategory.Blouse] = (Category.Top, GarmentGroup.ShirtsAndBlouses, "Blouse", "blouse"),
            [Subcategory.Polo] = (Category.Top, GarmentGroup.TShirtsAndTops, "Polo shirt", "polo shirt"),
            [Subcategory.TankTop] = (Category.Top, GarmentGroup.TShirtsAndTops, "Tank top", "tank top"),
            [Subcategory.Longsleeve] = (Category.Top, GarmentGroup.TShirtsAndTops, "Long-sleeve top", "long-sleeve top"),
            [Subcategory.Turtleneck] = (Category.Top, GarmentGroup.SweatersAndHoodies, "Turtleneck", "turtleneck"),

            [Subcategory.Sweater] = (Category.MidLayer, GarmentGroup.SweatersAndHoodies, "Sweater", "sweater"),
            [Subcategory.Sweatshirt] = (Category.MidLayer, GarmentGroup.SweatersAndHoodies, "Sweatshirt", "sweatshirt"),
            [Subcategory.Hoodie] = (Category.MidLayer, GarmentGroup.SweatersAndHoodies, "Hoodie", "hoodie"),
            [Subcategory.Cardigan] = (Category.MidLayer, GarmentGroup.SweatersAndHoodies, "Cardigan", "cardigan"),
            [Subcategory.Blazer] = (Category.MidLayer, GarmentGroup.SuitsAndBlazers, "Blazer", "blazer"),
            [Subcategory.SuitJacket] = (Category.MidLayer, GarmentGroup.SuitsAndBlazers, "Suit jacket", "suit jacket"),
            [Subcategory.Vest] = (Category.MidLayer, GarmentGroup.SuitsAndBlazers, "Vest", "vest"),
            [Subcategory.TrackJacket] = (Category.MidLayer, GarmentGroup.TracksuitsAndSweats, "Track jacket", "track jacket"),

            [Subcategory.Jeans] = (Category.Bottom, GarmentGroup.Jeans, "Jeans", "jeans"),
            [Subcategory.Trousers] = (Category.Bottom, GarmentGroup.Pants, "Trousers", "trousers"),
            [Subcategory.Chinos] = (Category.Bottom, GarmentGroup.Pants, "Chinos", "chinos"),
            [Subcategory.Shorts] = (Category.Bottom, GarmentGroup.Pants, "Shorts", "shorts"),
            [Subcategory.Skirt] = (Category.Bottom, GarmentGroup.Skirts, "Skirt", "skirt"),
            [Subcategory.Leggings] = (Category.Bottom, GarmentGroup.Pants, "Leggings", "leggings"),
            [Subcategory.Sweatpants] = (Category.Bottom, GarmentGroup.TracksuitsAndSweats, "Sweatpants", "sweatpants"),

            [Subcategory.Dress] = (Category.OnePiece, GarmentGroup.DressesAndJumpsuits, "Dress", "dress"),
            [Subcategory.Jumpsuit] = (Category.OnePiece, GarmentGroup.DressesAndJumpsuits, "Jumpsuit", "jumpsuit"),
            [Subcategory.Tracksuit] = (Category.OnePiece, GarmentGroup.TracksuitsAndSweats, "Tracksuit", "tracksuit"),

            [Subcategory.Coat] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Coat", "coat"),
            [Subcategory.Jacket] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Jacket", "jacket"),
            [Subcategory.DownJacket] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Down jacket", "down jacket"),
            [Subcategory.TrenchCoat] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Trench coat", "trench coat"),
            [Subcategory.Raincoat] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Raincoat", "raincoat"),
            [Subcategory.Parka] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Parka", "parka"),
            [Subcategory.BomberJacket] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Bomber jacket", "bomber jacket"),
            [Subcategory.DenimJacket] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Denim jacket", "denim jacket"),
            [Subcategory.LeatherJacket] = (Category.Outerwear, GarmentGroup.JacketsAndCoats, "Leather jacket", "leather jacket"),

            [Subcategory.Sneakers] = (Category.Shoes, GarmentGroup.Shoes, "Sneakers", "sneakers"),
            [Subcategory.Boots] = (Category.Shoes, GarmentGroup.Shoes, "Ankle boots", "ankle boots"),
            [Subcategory.WinterBoots] = (Category.Shoes, GarmentGroup.Shoes, "Winter boots", "winter boots"),
            [Subcategory.Loafers] = (Category.Shoes, GarmentGroup.Shoes, "Loafers", "loafers"),
            [Subcategory.DressShoes] = (Category.Shoes, GarmentGroup.Shoes, "Dress shoes", "dress shoes"),
            [Subcategory.Heels] = (Category.Shoes, GarmentGroup.Shoes, "High heels", "high heels"),
            [Subcategory.Flats] = (Category.Shoes, GarmentGroup.Shoes, "Ballet flats", "ballet flats"),
            [Subcategory.Sandals] = (Category.Shoes, GarmentGroup.Shoes, "Sandals", "sandals"),
            [Subcategory.FlipFlops] = (Category.Shoes, GarmentGroup.Shoes, "Flip-flops", "flip-flops"),
            [Subcategory.SportsShoes] = (Category.Shoes, GarmentGroup.Shoes, "Athletic shoes", "sports shoes"),
            [Subcategory.RainBoots] = (Category.Shoes, GarmentGroup.Shoes, "Rain boots", "rain boots"),

            [Subcategory.Scarf] = (Category.Accessory, GarmentGroup.Accessories, "Scarf", "scarf"),
            [Subcategory.Hat] = (Category.Accessory, GarmentGroup.Accessories, "Beanie", "beanie"),
            [Subcategory.Cap] = (Category.Accessory, GarmentGroup.Accessories, "Cap", "cap"),
            [Subcategory.Gloves] = (Category.Accessory, GarmentGroup.Accessories, "Gloves", "gloves"),
            [Subcategory.Belt] = (Category.Accessory, GarmentGroup.Accessories, "Belt", "belt"),
            [Subcategory.Bag] = (Category.Accessory, GarmentGroup.Bags, "Handbag", "handbag"),
            [Subcategory.Backpack] = (Category.Accessory, GarmentGroup.Bags, "Backpack", "backpack"),
            [Subcategory.Tie] = (Category.Accessory, GarmentGroup.Accessories, "Tie", "tie"),
            [Subcategory.Sunglasses] = (Category.Accessory, GarmentGroup.Accessories, "Sunglasses", "sunglasses"),
        }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Category, string> Categories = new Dictionary<Category, string>
    {
        [Category.Top] = "Tops",
        [Category.MidLayer] = "Warm layers",
        [Category.Bottom] = "Bottoms",
        [Category.OnePiece] = "Dresses and jumpsuits",
        [Category.Outerwear] = "Jackets and coats",
        [Category.Shoes] = "Shoes",
        [Category.Accessory] = "Accessories",
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<GarmentGroup, string> Groups = new Dictionary<GarmentGroup, string>
    {
        [GarmentGroup.TShirtsAndTops] = "T-shirts and tops",
        [GarmentGroup.ShirtsAndBlouses] = "Shirts and blouses",
        [GarmentGroup.SweatersAndHoodies] = "Sweaters and hoodies",
        [GarmentGroup.JacketsAndCoats] = "Jackets and coats",
        [GarmentGroup.Jeans] = "Jeans",
        [GarmentGroup.Pants] = "Pants and shorts",
        [GarmentGroup.Skirts] = "Skirts",
        [GarmentGroup.DressesAndJumpsuits] = "Dresses and jumpsuits",
        [GarmentGroup.SuitsAndBlazers] = "Suits and blazers",
        [GarmentGroup.TracksuitsAndSweats] = "Tracksuits and sweats",
        [GarmentGroup.Shoes] = "Shoes",
        [GarmentGroup.Bags] = "Bags",
        [GarmentGroup.Accessories] = "Accessories",
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Color, (string Label, string English, bool Neutral, string Hex)> Colors =
        new Dictionary<Color, (string, string, bool, string)>
        {
            [Color.White] = ("white", "white", true, "#FFFFFF"),
            [Color.Cream] = ("cream", "cream", true, "#F2EBD3"),
            [Color.Beige] = ("beige", "beige", true, "#D8C3A5"),
            [Color.Grey] = ("gray", "grey", true, "#9AA0A6"),
            [Color.Black] = ("black", "black", true, "#1C1C1E"),
            [Color.Navy] = ("navy", "navy blue", true, "#1F2A44"),
            [Color.Brown] = ("brown", "brown", true, "#7B5233"),
            [Color.Blue] = ("blue", "blue", false, "#2F6FD0"),
            [Color.LightBlue] = ("light blue", "light blue", false, "#9CC6EB"),
            [Color.Green] = ("green", "green", false, "#3F9150"),
            [Color.Olive] = ("olive", "olive green", false, "#6B7A3A"),
            [Color.Red] = ("red", "red", false, "#C8372F"),
            [Color.Burgundy] = ("burgundy", "burgundy", false, "#6E1F2E"),
            [Color.Pink] = ("pink", "pink", false, "#EFA3BE"),
            [Color.Purple] = ("purple", "purple", false, "#7A4FA8"),
            [Color.Yellow] = ("yellow", "yellow", false, "#EBC93A"),
            [Color.Orange] = ("orange", "orange", false, "#E8872C"),
        }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Pattern, (string Label, string English)> Patterns = new Dictionary<Pattern, (string, string)>
    {
        [Pattern.Plain] = ("plain", "plain"),
        [Pattern.Stripes] = ("striped", "striped"),
        [Pattern.Check] = ("checked", "checked"),
        [Pattern.Floral] = ("floral", "floral"),
        [Pattern.Print] = ("printed", "printed"),
        [Pattern.Other] = ("other pattern", "patterned"),
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Material, (string Label, string English)> Materials = new Dictionary<Material, (string, string)>
    {
        [Material.Cotton] = ("cotton", "cotton"),
        [Material.Denim] = ("denim", "denim"),
        [Material.Wool] = ("wool", "wool"),
        [Material.Linen] = ("linen", "linen"),
        [Material.Leather] = ("leather", "leather"),
        [Material.Suede] = ("suede", "suede"),
        [Material.Synthetic] = ("synthetic", "synthetic"),
        [Material.Knit] = ("knit", "knit"),
        [Material.Silk] = ("silk", "silk"),
        [Material.Down] = ("down", "down-filled"),
        [Material.Other] = ("other material", ""),
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Season, string> Seasons = new Dictionary<Season, string>
    {
        [Season.Spring] = "Spring",
        [Season.Summer] = "Summer",
        [Season.Fall] = "Fall",
        [Season.Winter] = "Winter",
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<StyleTag, string> Styles = new Dictionary<StyleTag, string>
    {
        [StyleTag.Casual] = "Casual",
        [StyleTag.Smart] = "Smart casual",
        [StyleTag.Elegant] = "Elegant",
        [StyleTag.Sporty] = "Sporty",
        [StyleTag.Streetwear] = "Streetwear",
        [StyleTag.Minimalist] = "Minimalist",
        [StyleTag.OldMoney] = "Old money",
        [StyleTag.Preppy] = "Preppy",
        [StyleTag.Vintage] = "Vintage",
        [StyleTag.Y2k] = "Y2K",
        [StyleTag.Boho] = "Boho",
        [StyleTag.Grunge] = "Grunge",
        [StyleTag.Gorpcore] = "Gorpcore",
        [StyleTag.Business] = "Business",
        [StyleTag.Romantic] = "Romantic",
        [StyleTag.Edgy] = "Edgy",
    }.ToFrozenDictionary();

    /// <summary>Index 0 is formality 1. The anchors are the same ones the tagging model is given.</summary>
    public static IReadOnlyList<string> FormalityLabels { get; } = ["loungewear and sport", "casual", "smart casual", "business", "formal"];

    /// <summary>Index 0 is warmth 1.</summary>
    public static IReadOnlyList<string> WarmthLabels { get; } = ["hot weather", "light", "mid-weight", "warm", "freezing weather"];

    public static Category CategoryOf(Subcategory type) => Types[type].Category;

    public static GarmentGroup GroupOf(Subcategory type) => Types[type].Group;

    public static IEnumerable<Subcategory> TypesOf(Category category) => Enum.GetValues<Subcategory>().Where(type => Types[type].Category == category);

    public static IEnumerable<Subcategory> TypesOf(GarmentGroup group) => Enum.GetValues<Subcategory>().Where(type => Types[type].Group == group);

    public static string Label(Category category) => Categories[category];

    /// <summary>The role as the stylist prompts name it (not the label a person reads).</summary>
    public static string Role(Category category) => category switch
    {
        Category.Top => "Top",
        Category.MidLayer => "Mid layer",
        Category.Bottom => "Bottom",
        Category.OnePiece => "One-piece",
        Category.Outerwear => "Outerwear",
        Category.Shoes => "Shoes",
        Category.Accessory => "Accessories",
        _ => throw new ArgumentOutOfRangeException(nameof(category)),
    };

    public static string Label(GarmentGroup group) => Groups[group];

    public static string Label(Subcategory type) => Types[type].Label;

    public static string Label(Color color) => Colors[color].Label;

    public static string Label(Pattern pattern) => Patterns[pattern].Label;

    public static string Label(Material material) => Materials[material].Label;

    public static string Label(StyleTag style) => Styles[style];

    /// <summary>The reference photo of a style on a woman, as a path under the static files (600 by 800, one file per style).</summary>
    public static string StylePhotoWoman(StyleTag style) => $"/styles/{EnumCodes.ToCode(style)}-f.jpg";

    /// <summary>The reference photo of a style on a man.</summary>
    public static string StylePhotoMan(StyleTag style) => $"/styles/{EnumCodes.ToCode(style)}-m.jpg";

    public static string Label(Season season) => Seasons[season];

    /// <summary>The colour as a swatch shows it (a content colour of the garment, not an interface colour).</summary>
    public static string Hex(Color color) => Colors[color].Hex;

    /// <summary>The seasons a garment of this warmth is taken to be for, when nobody said: light is spring and summer, mid-weight spring and fall, warm fall and winter.</summary>
    public static IReadOnlyList<Season> SeasonsFor(int warmth) => warmth switch
    {
        <= 2 => [Season.Spring, Season.Summer],
        3 => [Season.Spring, Season.Fall],
        _ => [Season.Fall, Season.Winter],
    };

    public static string English(Subcategory type) => Types[type].English;

    public static string English(Color color) => Colors[color].English;

    public static string English(Pattern pattern) => Patterns[pattern].English;

    public static string English(Material material) => Materials[material].English;

    /// <summary>White, cream, beige, gray, black, navy and brown go with anything; the colour rule counts only the others.</summary>
    public static bool IsNeutral(Color color) => Colors[color].Neutral;

    public static bool IsOnScale(int value) => value is >= ScaleMin and <= ScaleMax;
}
