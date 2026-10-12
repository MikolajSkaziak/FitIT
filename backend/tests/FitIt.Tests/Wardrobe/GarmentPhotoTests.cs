using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Wardrobe;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitIt.Tests.Wardrobe;

/// <summary>More photos of one garment besides its main picture: kept as taken, private, never sent to an AI service, at most four.</summary>
[Collection(ApiTests.Name)]
public sealed class GarmentPhotoTests(ApiFactory factory)
{
    [Fact]
    public async Task Extra_photos_need_a_signed_in_person()
    {
        var client = factory.CreateClient();
        var garment = Guid.NewGuid();

        foreach (var response in new[]
                 {
                     await client.PostAsync($"/api/clothes/{garment}/photos/uploads", null),
                     await client.PostJsonAsync($"/api/clothes/{garment}/photos", new JsonObject { ["key"] = "x" }),
                     await client.DeleteAsync($"/api/clothes/{garment}/photos/{Guid.NewGuid()}"),
                 })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task An_upload_address_for_an_extra_photo_is_for_one_jpeg_under_the_callers_own_prefix()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);

        var ticket = await (await client.PostAsync($"/api/clothes/{garment.Id}/photos/uploads", null)).ReadAsync<UploadResponse>();

        Assert.StartsWith($"u/{auth.User.Id:N}/extra/", ticket.Key, StringComparison.Ordinal);
        Assert.EndsWith(".jpg", ticket.Key, StringComparison.Ordinal);
        Assert.Equal("PUT", ticket.Method);
        Assert.Equal("image/jpeg", ticket.Headers["Content-Type"]);
        Assert.Equal(factory.Clock.GetUtcNow().AddMinutes(5), ticket.ExpiresAt);
        Assert.Equal(2_000_000, ticket.MaxBytes);
    }

    [Fact]
    public async Task Photos_are_added_listed_in_the_order_they_came_and_deleted_one_by_one()
    {
        factory.Ai.Reset();
        var (client, auth) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        Assert.Empty(garment.Photos);

        var back = await client.AddExtraPhotoAsync(factory.Storage, garment.Id, Pictures.Photo(60, 80));
        factory.Clock.Advance(TimeSpan.FromSeconds(1));
        var detail = await client.AddExtraPhotoAsync(factory.Storage, garment.Id, Pictures.Photo(90, 30));

        Assert.Equal((60, 80), (back.Width, back.Height));
        Assert.Equal((90, 30), (detail.Width, detail.Height));
        Assert.StartsWith($"u/{auth.User.Id:N}/extra/", back.ImageKey, StringComparison.Ordinal);
        Assert.Contains(back.ImageKey, back.ImageUrl, StringComparison.Ordinal);
        var shown = await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal([back.Id, detail.Id], shown.Photos.Select(photo => photo.Id));
        Assert.Equal(garment.ImageKey, shown.ImageKey);
        var listed = await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();
        Assert.Equal([back.Id, detail.Id], listed.Single().Photos.Select(photo => photo.Id));

        var removed = await client.DeleteAsync($"/api/clothes/{garment.Id}/photos/{back.Id}");

        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.False(factory.Storage.Contains(back.ImageKey));
        Assert.True(factory.Storage.Contains(detail.ImageKey));
        shown = await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal([detail.Id], shown.Photos.Select(photo => photo.Id));
        // The main picture is not one of these and is untouched.
        Assert.True(factory.Storage.Contains(shown.ImageKey!));
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/clothes/{garment.Id}/photos/{back.Id}")).StatusCode);
    }

    [Fact]
    public async Task An_extra_photo_is_kept_as_taken_costs_nothing_and_goes_to_no_ai_service()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var usedBefore = (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used;
        var (removals, taggings) = (factory.Ai.RemoverCalls, factory.Ai.TaggerCalls);
        factory.Jobs.Clear();
        var content = Pictures.Photo(60, 80);

        var photo = await client.AddExtraPhotoAsync(factory.Storage, garment.Id, content);
        await factory.Jobs.RunPendingAsync();

        Assert.Equal(0, factory.Jobs.PendingCount);
        Assert.Equal((removals, taggings), (factory.Ai.RemoverCalls, factory.Ai.TaggerCalls));
        Assert.DoesNotContain(factory.Ai.Seen, seen => seen.Key == photo.ImageKey);
        Assert.Equal(usedBefore, (await (await client.GetAsync("/api/me/usage")).ReadAsync<UsageResponse>()).Items.Used);
        Assert.Equal(content, await factory.Storage.ReadAsync(photo.ImageKey, null, CancellationToken.None));
        var shown = await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Ready, shown.Status);
        Assert.Equal(garment.ImageKey, shown.ImageKey);
    }

    [Fact]
    public async Task Extra_photos_need_no_ai_consent_because_nothing_is_sent_out()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        await client.GiveConsentAsync(false);

        var photo = await client.AddExtraPhotoAsync(factory.Storage, garment.Id);

        Assert.True(factory.Storage.Contains(photo.ImageKey));
    }

    [Fact]
    public async Task The_same_key_sent_twice_is_one_photo()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var other = await factory.AddProcessedGarmentAsync(client);
        var key = await client.UploadExtraPhotoAsync(factory.Storage, garment.Id);

        var first = await client.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = key });
        var second = await client.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = key });
        var elsewhere = await client.PostJsonAsync($"/api/clothes/{other.Id}/photos", new JsonObject { ["key"] = key });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal((await first.ReadAsync<ClothingPhotoResponse>()).Id, (await second.ReadAsync<ClothingPhotoResponse>()).Id);
        Assert.Equal(HttpStatusCode.Conflict, elsewhere.StatusCode);
        Assert.Equal("key_in_use", await elsewhere.ProblemCodeAsync());
        Assert.Single((await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>()).Photos);
        Assert.Empty((await (await client.GetAsync($"/api/clothes/{other.Id}")).ReadAsync<ClothingResponse>()).Photos);
    }

    [Fact]
    public async Task A_garment_holds_four_extra_photos_and_a_fifth_is_refused_and_not_kept()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        // An address handed out while there was still room.
        var early = await client.UploadExtraPhotoAsync(factory.Storage, garment.Id);
        for (var index = 0; index < ClothingPhoto.MaxPerGarment; index++)
        {
            await client.AddExtraPhotoAsync(factory.Storage, garment.Id);
        }

        var address = await client.PostAsync($"/api/clothes/{garment.Id}/photos/uploads", null);
        var fifth = await client.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = early });

        Assert.Equal(HttpStatusCode.Conflict, address.StatusCode);
        Assert.Equal("photo_limit_reached", await address.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.Conflict, fifth.StatusCode);
        var problem = await fifth.Content.ReadAsStringAsync();
        Assert.Equal("photo_limit_reached", JsonNode.Parse(problem)!["code"]!.GetValue<string>());
        Assert.Equal(4, JsonNode.Parse(problem)!["max"]!.GetValue<int>());
        Assert.False(factory.Storage.Contains(early));
        var shown = await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(4, shown.Photos.Count);

        // Removing one makes room again.
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/clothes/{garment.Id}/photos/{shown.Photos[0].Id}")).StatusCode);
        await client.AddExtraPhotoAsync(factory.Storage, garment.Id);
    }

    [Fact]
    public async Task The_limit_of_four_holds_however_many_photos_arrive_at_once()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var keys = new List<string>();
        for (var index = 0; index < 9; index++)
        {
            keys.Add(await client.UploadExtraPhotoAsync(factory.Storage, garment.Id));
        }

        var responses = await Task.WhenAll(keys.Select(key => client.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = key })));

        Assert.Equal(4, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(5, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(4, await factory.WithDatabaseAsync(db => db.ClothingPhotos.CountAsync(photo => photo.ClothingItemId == garment.Id)));
        Assert.Equal(4, keys.Count(factory.Storage.Contains));
    }

    [Fact]
    public async Task Somebody_elses_garment_and_its_photos_look_as_if_they_did_not_exist()
    {
        factory.Ai.Reset();
        var (owner, _) = await factory.SignedInWithConsentAsync();
        var (stranger, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(owner);
        var photo = await owner.AddExtraPhotoAsync(factory.Storage, garment.Id);
        var strangersGarment = await factory.AddProcessedGarmentAsync(stranger);
        var strangersKey = await stranger.UploadExtraPhotoAsync(factory.Storage, strangersGarment.Id);

        var address = await stranger.PostAsync($"/api/clothes/{garment.Id}/photos/uploads", null);
        var add = await stranger.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = strangersKey });
        var delete = await stranger.DeleteAsync($"/api/clothes/{garment.Id}/photos/{photo.Id}");
        // Nor through a garment of their own.
        var sideways = await stranger.DeleteAsync($"/api/clothes/{strangersGarment.Id}/photos/{photo.Id}");

        foreach (var response in new[] { address, add, delete, sideways })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        Assert.True(factory.Storage.Contains(photo.ImageKey));
        Assert.Single((await (await owner.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>()).Photos);
    }

    [Fact]
    public async Task A_key_that_was_not_issued_for_an_extra_photo_of_this_account_is_refused()
    {
        factory.Ai.Reset();
        var (owner, _) = await factory.SignedInWithConsentAsync();
        var (other, otherAuth) = await factory.SignedInWithConsentAsync();
        var foreignGarment = await factory.AddProcessedGarmentAsync(owner);
        var foreignKey = await owner.UploadExtraPhotoAsync(factory.Storage, foreignGarment.Id);
        var garment = await factory.AddProcessedGarmentAsync(other);
        // A key for a new garment is not a key for an extra photo: that one would be sent to the AI services.
        var mainKey = await other.UploadPhotoAsync(factory.Storage);

        foreach (var key in new[] { foreignKey, mainKey, "whatever.jpg", garment.ImageKey!, $"u/{otherAuth.User.Id:N}/extra/../x.jpg" })
        {
            var response = await other.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = key });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("key_invalid", await response.ProblemCodeAsync());
        }

        Assert.True(factory.Storage.Contains(foreignKey));
        // And the other way round: an extra photo cannot become a garment.
        var asGarment = await owner.PostJsonAsync("/api/clothes", new JsonObject { ["key"] = foreignKey });
        Assert.Equal("key_invalid", await asGarment.ProblemCodeAsync());
    }

    [Theory]
    [InlineData("missing", "upload_missing")]
    [InlineData("too_large", "upload_too_large")]
    [InlineData("png", "upload_not_jpeg")]
    [InlineData("empty", "upload_not_jpeg")]
    [InlineData("broken", "upload_not_jpeg")]
    public async Task What_was_really_uploaded_as_an_extra_photo_is_checked_like_the_main_one(string what, string code)
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var ticket = await (await client.PostAsync($"/api/clothes/{garment.Id}/photos/uploads", null)).ReadAsync<UploadResponse>();
        switch (what)
        {
            case "too_large":
                factory.Storage.Put(ticket.Key, TestApi.Jpeg(2_000_001));
                break;
            case "png":
                factory.Storage.Put(ticket.Key, Pictures.Padded(20, 20, new SkiaSharp.SKRectI(2, 2, 10, 10)));
                break;
            case "empty":
                factory.Storage.Put(ticket.Key, []);
                break;
            case "broken":
                // Starts like a JPEG and is not a picture.
                factory.Storage.Put(ticket.Key, TestApi.Jpeg());
                break;
        }

        var response = await client.PostJsonAsync($"/api/clothes/{garment.Id}/photos", new JsonObject { ["key"] = ticket.Key });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
        Assert.False(factory.Storage.Contains(ticket.Key));
        Assert.Empty((await (await client.GetAsync($"/api/clothes/{garment.Id}")).ReadAsync<ClothingResponse>()).Photos);
    }

    [Fact]
    public async Task Deleting_a_garment_removes_its_extra_photos_from_storage_too()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var kept = await factory.AddProcessedGarmentAsync(client);
        var first = await client.AddExtraPhotoAsync(factory.Storage, garment.Id);
        var second = await client.AddExtraPhotoAsync(factory.Storage, garment.Id);
        var keptPhoto = await client.AddExtraPhotoAsync(factory.Storage, kept.Id);

        var response = await client.DeleteAsync($"/api/clothes/{garment.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(factory.Storage.Contains(first.ImageKey));
        Assert.False(factory.Storage.Contains(second.ImageKey));
        Assert.True(factory.Storage.Contains(keptPhoto.ImageKey));
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.ClothingPhotos.CountAsync(photo => photo.ClothingItemId == garment.Id)));
    }

    [Fact]
    public async Task A_photo_that_turns_out_not_to_be_a_garment_takes_its_extra_photos_with_it()
    {
        factory.Ai.Reset().TaggingRefuses(RejectReason.NoGarment);
        var (client, _) = await factory.SignedInWithConsentAsync();
        var waiting = await client.AddGarmentAsync(factory.Storage);
        var photo = await client.AddExtraPhotoAsync(factory.Storage, waiting.Id);

        await factory.ProcessAsync(waiting.Id);

        Assert.False(factory.Storage.Contains(photo.ImageKey));
        var refused = await (await client.GetAsync($"/api/clothes/{waiting.Id}")).ReadAsync<ClothingResponse>();
        Assert.Equal(ClothingStatus.Rejected, refused.Status);
        Assert.Empty(refused.Photos);
        // A refused photo is no garment: it takes no more photos.
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/clothes/{waiting.Id}/photos/uploads", null)).StatusCode);
    }

    [Fact]
    public async Task The_sweep_for_files_without_a_row_keeps_attached_photos_and_removes_abandoned_ones()
    {
        factory.Ai.Reset();
        var (client, _) = await factory.SignedInWithConsentAsync();
        var garment = await factory.AddProcessedGarmentAsync(client);
        var attached = await client.AddExtraPhotoAsync(factory.Storage, garment.Id);
        var abandoned = await client.UploadExtraPhotoAsync(factory.Storage, garment.Id);

        factory.Clock.Advance(TimeSpan.FromHours(25));
        await factory.WithServicesAsync(services => services.GetRequiredService<WardrobeMaintenance>().RemoveOrphansAsync());

        Assert.True(factory.Storage.Contains(attached.ImageKey));
        Assert.False(factory.Storage.Contains(abandoned));
    }
}
