using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

[Collection(ApiTests.Name)]
public sealed class OutfitApiTests(ApiFactory factory)
{
    [Fact]
    public async Task Outfits_need_a_signed_in_person()
    {
        var client = factory.CreateClient();
        var id = Guid.NewGuid();

        foreach (var response in new[]
                 {
                     await client.GetAsync("/api/outfits"),
                     await client.GetAsync($"/api/outfits/{id}"),
                     await client.PatchJsonAsync($"/api/outfits/{id}", new JsonObject { ["saved"] = true }),
                     await client.DeleteAsync($"/api/outfits/{id}"),
                 })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task A_proposal_can_be_read_again_exactly_as_it_was_made()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var proposed = (await client.SuggestedAsync("date", "kolacja")).Outfits[0];

        var response = await client.GetAsync($"/api/outfits/{proposed.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var read = await response.ReadAsync<OutfitResponse>();
        Assert.Equivalent(Unsigned(proposed), Unsigned(read), strict: true);
        Assert.Equal((Occasion.Date, "kolacja"), (read.Occasion, read.OccasionNote));
    }

    [Fact]
    public async Task Saved_outfits_are_listed_newest_first_and_proposals_that_were_not_kept_are_not_among_them()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var first = await client.SuggestedAsync();
        factory.Clock.Advance(TimeSpan.FromMinutes(1));
        var second = await client.SuggestedAsync("work");
        Assert.Empty(await ListAsync(client, "?saved=true"));

        var kept = await client.PatchJsonAsync($"/api/outfits/{first.Outfits[1].Id}", new JsonObject { ["saved"] = true });
        await client.PatchJsonAsync($"/api/outfits/{second.Outfits[0].Id}", new JsonObject { ["saved"] = true });

        Assert.Equal(HttpStatusCode.OK, kept.StatusCode);
        Assert.True((await kept.ReadAsync<OutfitResponse>()).IsSaved);
        Assert.Equal([second.Outfits[0].Id, first.Outfits[1].Id], (await ListAsync(client, "?saved=true")).Select(outfit => outfit.Id));
        Assert.All(await ListAsync(client, "?saved=true"), outfit => Assert.True(outfit.IsSaved));
        Assert.Equal(4, (await ListAsync(client, "?saved=false")).Count);
        // Without the filter: everything that was ever proposed, the newest request first and within it the best score first.
        Assert.Equal(second.Outfits.Concat(first.Outfits).Select(outfit => outfit.Id), (await ListAsync(client)).Select(outfit => outfit.Id));

        await client.PatchJsonAsync($"/api/outfits/{second.Outfits[0].Id}", new JsonObject { ["saved"] = false });
        Assert.Equal([first.Outfits[1].Id], (await ListAsync(client, "?saved=true")).Select(outfit => outfit.Id));
    }

    [Fact]
    public async Task An_outfit_can_be_liked_disliked_and_the_rating_cleared()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        async Task<OutfitRating> RateAsync(string rating)
        {
            var response = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["rating"] = rating });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.ReadAsync<OutfitResponse>()).Rating;
        }

        Assert.Equal(OutfitRating.Like, await RateAsync("like"));
        var likedAt = await factory.WithDatabaseAsync(db => db.Outfits.Where(found => found.Id == outfit.Id).Select(found => found.RatedAt).SingleAsync());
        Assert.Equal(factory.Clock.GetUtcNow(), likedAt);
        Assert.Equal(OutfitRating.Dislike, await RateAsync("dislike"));
        Assert.Equal(OutfitRating.None, await RateAsync("none"));
        Assert.Null(await factory.WithDatabaseAsync(db => db.Outfits.Where(found => found.Id == outfit.Id).Select(found => found.RatedAt).SingleAsync()));

        // Rating says nothing about keeping or wearing.
        var read = await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>();
        Assert.Equal((OutfitRating.None, false, null), (read.Rating, read.IsSaved, read.WornOn));
    }

    [Theory]
    [InlineData("""{"rating":"love"}""", "bad_request")]
    [InlineData("""{"rating":1}""", "bad_request")]
    [InlineData("""{"saved":"yes"}""", "bad_request")]
    [InlineData("""{"worn":false}""", "wear_cannot_be_undone")]
    public async Task A_change_that_does_not_fit_the_contract_is_refused_and_changes_nothing(string body, string code)
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        var response = await client.PatchAsync($"/api/outfits/{outfit.Id}", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, await response.ProblemCodeAsync());
        Assert.Equivalent(Unsigned(outfit), Unsigned(await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()), strict: true);
    }

    [Fact]
    public async Task An_empty_change_changes_nothing_and_several_things_can_change_at_once()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        var untouched = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject())).ReadAsync<OutfitResponse>();
        var changed = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["saved"] = true, ["rating"] = "like", ["worn"] = true })).ReadAsync<OutfitResponse>();

        Assert.Equivalent(Unsigned(outfit), Unsigned(untouched), strict: true);
        Assert.Equal((true, OutfitRating.Like), (changed.IsSaved, changed.Rating));
        Assert.NotNull(changed.WornOn);
    }

    private static JsonObject Placement(Guid clothingId, double x = 0.5, double y = 0.5, double scale = 0.3, int z = 0) =>
        new() { ["clothingId"] = clothingId.ToString(), ["x"] = x, ["y"] = y, ["scale"] = scale, ["z"] = z };

    private static JsonObject Arranged(params JsonObject[] placements) => new() { ["layout"] = new JsonArray([.. placements]) };

    [Fact]
    public async Task The_board_can_be_arranged_is_kept_with_the_outfit_and_goes_back_to_automatic()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        Assert.Null(outfit.Layout);
        var (first, second) = (outfit.Items[0].Clothing.Id, outfit.Items[1].Clothing.Id);

        // Not every garment has to be placed: the rest keep their automatic place.
        var arranged = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", Arranged(Placement(first, 0.25, 0.3, 0.4, 1), Placement(second, 1, 0, 0.05, 0)));

        Assert.Equal(HttpStatusCode.OK, arranged.StatusCode);
        OutfitPlacementResponse[] expected = [new(first, 0.25, 0.3, 0.4, 1), new(second, 1, 0, 0.05, 0)];
        Assert.Equal(expected, (await arranged.ReadAsync<OutfitResponse>()).Layout);
        Assert.Equal(expected, (await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()).Layout);
        Assert.Equal(expected, (await ListAsync(client)).Single(listed => listed.Id == outfit.Id).Layout);

        // A change that does not name the layout leaves the board alone.
        var kept = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["saved"] = true })).ReadAsync<OutfitResponse>();
        Assert.Equal(expected, kept.Layout);

        // Null and an empty list both go back to the automatic layout.
        var cleared = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["layout"] = null })).ReadAsync<OutfitResponse>();
        Assert.Null(cleared.Layout);
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", Arranged(Placement(first)));
        var emptied = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", Arranged())).ReadAsync<OutfitResponse>();
        Assert.Null(emptied.Layout);
        Assert.True(emptied.IsSaved);
    }

    [Fact]
    public async Task An_arrangement_that_does_not_fit_the_outfit_or_the_board_is_refused_and_changes_nothing()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Belt]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var ids = outfit.Items.Select(item => item.Clothing.Id).ToList();
        var outside = wardrobe.Select(item => item.Id).Except(ids).FirstOrDefault(Guid.NewGuid());
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", Arranged(Placement(ids[0], 0.2, 0.2)));
        var before = await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>();

        async Task Refused(JsonObject body, string code)
        {
            var response = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(code, await response.ProblemCodeAsync());
        }

        await Refused(Arranged(Placement(outside)), "layout_invalid");
        await Refused(Arranged(Placement(Guid.NewGuid())), "layout_invalid");
        await Refused(Arranged(Placement(ids[0]), Placement(ids[0], 0.7)), "layout_invalid");
        await Refused(Arranged([.. ids.Select(id => Placement(id)), Placement(ids[0])]), "layout_invalid");
        await Refused(Arranged(Placement(ids[0], x: -0.01)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], x: 1.01)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], y: 2)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], scale: 0.01)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], scale: 1.5)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], z: -1)), "validation_failed");
        await Refused(Arranged(Placement(ids[0], z: 100)), "validation_failed");
        await Refused(Arranged(new JsonObject { ["clothingId"] = ids[0].ToString(), ["x"] = 0.5, ["y"] = 0.5 }), "validation_failed");
        // A refused arrangement takes nothing else of the change with it.
        var mixed = Arranged(Placement(outside));
        mixed["saved"] = true;
        await Refused(mixed, "layout_invalid");

        Assert.Equivalent(Unsigned(before), Unsigned(await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()), strict: true);
    }

    private static JsonObject ArrangedOnFigure(params JsonObject[] placements) => new() { ["figureLayout"] = new JsonArray([.. placements]) };

    [Fact]
    public async Task The_figure_can_be_arranged_is_kept_with_the_outfit_and_goes_back_to_automatic()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        Assert.Null(outfit.FigureLayout);
        var (first, second) = (outfit.Items[0].Clothing.Id, outfit.Items[1].Clothing.Id);

        var arranged = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", ArrangedOnFigure(Placement(first, 0.25, 0.3, 0.4, 1), Placement(second, 1, 0, 0.05, 0)));

        Assert.Equal(HttpStatusCode.OK, arranged.StatusCode);
        OutfitPlacementResponse[] expected = [new(first, 0.25, 0.3, 0.4, 1), new(second, 1, 0, 0.05, 0)];
        Assert.Equal(expected, (await arranged.ReadAsync<OutfitResponse>()).FigureLayout);
        Assert.Equal(expected, (await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()).FigureLayout);
        Assert.Equal(expected, (await ListAsync(client)).Single(listed => listed.Id == outfit.Id).FigureLayout);

        // A change that does not name the figure layout leaves it alone.
        var kept = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["saved"] = true })).ReadAsync<OutfitResponse>();
        Assert.Equal(expected, kept.FigureLayout);

        // Null and an empty list both go back to the automatic placement.
        var cleared = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["figureLayout"] = null })).ReadAsync<OutfitResponse>();
        Assert.Null(cleared.FigureLayout);
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", ArrangedOnFigure(Placement(first)));
        var emptied = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", ArrangedOnFigure())).ReadAsync<OutfitResponse>();
        Assert.Null(emptied.FigureLayout);
        Assert.True(emptied.IsSaved);
    }

    [Fact]
    public async Task The_board_and_the_figure_are_arranged_independently()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var (first, second) = (outfit.Items[0].Clothing.Id, outfit.Items[1].Clothing.Id);
        var url = $"/api/outfits/{outfit.Id}";
        OutfitPlacementResponse[] board = [new(first, 0.2, 0.2, 0.3, 0)];
        OutfitPlacementResponse[] figure = [new(second, 0.7, 0.6, 0.2, 1)];

        await client.PatchJsonAsync(url, Arranged(Placement(first, 0.2, 0.2)));
        var both = await (await client.PatchJsonAsync(url, ArrangedOnFigure(Placement(second, 0.7, 0.6, 0.2, 1)))).ReadAsync<OutfitResponse>();
        Assert.Equal(board, both.Layout);
        Assert.Equal(figure, both.FigureLayout);

        var boardCleared = await (await client.PatchJsonAsync(url, new JsonObject { ["layout"] = null })).ReadAsync<OutfitResponse>();
        Assert.Null(boardCleared.Layout);
        Assert.Equal(figure, boardCleared.FigureLayout);

        await client.PatchJsonAsync(url, Arranged(Placement(first, 0.2, 0.2)));
        var figureCleared = await (await client.PatchJsonAsync(url, new JsonObject { ["figureLayout"] = null })).ReadAsync<OutfitResponse>();
        Assert.Equal(board, figureCleared.Layout);
        Assert.Null(figureCleared.FigureLayout);

        // Both can be named in one change.
        var together = new JsonObject
        {
            ["layout"] = new JsonArray(Placement(second, 0.4, 0.4)),
            ["figureLayout"] = new JsonArray(Placement(first, 0.5, 0.5)),
        };
        var set = await (await client.PatchJsonAsync(url, together)).ReadAsync<OutfitResponse>();
        Assert.Equal([new OutfitPlacementResponse(second, 0.4, 0.4, 0.3, 0)], set.Layout);
        Assert.Equal([new OutfitPlacementResponse(first, 0.5, 0.5, 0.3, 0)], set.FigureLayout);
    }

    [Fact]
    public async Task A_figure_arrangement_that_does_not_fit_the_outfit_or_the_figure_is_refused_and_changes_nothing()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers, Belt]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var ids = outfit.Items.Select(item => item.Clothing.Id).ToList();
        var outside = wardrobe.Select(item => item.Id).Except(ids).FirstOrDefault(Guid.NewGuid());
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", ArrangedOnFigure(Placement(ids[0], 0.2, 0.2)));
        var before = await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>();

        async Task Refused(JsonObject body, string code)
        {
            var response = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(code, await response.ProblemCodeAsync());
        }

        await Refused(ArrangedOnFigure(Placement(outside)), "layout_invalid");
        await Refused(ArrangedOnFigure(Placement(Guid.NewGuid())), "layout_invalid");
        await Refused(ArrangedOnFigure(Placement(ids[0]), Placement(ids[0], 0.7)), "layout_invalid");
        await Refused(ArrangedOnFigure([.. ids.Select(id => Placement(id)), Placement(ids[0])]), "layout_invalid");
        await Refused(ArrangedOnFigure(Placement(ids[0], x: 1.01)), "validation_failed");
        await Refused(ArrangedOnFigure(Placement(ids[0], scale: 1.5)), "validation_failed");
        await Refused(ArrangedOnFigure(Placement(ids[0], z: 100)), "validation_failed");
        // A refused figure arrangement takes nothing else of the change with it, the board included.
        var mixed = ArrangedOnFigure(Placement(outside));
        mixed["layout"] = new JsonArray(Placement(ids[0], 0.9, 0.9));
        mixed["saved"] = true;
        await Refused(mixed, "layout_invalid");

        Assert.Equivalent(Unsigned(before), Unsigned(await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()), strict: true);
    }

    [Fact]
    public async Task I_am_wearing_this_counts_once_a_day_on_the_outfit_and_on_each_of_its_garments()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var answer = await client.SuggestedAsync();
        var outfit = answer.Outfits[0];
        var today = PersonsDay("Europe/Warsaw");
        Assert.Equal(0, (await StatsAsync(client)).WornLast30Days);

        var response = await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var worn = await response.ReadAsync<OutfitResponse>();
        Assert.Equal(today, worn.WornOn);
        Assert.All(worn.Items, item => Assert.Equal((1, today), (item.Clothing.WearCount, item.Clothing.LastWornOn)));
        var ids = outfit.Items.Select(item => item.Clothing.Id).ToHashSet();
        var clothes = await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();
        Assert.All(clothes, garment => Assert.Equal(ids.Contains(garment.Id) ? 1 : 0, garment.WearCount));
        // The wardrobe's usage follows.
        Assert.Equal(new WardrobeStatsResponse(Total: wardrobe.Count, WornLast30Days: ids.Count, Forgotten: 0, Processing: 0, NeedsTags: 0), await StatsAsync(client));

        // Said again the same day, and said of another outfit that shares garments: every garment still counts once.
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true });
        var other = answer.Outfits[1];
        await client.PatchJsonAsync($"/api/outfits/{other.Id}", new JsonObject { ["worn"] = true });
        var both = ids.Union(other.Items.Select(item => item.Clothing.Id)).ToHashSet();
        clothes = await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>();
        Assert.All(clothes, garment => Assert.Equal(both.Contains(garment.Id) ? 1 : 0, garment.WearCount));
        Assert.Equal(both.Count, (await StatsAsync(client)).WornLast30Days);

        // The next day it counts again.
        factory.Clock.Advance(TimeSpan.FromDays(1));
        client = await factory.SignInAgainAsync(auth);
        var again = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true })).ReadAsync<OutfitResponse>();
        Assert.Equal(today.AddDays(1), again.WornOn);
        Assert.All(again.Items, item => Assert.Equal((2, today.AddDays(1)), (item.Clothing.WearCount, item.Clothing.LastWornOn)));
        Assert.Equal(both.Count, (await StatsAsync(client)).WornLast30Days);

        // Thirty days without wearing anything and the wardrobe counts as unused again.
        factory.Clock.Advance(TimeSpan.FromDays(30));
        client = await factory.SignInAgainAsync(auth);
        Assert.Equal(0, (await StatsAsync(client)).WornLast30Days);
    }

    [Fact]
    public async Task The_day_an_outfit_is_worn_on_is_the_day_where_the_person_is()
    {
        // A place where the calendar shows another date than in Greenwich at this very moment.
        var utc = factory.Clock.GetUtcNow();
        var (name, lat, lon, zoneId, shift) = utc.Hour >= 10
            ? ("Kiritimati", 1.9, -157.4, "Pacific/Kiritimati", 1)
            : ("Pago Pago", -14.3, -170.7, "Pacific/Pago_Pago", -1);
        factory.Ai.Reset();
        factory.Stylist.Reset();
        (factory.FreshWeather().Low, factory.Weather.High) = (Warm, Warm);
        var (client, _) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = name, ["lat"] = lat, ["lon"] = lon });
        await client.GiveConsentAsync();
        await factory.DressAsync(client, Tee, Jeans, Sneakers);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        var worn = await (await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true })).ReadAsync<OutfitResponse>();

        var there = PersonsDay(zoneId);
        Assert.Equal(DateOnly.FromDateTime(utc.UtcDateTime).AddDays(shift), there);
        Assert.Equal(there, worn.WornOn);
        Assert.All(worn.Items, item => Assert.Equal(there, item.Clothing.LastWornOn));
        Assert.Equal(name, worn.Weather!.Place);
        Assert.Equal(TimeZoneInfo.FindSystemTimeZoneById(zoneId).GetUtcOffset(utc), worn.Weather.From.Offset);
    }

    [Fact]
    public async Task A_deleted_outfit_is_gone_and_its_garments_stay()
    {
        var (client, _, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits;

        var response = await client.DeleteAsync($"/api/outfits/{outfits[0].Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/outfits/{outfits[0].Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/outfits/{outfits[0].Id}")).StatusCode);
        Assert.Equal(outfits.Skip(1).Select(outfit => outfit.Id), (await ListAsync(client)).Select(outfit => outfit.Id));
        Assert.Equal(wardrobe.Count, (await (await client.GetAsync("/api/clothes")).ReadAsync<List<ClothingResponse>>()).Count);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.OutfitItems.CountAsync(item => item.OutfitId == outfits[0].Id)));
    }

    [Fact]
    public async Task Somebody_elses_outfit_looks_as_if_it_did_not_exist()
    {
        var (owner, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await owner.SuggestedAsync()).Outfits[0];
        var (other, _) = await factory.SignedInAsync();

        var responses = new[]
        {
            await other.GetAsync($"/api/outfits/{outfit.Id}"),
            await other.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["saved"] = true, ["rating"] = "dislike", ["worn"] = true }),
            await other.DeleteAsync($"/api/outfits/{outfit.Id}"),
            await other.GetAsync($"/api/outfits/{Guid.NewGuid()}"),
            await other.PatchJsonAsync($"/api/outfits/{Guid.NewGuid()}", new JsonObject { ["saved"] = true }),
            await other.DeleteAsync($"/api/outfits/{Guid.NewGuid()}"),
        };

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await response.ProblemCodeAsync());
        }

        Assert.Empty(await ListAsync(other));
        Assert.Empty(await ListAsync(other, "?saved=true"));
        // Nothing of what the stranger tried reached the outfit or its garments.
        var read = await (await owner.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>();
        Assert.Equivalent(Unsigned(outfit), Unsigned(read), strict: true);
        Assert.All(read.Items, item => Assert.Equal(0, item.Clothing.WearCount));
    }

    [Fact]
    public async Task Deleting_a_garment_deletes_the_outfits_that_contain_it_and_no_others()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        factory.Stylist.Answers(request =>
        {
            string Alias(int index) => request.Case.Candidates.AliasOf(wardrobe[index].Id)!;
            return
            [
                new StylistOutfit(OutfitKind.SureBet, Alias(0), null, Alias(3), null, null, Alias(5), [], "With the white T-shirt.", null),
                new StylistOutfit(OutfitKind.NewPairing, Alias(1), null, Alias(4), null, null, Alias(6), [], "Without the white T-shirt.", null),
                new StylistOutfit(OutfitKind.NewPairing, Alias(0), Alias(2), Alias(4), null, Alias(7), Alias(6), [], "With the white T-shirt again.", null),
            ];
        });
        var outfits = (await client.SuggestedAsync()).Outfits;
        Assert.Equal(3, outfits.Count);
        var (stranger, _, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var theirs = (await stranger.SuggestedAsync()).Outfits[0];

        var response = await client.DeleteAsync($"/api/clothes/{wardrobe[0].Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var left = Assert.Single(await ListAsync(client));
        Assert.Equal("Without the white T-shirt.", left.Reasoning);
        Assert.Equal(3, left.Items.Count);
        Assert.All(outfits.Where(outfit => outfit.Id != left.Id), outfit => Assert.Equal(HttpStatusCode.NotFound, client.GetAsync($"/api/outfits/{outfit.Id}").Result.StatusCode));
        Assert.Equal(3, await factory.WithDatabaseAsync(db => db.OutfitItems.CountAsync(item => db.Outfits.Any(outfit => outfit.Id == item.OutfitId && outfit.UserId == auth.User.Id))));
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync($"/api/outfits/{theirs.Id}")).StatusCode);

        // And the stylist goes on working with what is left.
        factory.Stylist.Reset();
        Assert.All((await client.SuggestedAsync()).Outfits, outfit => Assert.DoesNotContain(wardrobe[0].Id, outfit.Items.Select(item => item.Clothing.Id)));
    }

    [Fact]
    public async Task Deleting_an_account_takes_its_outfits_with_it()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];

        // The account endpoint for this comes in a later stage; the database must already let go of everything.
        await factory.WithDatabaseAsync(db => db.Users.Where(user => user.Id == auth.User.Id).ExecuteDeleteAsync());

        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.Outfits.CountAsync(found => found.UserId == auth.User.Id)));
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.OutfitItems.CountAsync(item => item.OutfitId == outfit.Id)));
    }

    private DateOnly PersonsDay(string zoneId) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(factory.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(zoneId)).DateTime);

    private static async Task<List<OutfitResponse>> ListAsync(HttpClient client, string query = "") =>
        await (await client.GetAsync($"/api/outfits{query}")).ReadAsync<List<OutfitResponse>>();

    private static async Task<WardrobeStatsResponse> StatsAsync(HttpClient client) =>
        await (await client.GetAsync("/api/clothes/stats")).ReadAsync<WardrobeStatsResponse>();

    /// <summary>The outfit without the signed picture addresses, which are made afresh for every answer.</summary>
    private static OutfitResponse Unsigned(OutfitResponse outfit) =>
        outfit with { Items = [.. outfit.Items.Select(item => item with { Clothing = item.Clothing with { ImageUrl = null } })] };
}
