using SkiaSharp;

namespace FitIt.Tests.Support;

/// <summary>Small pictures made on the spot, for tests of what the API does with pixels.</summary>
public static class Pictures
{
    /// <summary>A transparent PNG with one opaque rectangle in it: a garment somewhere inside the frame of its photo.</summary>
    public static byte[] Padded(int width, int height, SKRectI garment)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        bitmap.Erase(SKColors.Transparent);
        bitmap.Erase(SKColors.Navy, garment);
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Png, 100);
        return encoded.ToArray();
    }

    /// <summary>A photo: every pixel opaque.</summary>
    public static byte[] Photo(int width, int height)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque));
        bitmap.Erase(SKColors.Gray);
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Jpeg, 90);
        return encoded.ToArray();
    }
}
