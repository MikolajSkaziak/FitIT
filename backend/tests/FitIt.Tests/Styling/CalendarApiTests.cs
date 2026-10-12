using System.Net;
using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Styling;
using FitIt.Infrastructure.Persistence;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Styling;

/// <summary>The calendar of outfits: planning a day ahead, saying what was worn, and looking back.</summary>
[Collection(ApiTests.Name)]
public sealed class CalendarApiTests(ApiFactory factory)
{
    [Fact]
    public async Task An_outfit_planned_for_a_day_ahead_stands_on_that_day_until_it_is_taken_off()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits;
        var today = factory.DayIn();
        var thursday = today.AddDays(3);

        var response = await client.PlanAsync(thursday, outfits[0].Id);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var entry = await response.ReadAsync<CalendarEntryResponse>();
        Assert.Equal($"/api/calendar/{entry.Id}", response.Headers.Location?.OriginalString);
        Assert.Equal((thursday, false, outfits[0].Id, factory.Clock.GetUtcNow()), (entry.Date, entry.Worn, entry.Outfit.Id, entry.CreatedAt));
        // What a tile needs comes with it: the garments with their pictures, and the outfit is not "worn" by being planned.
        Assert.Equal(outfits[0].Items.Select(item => item.Clothing.Id), entry.Outfit.Items.Select(item => item.Clothing.Id));
        Assert.All(entry.Outfit.Items, item => Assert.StartsWith("http", item.Clothing.ImageUrl, StringComparison.Ordinal));
        Assert.Null(entry.Outfit.WornOn);
        Assert.All(entry.Outfit.Items, item => Assert.Equal(0, item.Clothing.WearCount));

        // A second outfit on the same day, and the first one on another day too.
        var evening = await client.PlannedAsync(thursday, outfits[1].Id);
        var friday = await client.PlannedAsync(thursday.AddDays(1), outfits[0].Id);

        var calendar = await client.CalendarAsync(today, today.AddDays(13));
        Assert.Equal((today, today.AddDays(6), 3), (calendar.Today, calendar.ForecastUntil, calendar.MaxPerDay));
        // Only the days that hold something, in order, each with its entries in the order they were added.
        Assert.Equal([thursday, thursday.AddDays(1)], calendar.Days.Select(day => day.Date));
        Assert.Equal([entry.Id, evening.Id], calendar.Days[0].Entries.Select(found => found.Id));
        Assert.Equal([friday.Id], calendar.Days[1].Entries.Select(found => found.Id));
        Assert.All(calendar.Days.SelectMany(day => day.Entries), found => Assert.False(found.Worn));
        Assert.Equal([(entry.Id, thursday, false), (friday.Id, thursday.AddDays(1), false)],
            (await DaysOfAsync(client, outfits[0].Id)).Select(day => (day.Id, day.Date, day.Worn)));

        // A stretch that does not reach the day does not show it.
        Assert.Empty((await client.CalendarAsync(today, today.AddDays(2))).Days);
        Assert.Equal([thursday.AddDays(1)], (await client.CalendarAsync(thursday.AddDays(1), thursday.AddDays(1))).Days.Select(day => day.Date));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/calendar/{entry.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/calendar/{entry.Id}")).StatusCode);
        Assert.Equal([evening.Id, friday.Id], (await client.CalendarAsync(today, today.AddDays(13))).Days.SelectMany(day => day.Entries).Select(found => found.Id));
        // The outfit itself is untouched.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/outfits/{outfits[0].Id}")).StatusCode);

        var raw = await (await client.GetAsync($"/api/calendar?from={today.Iso()}&to={today.AddDays(13).Iso()}")).Content.ReadAsStringAsync();
        Assert.Contains($"\"date\":\"{thursday.Iso()}\"", raw, StringComparison.Ordinal);
        Assert.Contains($"\"today\":\"{today.Iso()}\"", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_same_outfit_on_the_same_day_again_is_the_entry_that_is_already_there()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var day = factory.DayIn().AddDays(2);

        var first = await client.PlanAsync(day, outfit.Id);
        var again = await client.PlanAsync(day, outfit.Id);
        var together = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => client.PlanAsync(day, outfit.Id)));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        var id = (await first.ReadAsync<CalendarEntryResponse>()).Id;
        Assert.Equal(id, (await again.ReadAsync<CalendarEntryResponse>()).Id);
        Assert.All(together, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.Equal(1, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(entry => entry.UserId == auth.User.Id)));
    }

    [Fact]
    public async Task A_day_holds_three_planned_outfits_and_no_more_however_many_arrive_at_once()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits.Concat((await client.SuggestedAsync("work")).Outfits).ToList();
        Assert.Equal(6, outfits.Count);
        var day = factory.DayIn().AddDays(1);

        var responses = await Task.WhenAll(outfits.Select(outfit => client.PlanAsync(day, outfit.Id)));

        Assert.Equal(3, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        var refused = responses.Where(response => response.StatusCode == HttpStatusCode.Conflict).ToList();
        Assert.Equal(3, refused.Count);
        Assert.Equal("calendar_day_full", await refused[0].ProblemCodeAsync());
        Assert.Equal(3, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(entry => entry.UserId == auth.User.Id && entry.Day == day)));

        // One that is already on the full day is still answered as itself; another day has room; and room comes back.
        var held = (await client.CalendarAsync(day, day)).Days[0].Entries;
        Assert.Equal(HttpStatusCode.OK, (await client.PlanAsync(day, held[0].Outfit.Id)).StatusCode);
        var free = outfits.First(outfit => held.All(entry => entry.Outfit.Id != outfit.Id));
        Assert.Equal(HttpStatusCode.Created, (await client.PlanAsync(day.AddDays(1), free.Id)).StatusCode);
        await client.DeleteAsync($"/api/calendar/{held[0].Id}");
        Assert.Equal(HttpStatusCode.Created, (await client.PlanAsync(day, free.Id)).StatusCode);
    }

    [Fact]
    public async Task A_day_that_has_passed_is_filled_in_as_worn_and_counts_on_the_outfit_and_its_garments()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits;
        var today = factory.DayIn();

        // Whatever "worn" says: a past day is history.
        var lastWeek = await client.PlannedAsync(today.AddDays(-7), outfits[0].Id, worn: false);
        var earlier = await client.PlannedAsync(today.AddDays(-20), outfits[0].Id);

        Assert.True(lastWeek.Worn);
        Assert.Equal(today.AddDays(-7), lastWeek.Outfit.WornOn);
        Assert.All(lastWeek.Outfit.Items, item => Assert.Equal((1, today.AddDays(-7)), (item.Clothing.WearCount, item.Clothing.LastWornOn)));
        // An older day does not move "last worn" back, and counts as one more wear.
        Assert.Equal(today.AddDays(-7), earlier.Outfit.WornOn);
        Assert.All(earlier.Outfit.Items, item => Assert.Equal((2, today.AddDays(-7)), (item.Clothing.WearCount, item.Clothing.LastWornOn)));

        // Another outfit on the same past day: the garments they share were worn once that day, not twice.
        var shared = outfits[0].Items.Select(item => item.Clothing.Id).Intersect(outfits[1].Items.Select(item => item.Clothing.Id)).ToHashSet();
        var other = await client.PlannedAsync(today.AddDays(-7), outfits[1].Id);
        Assert.All(other.Outfit.Items, item => Assert.Equal(shared.Contains(item.Clothing.Id) ? 2 : 1, item.Clothing.WearCount));

        // The same again changes nothing.
        var repeated = await client.PlannedAsync(today.AddDays(-7), outfits[0].Id);
        Assert.Equal(lastWeek.Id, repeated.Id);
        Assert.All(repeated.Outfit.Items, item => Assert.Equal(2, item.Clothing.WearCount));
    }

    [Fact]
    public async Task I_wore_this_confirms_a_planned_day_and_can_be_taken_back()
    {
        var (client, _, _) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var today = factory.DayIn();
        var old = await client.PlannedAsync(today.AddDays(-3), outfit.Id);
        var planned = await client.PlannedAsync(today, outfit.Id);
        Assert.False(planned.Worn);
        Assert.Equal(today.AddDays(-3), planned.Outfit.WornOn);

        var response = await client.PatchJsonAsync($"/api/calendar/{planned.Id}", new JsonObject { ["worn"] = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var worn = await response.ReadAsync<CalendarEntryResponse>();
        Assert.Equal((planned.Id, true, (DateOnly?)today), (worn.Id, worn.Worn, worn.Outfit.WornOn));
        Assert.All(worn.Outfit.Items, item => Assert.Equal((2, today), (item.Clothing.WearCount, item.Clothing.LastWornOn)));
        // Said twice, counted once.
        var again = await (await client.PatchJsonAsync($"/api/calendar/{planned.Id}", new JsonObject { ["worn"] = true })).ReadAsync<CalendarEntryResponse>();
        Assert.All(again.Outfit.Items, item => Assert.Equal(2, item.Clothing.WearCount));

        // Taken back: planned again, and the outfit was last worn on the day that is left.
        var back = await (await client.PatchJsonAsync($"/api/calendar/{planned.Id}", new JsonObject { ["worn"] = false })).ReadAsync<CalendarEntryResponse>();
        Assert.Equal((false, (DateOnly?)today.AddDays(-3)), (back.Worn, back.Outfit.WornOn));

        // Without its last worn day the outfit was never worn.
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/calendar/{old.Id}")).StatusCode);
        Assert.Null((await (await client.GetAsync($"/api/outfits/{outfit.Id}")).ReadAsync<OutfitResponse>()).WornOn);
        Assert.Equal([(planned.Id, false)], (await DaysOfAsync(client, outfit.Id)).Select(day => (day.Id, day.Worn)));
    }

    [Fact]
    public async Task A_planned_day_that_passes_stays_planned_until_the_person_says_they_wore_it()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var planned = await client.PlannedAsync(factory.DayIn().AddDays(1), outfit.Id);

        factory.Clock.Advance(TimeSpan.FromDays(3));
        client = await factory.SignInAgainAsync(auth);
        var today = factory.DayIn();

        var calendar = await client.CalendarAsync(today.AddDays(-7), today);
        var entry = Assert.Single(Assert.Single(calendar.Days).Entries);
        Assert.Equal((planned.Id, today.AddDays(-2), false), (entry.Id, entry.Date, entry.Worn));
        Assert.Null(entry.Outfit.WornOn);

        var confirmed = await (await client.PatchJsonAsync($"/api/calendar/{planned.Id}", new JsonObject { ["worn"] = true })).ReadAsync<CalendarEntryResponse>();
        Assert.Equal((true, (DateOnly?)today.AddDays(-2)), (confirmed.Worn, confirmed.Outfit.WornOn));
        Assert.All(confirmed.Outfit.Items, item => Assert.Equal((1, today.AddDays(-2)), (item.Clothing.WearCount, item.Clothing.LastWornOn)));
    }

    [Fact]
    public async Task Wear_this_today_writes_the_day_into_the_calendar_once()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits.Concat((await client.SuggestedAsync("work")).Outfits).ToList();
        var today = factory.DayIn();

        await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => client.PatchJsonAsync($"/api/outfits/{outfits[0].Id}", new JsonObject { ["worn"] = true })));

        var entry = Assert.Single(Assert.Single((await client.CalendarAsync(today, today)).Days).Entries);
        Assert.Equal((today, true, outfits[0].Id, (DateOnly?)today), (entry.Date, entry.Worn, entry.Outfit.Id, entry.Outfit.WornOn));
        Assert.All(entry.Outfit.Items, item => Assert.Equal(1, item.Clothing.WearCount));

        // An outfit planned for today becomes the worn one: the same entry, not a second one.
        var planned = await client.PlannedAsync(today, outfits[1].Id);
        await client.PatchJsonAsync($"/api/outfits/{outfits[1].Id}", new JsonObject { ["worn"] = true });
        var both = (await client.CalendarAsync(today, today)).Days[0].Entries;
        Assert.Equal([(entry.Id, true), (planned.Id, true)], both.Select(found => (found.Id, found.Worn)));

        // Wearing is a fact, so a day that is full of plans does not refuse it.
        await client.PlannedAsync(today, outfits[2].Id);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PlanAsync(today, outfits[3].Id)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PatchJsonAsync($"/api/outfits/{outfits[3].Id}", new JsonObject { ["worn"] = true })).StatusCode);
        Assert.Equal(4, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(found => found.UserId == auth.User.Id && found.Day == today)));

        // Today said worn through the calendar is the same thing as the button.
        var direct = await client.PlannedAsync(today.AddDays(-1), outfits[4].Id);
        var viaCalendar = await (await client.PatchJsonAsync($"/api/calendar/{(await client.CalendarAsync(today, today)).Days[0].Entries[2].Id}", new JsonObject { ["worn"] = true })).ReadAsync<CalendarEntryResponse>();
        Assert.Equal((true, (DateOnly?)today), (viaCalendar.Worn, viaCalendar.Outfit.WornOn));
        Assert.True(direct.Worn);
    }

    [Fact]
    public async Task A_day_ahead_cannot_be_worn_yet_and_a_day_too_far_away_cannot_be_kept()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var today = factory.DayIn();
        var tomorrow = await client.PlannedAsync(today.AddDays(1), outfit.Id);

        foreach (var (response, code) in new[]
                 {
                     (await client.PlanAsync(today.AddDays(2), outfit.Id, worn: true), "calendar_day_ahead"),
                     (await client.PatchJsonAsync($"/api/calendar/{tomorrow.Id}", new JsonObject { ["worn"] = true }), "calendar_day_ahead"),
                     (await client.PlanAsync(today.AddDays(366), outfit.Id), "calendar_date_invalid"),
                     (await client.PlanAsync(today.AddDays(-(5 * 365) - 1), outfit.Id), "calendar_date_invalid"),
                     (await client.PostJsonAsync("/api/calendar", new JsonObject { ["outfitId"] = outfit.Id.ToString() }), "validation_failed"),
                     (await client.PostJsonAsync("/api/calendar", new JsonObject { ["date"] = today.Iso() }), "validation_failed"),
                     (await client.PatchJsonAsync($"/api/calendar/{tomorrow.Id}", new JsonObject()), "validation_failed"),
                 })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(code, await response.ProblemCodeAsync());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostJsonAsync("/api/calendar", new JsonObject { ["date"] = "Thursday", ["outfitId"] = outfit.Id.ToString() })).StatusCode);
        var unknown = await client.PlanAsync(today, Guid.NewGuid());
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal("not_found", await unknown.ProblemCodeAsync());

        // The edges themselves are fine, and nothing above left a trace.
        Assert.Equal(HttpStatusCode.Created, (await client.PlanAsync(today.AddDays(365), outfit.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PlanAsync(today, outfit.Id, worn: true)).StatusCode);
        Assert.Equal(
            [(today, true), (today.AddDays(1), false), (today.AddDays(365), false)],
            await factory.WithDatabaseAsync(db => db.CalendarEntries.Where(entry => entry.UserId == auth.User.Id).OrderBy(entry => entry.Day).Select(entry => new ValueTuple<DateOnly, bool>(entry.Day, entry.Worn)).ToListAsync()));
    }

    [Fact]
    public async Task A_stretch_of_the_calendar_is_at_most_sixty_two_days_named_in_order()
    {
        var (client, _) = await factory.SignedInAsync();
        var today = factory.DayIn();

        foreach (var query in new[]
                 {
                     $"?from={today.Iso()}&to={today.AddDays(62).Iso()}",
                     $"?from={today.Iso()}&to={today.AddDays(-1).Iso()}",
                     $"?from={today.Iso()}",
                     $"?to={today.Iso()}",
                     "",
                 })
        {
            var response = await client.GetAsync($"/api/calendar{query}");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("calendar_range_invalid", await response.ProblemCodeAsync());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/calendar?from=October&to={today.Iso()}")).StatusCode);
        Assert.Empty((await client.CalendarAsync(today, today.AddDays(61))).Days);
        Assert.Empty((await client.CalendarAsync(today, today)).Days);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/calendar?from={today.Iso()}&to={today.Iso()}")).StatusCode);
    }

    [Fact]
    public async Task The_days_of_the_calendar_are_the_days_where_the_person_is()
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
        await factory.DressAsync(client, Tee, Jeans, Sneakers);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var there = factory.DayIn(zoneId);
        var greenwich = DateOnly.FromDateTime(utc.UtcDateTime);
        Assert.Equal(greenwich.AddDays(shift), there);

        // Greenwich's date is yesterday there (so it is history, worn) or tomorrow there (so it is a plan that cannot be worn yet).
        var entry = await client.PlannedAsync(greenwich, outfit.Id);
        var wornAtOnce = await client.PlanAsync(greenwich, outfit.Id, worn: true);

        Assert.Equal((greenwich, shift > 0), (entry.Date, entry.Worn));
        Assert.Equal(shift > 0 ? HttpStatusCode.OK : HttpStatusCode.BadRequest, wornAtOnce.StatusCode);
        var calendar = await client.CalendarAsync(there.AddDays(-1), there.AddDays(1));
        Assert.Equal((there, there.AddDays(6)), (calendar.Today, calendar.ForecastUntil));

        // Their own today is planned, can be worn, and is the day "Wear this today" writes.
        var own = await client.PlannedAsync(there, outfit.Id);
        Assert.False(own.Worn);
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new JsonObject { ["worn"] = true });
        var days = await DaysOfAsync(client, outfit.Id);
        Assert.Contains(days, day => day.Id == own.Id && day.Date == there && day.Worn);
        Assert.Equal(2, days.Count);

        // Midnight passes there: yesterday's plan can now be said worn although Greenwich has not changed its date twice.
        if (shift < 0)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PatchJsonAsync($"/api/calendar/{entry.Id}", new JsonObject { ["worn"] = true })).StatusCode);
        }
    }

    [Fact]
    public async Task Midnight_at_the_place_turns_tomorrows_plan_into_one_that_can_be_worn()
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        (factory.FreshWeather().Low, factory.Weather.High) = (Warm, Warm);
        var (client, auth) = await factory.SignedInAsync(body =>
            body["location"] = new JsonObject { ["source"] = "manual", ["name"] = "Tokio", ["lat"] = 35.6762, ["lon"] = 139.6503 });
        await factory.DressAsync(client, Tee, Jeans, Sneakers);
        var outfit = (await client.SuggestedAsync()).Outfits[0];
        var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
        var tomorrow = factory.DayIn("Asia/Tokyo").AddDays(1);
        var entry = await client.PlannedAsync(tomorrow, outfit.Id);

        // One minute before midnight in Tokyo, then one minute after it.
        var midnight = new DateTimeOffset(tomorrow.ToDateTime(TimeOnly.MinValue), tokyo.BaseUtcOffset);
        factory.Clock.SetUtcNow(midnight.AddMinutes(-1).ToUniversalTime());
        client = await factory.SignInAgainAsync(auth);
        var early = await client.PatchJsonAsync($"/api/calendar/{entry.Id}", new JsonObject { ["worn"] = true });
        factory.Clock.Advance(TimeSpan.FromMinutes(2));
        var onTheDay = await client.PatchJsonAsync($"/api/calendar/{entry.Id}", new JsonObject { ["worn"] = true });

        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);
        Assert.Equal("calendar_day_ahead", await early.ProblemCodeAsync());
        Assert.Equal(HttpStatusCode.OK, onTheDay.StatusCode);
        Assert.Equal((true, (DateOnly?)tomorrow), ((await onTheDay.ReadAsync<CalendarEntryResponse>()) is var worn ? (worn.Worn, worn.Outfit.WornOn) : default));
        Assert.Equal(tomorrow, (await client.CalendarAsync(tomorrow, tomorrow)).Today);
    }

    [Fact]
    public async Task A_deleted_outfit_a_deleted_garment_and_a_deleted_account_take_their_days_with_them()
    {
        var (client, auth, wardrobe) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits;
        var today = factory.DayIn();
        foreach (var outfit in outfits)
        {
            await client.PlannedAsync(today.AddDays(1), outfit.Id);
            await client.PlannedAsync(today.AddDays(-1), outfit.Id);
        }

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/outfits/{outfits[0].Id}")).StatusCode);

        var left = (await client.CalendarAsync(today.AddDays(-1), today.AddDays(1))).Days.SelectMany(day => day.Entries).ToList();
        Assert.Equal(4, left.Count);
        Assert.DoesNotContain(left, entry => entry.Outfit.Id == outfits[0].Id);
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(entry => entry.OutfitId == outfits[0].Id)));

        // A garment that goes takes the outfits it was in, and they take their days.
        var garment = outfits[1].Items[0].Clothing.Id;
        var gone = outfits.Skip(1).Where(outfit => outfit.Items.Any(item => item.Clothing.Id == garment)).Select(outfit => outfit.Id).ToList();
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/clothes/{garment}")).StatusCode);
        var after = (await client.CalendarAsync(today.AddDays(-1), today.AddDays(1))).Days.SelectMany(day => day.Entries).ToList();
        Assert.Equal(2 * (2 - gone.Count), after.Count);
        Assert.DoesNotContain(after, entry => gone.Contains(entry.Outfit.Id));
        Assert.NotEmpty(wardrobe);

        var (other, otherAuth, _) = await factory.DressedAsync(Warm, [Tee, Jeans, Sneakers]);
        await other.PlannedAsync(factory.DayIn(), (await other.SuggestedAsync()).Outfits[0].Id);
        await factory.WithDatabaseAsync(db => db.Users.Where(user => user.Id == otherAuth.User.Id).ExecuteDeleteAsync());
        Assert.Equal(0, await factory.WithDatabaseAsync(db => db.CalendarEntries.CountAsync(entry => entry.UserId == otherAuth.User.Id)));
        Assert.True(await factory.WithDatabaseAsync(db => db.Users.AnyAsync(user => user.Id == auth.User.Id)));
    }

    [Fact]
    public async Task The_migration_gives_every_outfit_that_was_worn_one_worn_day_and_the_others_none()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        var outfits = (await client.SuggestedAsync()).Outfits;
        var today = factory.DayIn();
        await client.PatchJsonAsync($"/api/outfits/{outfits[0].Id}", new JsonObject { ["worn"] = true });
        await client.PlannedAsync(today.AddDays(-9), outfits[1].Id);
        await client.PlannedAsync(today.AddDays(2), outfits[2].Id);

        // Back to the schema before the calendar, where an outfit knew only its last worn day, and forward again.
        await factory.WithDatabaseAsync(async db =>
        {
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("AiLabelsAndReports");
            Assert.DoesNotContain("20261011150414_OutfitCalendar", await db.Database.GetAppliedMigrationsAsync());
            await migrator.MigrateAsync();
            return 0;
        });

        var entries = await factory.WithDatabaseAsync(db => db.CalendarEntries.AsNoTracking().Where(entry => entry.UserId == auth.User.Id).OrderBy(entry => entry.Day).ToListAsync());
        Assert.Equal(
            [(outfits[1].Id, today.AddDays(-9), true), (outfits[0].Id, today, true)],
            entries.Select(entry => (entry.OutfitId, entry.Day, entry.Worn)));
        // The plan was not history and is gone with the table; the outfits keep what they knew.
        var calendar = await client.CalendarAsync(today.AddDays(-30), today.AddDays(30));
        Assert.Equal([today.AddDays(-9), today], calendar.Days.Select(day => day.Date));
        Assert.Equal((DateOnly?)today, (await (await client.GetAsync($"/api/outfits/{outfits[0].Id}")).ReadAsync<OutfitResponse>()).WornOn);
        Assert.Null((await (await client.GetAsync($"/api/outfits/{outfits[2].Id}")).ReadAsync<OutfitResponse>()).WornOn);
        // The calendar works on as before.
        Assert.Equal(HttpStatusCode.Created, (await client.PlanAsync(today.AddDays(2), outfits[2].Id)).StatusCode);
        Assert.Equal(CalendarEntry.MaxPerDay, calendar.MaxPerDay);
    }

    private static async Task<List<OutfitDayResponse>> DaysOfAsync(HttpClient client, Guid outfitId)
    {
        var response = await client.GetAsync($"/api/outfits/{outfitId}/days");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<List<OutfitDayResponse>>();
    }
}
