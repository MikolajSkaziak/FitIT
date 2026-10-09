using FitIt.Api.Contracts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace FitIt.Tests.Wardrobe;

[Collection(ApiTests.Name)]
public sealed class MaintenanceTests(ApiFactory factory)
{
    [Fact]
    public async Task Files_without_a_garment_are_removed_after_a_day_and_not_before()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var kept = await factory.AddProcessedGarmentAsync(client);
        var keptKeys = await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == kept.Id).Select(item => new { item.OriginalKey, item.CutoutKey }).SingleAsync());
        var abandoned = await client.UploadPhotoAsync(factory.Storage);

        factory.Clock.Advance(TimeSpan.FromHours(23));
        await SweepAsync();
        Assert.True(factory.Storage.Contains(abandoned));

        // A photo uploaded just before the sweep belongs to somebody still in the middle of adding it.
        client = await factory.SignInAgainAsync(auth);
        var recent = await client.UploadPhotoAsync(factory.Storage);
        factory.Clock.Advance(TimeSpan.FromHours(2));
        await SweepAsync();

        Assert.False(factory.Storage.Contains(abandoned));
        Assert.True(factory.Storage.Contains(recent));
        Assert.True(factory.Storage.Contains(keptKeys.OriginalKey));
        Assert.True(factory.Storage.Contains(keptKeys.CutoutKey!));
    }

    [Fact]
    public async Task The_row_of_a_refused_photo_is_kept_for_a_day_to_explain_and_then_removed()
    {
        factory.Ai.Reset().TaggingRefuses(RejectReason.NoGarment);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var refused = await client.AddGarmentAsync(factory.Storage);
        await factory.ProcessAsync(refused.Id);

        factory.Clock.Advance(TimeSpan.FromHours(23));
        await SweepAsync();
        Assert.True(await factory.WithDatabaseAsync(db => db.Clothes.AnyAsync(item => item.Id == refused.Id)));

        factory.Clock.Advance(TimeSpan.FromHours(2));
        await SweepAsync();
        Assert.False(await factory.WithDatabaseAsync(db => db.Clothes.AnyAsync(item => item.Id == refused.Id)));
    }

    [Fact]
    public async Task A_garment_stuck_in_processing_is_put_back_in_the_queue_and_a_fresh_one_is_left_alone()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var stuck = await client.AddGarmentAsync(factory.Storage);
        factory.Clock.Advance(WardrobeMaintenance.StuckAfter + TimeSpan.FromMinutes(1));
        client = await factory.SignInAgainAsync(auth);
        var fresh = await client.AddGarmentAsync(factory.Storage);
        factory.Jobs.Clear();

        var requeued = await factory.WithServicesAsync(services => services.GetRequiredService<WardrobeMaintenance>().RequeueWaitingAsync());

        Assert.True(requeued >= 1);
        await factory.Jobs.RunPendingAsync();
        Assert.Equal(ClothingStatus.Ready, (await (await client.GetAsync($"/api/clothes/{stuck.Id}")).ReadAsync<ClothingResponse>()).Status);
        Assert.Equal(ClothingStatus.Processing, (await (await client.GetAsync($"/api/clothes/{fresh.Id}")).ReadAsync<ClothingResponse>()).Status);
    }

    [Fact]
    public async Task Cutouts_stored_before_cropping_are_cropped_once_under_a_new_name()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var photographed = await factory.AddProcessedGarmentAsync(client);
        await client.PostJsonAsync("/api/me/starter-pieces", new System.Text.Json.Nodes.JsonObject { ["codes"] = new System.Text.Json.Nodes.JsonArray("white_tshirt") });
        var piece = (await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>()).Single(item => item.Id != photographed.Id);

        // Both as they were stored before: the whole frame of the photo, under the old name.
        var padded = Pictures.Padded(640, 640, new SKRectI(200, 100, 400, 500));
        var oldPhotographed = $"u/{auth.User.Id:N}/cut/{photographed.Id:N}.png";
        var oldPiece = $"u/{auth.User.Id:N}/cut/{piece.Id:N}.png";
        factory.Storage.Put(oldPhotographed, padded, "image/png");
        factory.Storage.Put(oldPiece, padded, "image/png");
        await factory.WithDatabaseAsync(async db =>
        {
            await db.Clothes.Where(item => item.Id == photographed.Id).ExecuteUpdateAsync(set => set.SetProperty(item => item.CutoutKey, oldPhotographed));
            return await db.Clothes.Where(item => item.Id == piece.Id).ExecuteUpdateAsync(set => set.SetProperty(item => item.CutoutKey, oldPiece).SetProperty(item => item.OriginalKey, oldPiece));
        });

        Assert.Equal(2, await TightenAsync());

        var after = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().Where(item => item.UserId == auth.User.Id).ToDictionaryAsync(item => item.Id));
        Assert.Equal($"u/{auth.User.Id:N}/cut/{photographed.Id:N}-tight.png", after[photographed.Id].CutoutKey);
        Assert.NotEqual(after[photographed.Id].CutoutKey, after[photographed.Id].OriginalKey);
        // A starter piece has one file for both keys, before and after.
        Assert.Equal($"u/{auth.User.Id:N}/cut/{piece.Id:N}-tight.png", after[piece.Id].CutoutKey);
        Assert.Equal(after[piece.Id].CutoutKey, after[piece.Id].OriginalKey);
        Assert.False(factory.Storage.Contains(oldPhotographed));
        Assert.False(factory.Storage.Contains(oldPiece));
        foreach (var item in after.Values)
        {
            using var stored = SKBitmap.Decode(await factory.Storage.ReadAsync(item.CutoutKey!, null, CancellationToken.None));
            Assert.Equal((216, 416), (stored.Width, stored.Height));
        }

        // The app is told the new name, which is what it caches the picture by.
        Assert.Equal(after[piece.Id].CutoutKey, (await (await client.GetAsync($"/api/clothes/{piece.Id}")).ReadAsync<ClothingResponse>()).ImageKey);
        Assert.Equal(0, await TightenAsync());
    }

    [Fact]
    public async Task A_cutout_that_cannot_be_read_is_skipped_and_the_rest_are_still_cropped()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var lost = await factory.AddProcessedGarmentAsync(client);
        var fine = await factory.AddProcessedGarmentAsync(client);
        var missing = $"u/{auth.User.Id:N}/cut/{lost.Id:N}.png";
        var old = $"u/{auth.User.Id:N}/cut/{fine.Id:N}.png";
        factory.Storage.Put(old, Pictures.Padded(64, 64, new SKRectI(10, 10, 30, 30)), "image/png");
        await factory.WithDatabaseAsync(async db =>
        {
            await db.Clothes.Where(item => item.Id == lost.Id).ExecuteUpdateAsync(set => set.SetProperty(item => item.CutoutKey, missing));
            return await db.Clothes.Where(item => item.Id == fine.Id).ExecuteUpdateAsync(set => set.SetProperty(item => item.CutoutKey, old));
        });

        Assert.Equal(1, await TightenAsync());

        var keys = await factory.WithDatabaseAsync(db => db.Clothes.AsNoTracking().Where(item => item.UserId == auth.User.Id).ToDictionaryAsync(item => item.Id, item => item.CutoutKey));
        Assert.Equal(missing, keys[lost.Id]);
        Assert.EndsWith("-tight.png", keys[fine.Id], StringComparison.Ordinal);

        // Left as it was, the lost one would be tried on every run; this test must not leave that behind for the others.
        await factory.WithDatabaseAsync(db => db.Clothes.Where(item => item.Id == lost.Id).ExecuteDeleteAsync());
    }

    private Task<int> TightenAsync() => factory.WithServicesAsync(services => services.GetRequiredService<WardrobeMaintenance>().TightenCutoutsAsync());

    private Task<int> SweepAsync() => factory.WithServicesAsync(services => services.GetRequiredService<WardrobeMaintenance>().RemoveOrphansAsync());
}
