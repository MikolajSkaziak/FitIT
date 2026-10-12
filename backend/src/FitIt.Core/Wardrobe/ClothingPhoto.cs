namespace FitIt.Core.Wardrobe;

/// <summary>
/// One more photo of a garment besides its main picture: the print on the back, a detail, how it fits. Kept as it was
/// taken: no background removal, and never sent to an AI service, because it may show the person.
/// </summary>
public sealed class ClothingPhoto
{
    /// <summary>How many of these one garment can hold.</summary>
    public const int MaxPerGarment = 4;

    /// <summary>Version 7, so the ids of one garment's photos are in the order they were added.</summary>
    public Guid Id { get; init; }

    public Guid ClothingItemId { get; init; }

    /// <summary>Storage key of the photo as the phone sent it. Unique: sending the same key twice is the same photo.</summary>
    public required string Key { get; init; }

    /// <summary>Pixels as the photo is shown, so the app can lay it out before it has loaded.</summary>
    public int Width { get; init; }

    public int Height { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
