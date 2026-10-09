using FitIt.Infrastructure.Wardrobe;
using FitIt.Tests.Support;
using SkiaSharp;

namespace FitIt.Tests.Wardrobe;

public sealed class CutoutTrimmerTests
{
    [Fact]
    public void A_padded_cutout_is_cropped_to_the_garment_with_a_thin_margin()
    {
        var tight = CutoutTrimmer.Trim(Pictures.Padded(640, 640, new SKRectI(200, 100, 400, 500)));

        Assert.NotNull(tight);
        using var picture = SKBitmap.Decode(tight);
        // The garment is 200 by 400; two percent of its longer side is left on every edge.
        Assert.Equal((216, 416), (picture.Width, picture.Height));
        Assert.Equal(0, picture.GetPixel(0, 0).Alpha);
        Assert.Equal(SKColors.Navy, picture.GetPixel(8, 8));
        Assert.Equal(SKColors.Navy, picture.GetPixel(207, 407));
        Assert.Equal(0, picture.GetPixel(208, 408).Alpha);
    }

    [Fact]
    public void The_margin_never_reaches_past_the_picture()
    {
        var tight = CutoutTrimmer.Trim(Pictures.Padded(300, 400, new SKRectI(0, 0, 100, 400)));

        Assert.NotNull(tight);
        using var picture = SKBitmap.Decode(tight);
        Assert.Equal((108, 400), (picture.Width, picture.Height));
    }

    [Fact]
    public void A_cropped_picture_is_left_alone_so_cropping_twice_changes_nothing()
    {
        var once = CutoutTrimmer.Trim(Pictures.Padded(640, 640, new SKRectI(200, 100, 400, 500)));

        Assert.Null(CutoutTrimmer.Trim(once));
    }

    [Fact]
    public void A_photo_an_empty_picture_and_bytes_that_are_no_picture_are_left_alone()
    {
        Assert.Null(CutoutTrimmer.Trim(Pictures.Photo(64, 64)));
        Assert.Null(CutoutTrimmer.Trim(Pictures.Padded(64, 64, SKRectI.Empty)));
        Assert.Null(CutoutTrimmer.Trim(ScriptedAi.Cutout));
        Assert.Null(CutoutTrimmer.Trim([]));
    }

    [Fact]
    public void Every_starter_picture_in_the_repository_is_already_cropped()
    {
        var folder = Path.Combine(AppContext.BaseDirectory, "wwwroot", "starter");
        if (!Directory.Exists(folder))
        {
            folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "FitIt.Api", "wwwroot", "starter"));
        }

        var pictures = Directory.GetFiles(folder, "*.png");
        Assert.NotEmpty(pictures);
        Assert.All(pictures, picture =>
        {
            using var tight = CutoutTrimmer.Trim(File.ReadAllBytes(picture)) is { } cropped ? SKBitmap.Decode(cropped) : null;
            Assert.True(tight is null, $"{Path.GetFileName(picture)} would be cropped to {tight?.Width}x{tight?.Height}");
        });
    }
}
