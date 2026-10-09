using SkiaSharp;

namespace FitIt.Infrastructure.Wardrobe;

/// <summary>
/// Crops a picture without background to the garment in it. A background remover returns the garment somewhere inside the
/// frame of the photo, and whoever lays the picture out (the figure, the collage, the try-on) would otherwise size the empty
/// frame instead of the garment.
/// </summary>
public static class CutoutTrimmer
{
    public const string ContentType = "image/png";
    public const string Extension = "png";

    /// <summary>A pixel fainter than this is background: removers leave a haze around the garment.</summary>
    public const byte Visible = 16;

    /// <summary>What is left around the garment, as a share of its longer side, so it never touches the edge of a tile.</summary>
    public const double Margin = 0.02;

    /// <summary>
    /// The picture cropped to its visible part, as a PNG. Null when there is nothing to crop: the picture has no transparency
    /// (a photo standing in for a cutout), is already as tight as this would make it, shows nothing at all, or cannot be read.
    /// </summary>
    public static byte[]? Trim(ReadOnlySpan<byte> picture)
    {
        using var data = SKData.CreateCopy(picture);
        using var codec = SKCodec.Create(data);
        if (codec is null || codec.Info.AlphaType == SKAlphaType.Opaque)
        {
            return null;
        }

        // One known layout of pixels, whatever the file's own was: four bytes, alpha last, colours not multiplied by it.
        using var image = SKBitmap.Decode(codec, new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        if (image is null || Bounds(image) is not { } garment)
        {
            return null;
        }

        var margin = (int)Math.Ceiling(Math.Max(garment.Width, garment.Height) * Margin);
        var crop = SKRectI.Inflate(garment, margin, margin);
        crop.Intersect(new SKRectI(0, 0, image.Width, image.Height));
        if (crop.Width == image.Width && crop.Height == image.Height)
        {
            return null;
        }

        using var tight = new SKBitmap();
        if (!image.ExtractSubset(tight, crop))
        {
            return null;
        }

        using var encoded = tight.Encode(SKEncodedImageFormat.Png, 100);
        return encoded.ToArray();
    }

    /// <summary>The smallest rectangle that holds every visible pixel, or null when there is none.</summary>
    private static SKRectI? Bounds(SKBitmap image)
    {
        const int alpha = 3, pixel = 4;
        var pixels = image.GetPixelSpan();
        int left = image.Width, top = image.Height, right = -1, bottom = -1;
        for (var y = 0; y < image.Height; y++)
        {
            var row = pixels.Slice(y * image.RowBytes, image.Width * pixel);
            var first = 0;
            while (first < image.Width && row[first * pixel + alpha] < Visible)
            {
                first++;
            }

            if (first == image.Width)
            {
                continue;
            }

            var last = image.Width - 1;
            while (row[last * pixel + alpha] < Visible)
            {
                last--;
            }

            left = Math.Min(left, first);
            right = Math.Max(right, last);
            top = Math.Min(top, y);
            bottom = y;
        }

        return right < 0 ? null : new SKRectI(left, top, right + 1, bottom + 1);
    }
}
