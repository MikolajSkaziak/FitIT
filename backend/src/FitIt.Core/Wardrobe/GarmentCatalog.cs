using System.Collections.Frozen;

namespace FitIt.Core.Wardrobe;

/// <summary>
/// What the dictionary codes mean: which category a type belongs to, the Polish label a person reads, and the English
/// word the image and language models read.
/// </summary>
public static class GarmentCatalog
{
    public const int ScaleMin = 1;
    public const int ScaleMax = 5;

    private static readonly FrozenDictionary<Subcategory, (Category Category, string Label, string English)> Types =
        new Dictionary<Subcategory, (Category, string, string)>
        {
            [Subcategory.TShirt] = (Category.Top, "T-shirt", "t-shirt"),
            [Subcategory.Shirt] = (Category.Top, "Koszula", "shirt"),
            [Subcategory.Blouse] = (Category.Top, "Bluzka", "blouse"),
            [Subcategory.Polo] = (Category.Top, "Koszulka polo", "polo shirt"),
            [Subcategory.TankTop] = (Category.Top, "Top na ramiączkach", "tank top"),
            [Subcategory.Longsleeve] = (Category.Top, "Longsleeve", "long-sleeve top"),
            [Subcategory.Turtleneck] = (Category.Top, "Golf", "turtleneck"),

            [Subcategory.Sweater] = (Category.MidLayer, "Sweter", "sweater"),
            [Subcategory.Sweatshirt] = (Category.MidLayer, "Bluza", "sweatshirt"),
            [Subcategory.Hoodie] = (Category.MidLayer, "Bluza z kapturem", "hoodie"),
            [Subcategory.Cardigan] = (Category.MidLayer, "Kardigan", "cardigan"),
            [Subcategory.Blazer] = (Category.MidLayer, "Marynarka", "blazer"),
            [Subcategory.Vest] = (Category.MidLayer, "Kamizelka", "vest"),

            [Subcategory.Jeans] = (Category.Bottom, "Jeansy", "jeans"),
            [Subcategory.Trousers] = (Category.Bottom, "Spodnie materiałowe", "trousers"),
            [Subcategory.Chinos] = (Category.Bottom, "Chinosy", "chinos"),
            [Subcategory.Shorts] = (Category.Bottom, "Szorty", "shorts"),
            [Subcategory.Skirt] = (Category.Bottom, "Spódnica", "skirt"),
            [Subcategory.Leggings] = (Category.Bottom, "Legginsy", "leggings"),
            [Subcategory.Sweatpants] = (Category.Bottom, "Spodnie dresowe", "sweatpants"),

            [Subcategory.Dress] = (Category.OnePiece, "Sukienka", "dress"),
            [Subcategory.Jumpsuit] = (Category.OnePiece, "Kombinezon", "jumpsuit"),

            [Subcategory.Coat] = (Category.Outerwear, "Płaszcz", "coat"),
            [Subcategory.Jacket] = (Category.Outerwear, "Kurtka", "jacket"),
            [Subcategory.DownJacket] = (Category.Outerwear, "Kurtka puchowa", "down jacket"),
            [Subcategory.TrenchCoat] = (Category.Outerwear, "Trencz", "trench coat"),
            [Subcategory.Raincoat] = (Category.Outerwear, "Kurtka przeciwdeszczowa", "raincoat"),
            [Subcategory.Parka] = (Category.Outerwear, "Parka", "parka"),
            [Subcategory.BomberJacket] = (Category.Outerwear, "Bomberka", "bomber jacket"),
            [Subcategory.DenimJacket] = (Category.Outerwear, "Kurtka jeansowa", "denim jacket"),
            [Subcategory.LeatherJacket] = (Category.Outerwear, "Kurtka skórzana", "leather jacket"),

            [Subcategory.Sneakers] = (Category.Shoes, "Sneakersy", "sneakers"),
            [Subcategory.Boots] = (Category.Shoes, "Botki", "ankle boots"),
            [Subcategory.WinterBoots] = (Category.Shoes, "Buty zimowe", "winter boots"),
            [Subcategory.Loafers] = (Category.Shoes, "Mokasyny", "loafers"),
            [Subcategory.DressShoes] = (Category.Shoes, "Półbuty eleganckie", "dress shoes"),
            [Subcategory.Heels] = (Category.Shoes, "Buty na obcasie", "high heels"),
            [Subcategory.Flats] = (Category.Shoes, "Baleriny", "ballet flats"),
            [Subcategory.Sandals] = (Category.Shoes, "Sandały", "sandals"),
            [Subcategory.FlipFlops] = (Category.Shoes, "Klapki", "flip-flops"),
            [Subcategory.SportsShoes] = (Category.Shoes, "Buty sportowe", "sports shoes"),
            [Subcategory.RainBoots] = (Category.Shoes, "Kalosze", "rain boots"),

            [Subcategory.Scarf] = (Category.Accessory, "Szalik", "scarf"),
            [Subcategory.Hat] = (Category.Accessory, "Czapka", "beanie"),
            [Subcategory.Cap] = (Category.Accessory, "Czapka z daszkiem", "cap"),
            [Subcategory.Gloves] = (Category.Accessory, "Rękawiczki", "gloves"),
            [Subcategory.Belt] = (Category.Accessory, "Pasek", "belt"),
            [Subcategory.Bag] = (Category.Accessory, "Torebka", "handbag"),
            [Subcategory.Backpack] = (Category.Accessory, "Plecak", "backpack"),
            [Subcategory.Tie] = (Category.Accessory, "Krawat", "tie"),
            [Subcategory.Sunglasses] = (Category.Accessory, "Okulary przeciwsłoneczne", "sunglasses"),
        }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Category, string> Categories = new Dictionary<Category, string>
    {
        [Category.Top] = "Góra",
        [Category.MidLayer] = "Warstwa",
        [Category.Bottom] = "Dół",
        [Category.OnePiece] = "Jednoczęściowe",
        [Category.Outerwear] = "Okrycie wierzchnie",
        [Category.Shoes] = "Obuwie",
        [Category.Accessory] = "Dodatki",
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Color, (string Label, string English, bool Neutral)> Colors =
        new Dictionary<Color, (string, string, bool)>
        {
            [Color.White] = ("biały", "white", true),
            [Color.Cream] = ("kremowy", "cream", true),
            [Color.Beige] = ("beżowy", "beige", true),
            [Color.Grey] = ("szary", "grey", true),
            [Color.Black] = ("czarny", "black", true),
            [Color.Navy] = ("granatowy", "navy blue", true),
            [Color.Brown] = ("brązowy", "brown", true),
            [Color.Blue] = ("niebieski", "blue", false),
            [Color.LightBlue] = ("błękitny", "light blue", false),
            [Color.Green] = ("zielony", "green", false),
            [Color.Olive] = ("oliwkowy", "olive green", false),
            [Color.Red] = ("czerwony", "red", false),
            [Color.Burgundy] = ("bordowy", "burgundy", false),
            [Color.Pink] = ("różowy", "pink", false),
            [Color.Purple] = ("fioletowy", "purple", false),
            [Color.Yellow] = ("żółty", "yellow", false),
            [Color.Orange] = ("pomarańczowy", "orange", false),
        }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Pattern, (string Label, string English)> Patterns = new Dictionary<Pattern, (string, string)>
    {
        [Pattern.Plain] = ("gładki", "plain"),
        [Pattern.Stripes] = ("paski", "striped"),
        [Pattern.Check] = ("krata", "checked"),
        [Pattern.Floral] = ("kwiaty", "floral"),
        [Pattern.Print] = ("nadruk", "printed"),
        [Pattern.Other] = ("inny", "patterned"),
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<Material, (string Label, string English)> Materials = new Dictionary<Material, (string, string)>
    {
        [Material.Cotton] = ("bawełna", "cotton"),
        [Material.Denim] = ("denim", "denim"),
        [Material.Wool] = ("wełna", "wool"),
        [Material.Linen] = ("len", "linen"),
        [Material.Leather] = ("skóra", "leather"),
        [Material.Suede] = ("zamsz", "suede"),
        [Material.Synthetic] = ("syntetyk", "synthetic"),
        [Material.Knit] = ("dzianina", "knit"),
        [Material.Silk] = ("jedwab", "silk"),
        [Material.Down] = ("puch", "down-filled"),
        [Material.Other] = ("inny", ""),
    }.ToFrozenDictionary();

    private static readonly FrozenDictionary<StyleTag, string> Styles = new Dictionary<StyleTag, string>
    {
        [StyleTag.Casual] = "Casual",
        [StyleTag.Smart] = "Smart",
        [StyleTag.Elegant] = "Elegancki",
        [StyleTag.Sporty] = "Sportowy",
        [StyleTag.Streetwear] = "Streetwear",
    }.ToFrozenDictionary();

    /// <summary>Index 0 is formality 1. The anchors are the same ones the tagging model is given.</summary>
    public static IReadOnlyList<string> FormalityLabels { get; } = ["sportowe lub domowe", "codzienne", "smart casual", "biznesowe", "formalne lub wieczorowe"];

    /// <summary>Index 0 is warmth 1.</summary>
    public static IReadOnlyList<string> WarmthLabels { get; } = ["na upał", "lekkie", "przejściowe", "ciepłe", "na mróz"];

    public static Category CategoryOf(Subcategory type) => Types[type].Category;

    public static IEnumerable<Subcategory> TypesOf(Category category) => Enum.GetValues<Subcategory>().Where(type => Types[type].Category == category);

    public static string Label(Category category) => Categories[category];

    public static string Label(Subcategory type) => Types[type].Label;

    public static string Label(Color color) => Colors[color].Label;

    public static string Label(Pattern pattern) => Patterns[pattern].Label;

    public static string Label(Material material) => Materials[material].Label;

    public static string Label(StyleTag style) => Styles[style];

    public static string English(Subcategory type) => Types[type].English;

    public static string English(Color color) => Colors[color].English;

    public static string English(Pattern pattern) => Patterns[pattern].English;

    public static string English(Material material) => Materials[material].English;

    /// <summary>White, cream, beige, grey, black, navy and brown go with anything; the colour rule counts only the others.</summary>
    public static bool IsNeutral(Color color) => Colors[color].Neutral;

    public static bool IsOnScale(int value) => value is >= ScaleMin and <= ScaleMax;
}
