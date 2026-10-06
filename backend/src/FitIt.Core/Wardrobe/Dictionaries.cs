namespace FitIt.Core.Wardrobe;

// The closed lists of product spec 5.2. Values travel as snake case codes (EnumCodes); what a person reads comes
// from GarmentCatalog. Order within each enum is the order shown in pickers.

/// <summary>The role a garment plays in an outfit.</summary>
public enum Category
{
    Top,
    MidLayer,
    Bottom,
    OnePiece,
    Outerwear,
    Shoes,
    Accessory,
}

/// <summary>The type of garment. Each belongs to exactly one <see cref="Category"/> (see <see cref="GarmentCatalog"/>).</summary>
public enum Subcategory
{
    TShirt,
    Shirt,
    Blouse,
    Polo,
    TankTop,
    Longsleeve,
    Turtleneck,

    Sweater,
    Sweatshirt,
    Hoodie,
    Cardigan,
    Blazer,
    Vest,

    Jeans,
    Trousers,
    Chinos,
    Shorts,
    Skirt,
    Leggings,
    Sweatpants,

    Dress,
    Jumpsuit,

    Coat,
    Jacket,
    DownJacket,
    TrenchCoat,
    Raincoat,
    Parka,
    BomberJacket,
    DenimJacket,
    LeatherJacket,

    Sneakers,
    Boots,
    WinterBoots,
    Loafers,
    DressShoes,
    Heels,
    Flats,
    Sandals,
    FlipFlops,
    SportsShoes,
    RainBoots,

    Scarf,
    Hat,
    Cap,
    Gloves,
    Belt,
    Bag,
    Backpack,
    Tie,
    Sunglasses,
}

public enum Color
{
    White,
    Cream,
    Beige,
    Grey,
    Black,
    Navy,
    Brown,
    Blue,
    LightBlue,
    Green,
    Olive,
    Red,
    Burgundy,
    Pink,
    Purple,
    Yellow,
    Orange,
}

public enum Pattern
{
    Plain,
    Stripes,
    Check,
    Floral,
    Print,
    Other,
}

public enum Material
{
    Cotton,
    Denim,
    Wool,
    Linen,
    Leather,
    Suede,
    Synthetic,
    Knit,
    Silk,
    Down,
    Other,
}

/// <summary>Where a garment is in its life in the wardrobe.</summary>
public enum ClothingStatus
{
    /// <summary>The photo is in; background removal and tagging are under way (or waiting for tomorrow's AI budget).</summary>
    Processing,

    /// <summary>Tagged and usable by the stylist.</summary>
    Ready,

    /// <summary>Tagging did not succeed; the person can fill the tags in by hand or ask for another try.</summary>
    Failed,

    /// <summary>The photo is not a single wearable garment. It never enters the wardrobe.</summary>
    Rejected,
}

/// <summary>Why a photo was not accepted (product spec 5.3).</summary>
public enum RejectReason
{
    NoGarment,
    SeveralGarments,
    UnderwearOrSwimwear,
    Unclear,
}
