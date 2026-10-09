namespace FitIt.Core.Wardrobe;

/// <summary>
/// Closed list of styles: a garment carries a subset, a profile carries the preferred ones (product spec 5.2). The order
/// is the order on screen. Codes are the snake_case names (<c>old_money</c>, <c>y2k</c>); a reference photo of each lives
/// under <c>wwwroot/styles</c> (<see cref="GarmentCatalog.StylePhotoPath"/>).
/// </summary>
public enum StyleTag
{
    Casual,
    Smart,
    Elegant,
    Sporty,
    Streetwear,
    Minimalist,
    OldMoney,
    Preppy,
    Vintage,
    Y2k,
    Boho,
    Grunge,
    Gorpcore,
    Business,
    Romantic,
    Edgy,
}
