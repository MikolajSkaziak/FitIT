using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;

namespace FitIt.Tests.Weather;

public sealed class WeatherProfileTests
{
    private static readonly TimeSpan Tokyo = TimeSpan.FromHours(9);

    private static readonly WeatherRules Rules = new();

    /// <summary>Ten in the morning in Tokyo.</summary>
    private static readonly DateTimeOffset Morning = new(2026, 10, 6, 10, 0, 0, Tokyo);

    [Theory]
    [InlineData(31, TemperatureBand.Hot)]
    [InlineData(25, TemperatureBand.Hot)]
    [InlineData(24.9, TemperatureBand.Warm)]
    [InlineData(18, TemperatureBand.Warm)]
    [InlineData(17.9, TemperatureBand.Mild)]
    [InlineData(11, TemperatureBand.Mild)]
    [InlineData(10.9, TemperatureBand.Cold)]
    [InlineData(3, TemperatureBand.Cold)]
    [InlineData(2.9, TemperatureBand.Freezing)]
    [InlineData(-14, TemperatureBand.Freezing)]
    public void The_coldest_hour_decides_the_band(double feelsMin, TemperatureBand band)
    {
        var profile = Build(Day(hour => new Reading(hour == 12 ? feelsMin : feelsMin + 2)));

        Assert.Equal(feelsMin, profile.FeelsMin);
        Assert.Equal(feelsMin, profile.Reference);
        Assert.Equal(band, profile.Band);
        Assert.Same(BandRule.For(band), profile.Rule);
    }

    [Theory]
    [InlineData(ThermalPreference.RunsCold, 13.9, 10.9, TemperatureBand.Cold)]
    [InlineData(ThermalPreference.RunsCold, 14, 11, TemperatureBand.Mild)]
    [InlineData(ThermalPreference.Normal, 14, 14, TemperatureBand.Mild)]
    [InlineData(ThermalPreference.RunsWarm, 14.9, 17.9, TemperatureBand.Mild)]
    [InlineData(ThermalPreference.RunsWarm, 15, 18, TemperatureBand.Warm)]
    public void Somebody_who_feels_cold_or_warm_moves_the_reference_by_three_degrees(ThermalPreference thermal, double feelsMin, double reference, TemperatureBand band)
    {
        var profile = Build(Day(_ => new Reading(feelsMin)), thermal: thermal);

        Assert.Equal(feelsMin, profile.FeelsMin);
        Assert.Equal(reference, profile.Reference, 6);
        Assert.Equal(band, profile.Band);
    }

    [Fact]
    public void The_thresholds_come_from_configuration()
    {
        var rules = new WeatherRules { HotFrom = 30, ThermalShift = 5, RainProbability = 80, LayersAmplitude = 3, DayEndHour = 21 };
        var forecast = Day(hour => new Reading(hour < 14 ? 26 : 29, RainProbability: 70));

        var profile = WeatherProfile.Build(forecast, new DateTimeOffset(2026, 10, 6, 10, 0, 0, Tokyo), ThermalPreference.RunsWarm, rules)!;

        Assert.False(profile.ForTomorrow);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 10, 0, 0, Tokyo), profile.From);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 21, 0, 0, Tokyo), profile.To);
        Assert.Equal(31, profile.Reference);
        Assert.Equal(TemperatureBand.Hot, profile.Band);
        Assert.False(profile.Rain);
        Assert.True(profile.NeedsLayers);
        Assert.True(rules.AreConsistent());
    }

    [Theory]
    [InlineData(25, 18, 11, 3, true)]
    [InlineData(18, 18, 11, 3, false)]
    [InlineData(25, 18, 11, 11, false)]
    [InlineData(25, 10, 11, 3, false)]
    public void Bands_that_do_not_descend_are_refused_at_startup(double hot, double warm, double mild, double cold, bool consistent)
    {
        Assert.Equal(consistent, new WeatherRules { HotFrom = hot, WarmFrom = warm, MildFrom = mild, ColdFrom = cold }.AreConsistent());
    }

    [Fact]
    public void Hours_that_do_not_describe_one_day_are_refused_at_startup()
    {
        Assert.False(new WeatherRules { DayEndHour = 0 }.AreConsistent());
        Assert.False(new WeatherRules { DayEndHour = 24 }.AreConsistent());
        Assert.False(new WeatherRules { LayersAmplitude = 0 }.AreConsistent());
        Assert.False(new WeatherRules { ThermalShift = -1 }.AreConsistent());
    }

    [Theory]
    [InlineData(0, 30, 0, 22)]
    [InlineData(10, 0, 10, 22)]
    [InlineData(10, 59, 10, 22)]
    [InlineData(19, 59, 19, 22)]
    [InlineData(21, 30, 21, 22)]
    public void During_the_day_the_window_runs_from_the_current_hour_until_ten_in_the_evening(int hour, int minute, int fromHour, int toHour)
    {
        var profile = Build(Day(at => new Reading(at)), new DateTimeOffset(2026, 10, 6, hour, minute, 0, Tokyo));

        Assert.False(profile.ForTomorrow);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, fromHour, 0, 0, Tokyo), profile.From);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, toHour, 0, 0, Tokyo), profile.To);
        // The readings equal the hour of the day, so the extremes show which hours were looked at.
        Assert.Equal(fromHour, profile.FeelsMin);
        Assert.Equal(toHour, profile.FeelsMax);
        Assert.Equal(profile.From, profile.ColdestAt);
        Assert.Equal(profile.To, profile.WarmestAt);
    }

    [Theory]
    [InlineData(22, 0, 22)]
    [InlineData(23, 59, 23)]
    public void Late_in_the_evening_the_window_is_what_is_left_of_today_never_tomorrow(int hour, int minute, int fromHour)
    {
        var profile = Build(Day(at => new Reading(at)), new DateTimeOffset(2026, 10, 6, hour, minute, 0, Tokyo));

        Assert.False(profile.ForTomorrow);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, fromHour, 0, 0, Tokyo), profile.From);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 23, 0, 0, Tokyo), profile.To);
        Assert.Equal(fromHour, profile.FeelsMin);
        Assert.Equal(23, profile.FeelsMax);
    }

    [Fact]
    public void The_window_is_read_on_the_clock_of_the_place_not_of_the_server()
    {
        // 23:30 in Greenwich on the 5th is 08:30 in Tokyo on the 6th: a morning there, not a late evening.
        var profile = Build(Day(at => new Reading(at)), new DateTimeOffset(2026, 10, 5, 23, 30, 0, TimeSpan.Zero));

        Assert.False(profile.ForTomorrow);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 8, 0, 0, Tokyo), profile.From);
        Assert.Equal(Tokyo, profile.From.Offset);
        Assert.Equal(8, profile.FeelsMin);
    }

    [Theory]
    [InlineData(49, 0, false)]
    [InlineData(50, 0, true)]
    [InlineData(100, 0, true)]
    // Thirteen hours in the window: the millimetres add up.
    [InlineData(10, 0.07, false)]
    [InlineData(10, 0.08, true)]
    public void A_day_is_rainy_by_the_highest_chance_or_by_the_total_rainfall(int probability, double mmPerHour, bool rain)
    {
        var profile = Build(Day(_ => new Reading(15, probability, mmPerHour)));

        Assert.Equal(rain, profile.Rain);
        Assert.Equal(probability, profile.RainProbability);
        Assert.Equal(Math.Round(13 * mmPerHour, 1), profile.RainMm);
        Assert.Equal(rain ? Sky.Rain : Sky.CloudSun, profile.Sky);
        Assert.Equal(rain ? profile.From : null, profile.RainFrom);
    }

    [Fact]
    public void Rain_starts_at_the_first_hour_that_is_likely_wet_or_has_any_rainfall()
    {
        var byChance = Build(Day(hour => new Reading(15, hour >= 16 ? 70 : 20)));
        var byAmount = Build(Day(hour => new Reading(15, 20, hour is 14 or 15 ? 0.6 : 0)));
        var dry = Build(Day(hour => new Reading(15, 20, hour == 14 ? 0.4 : 0)));

        Assert.Equal(new DateTimeOffset(2026, 10, 6, 16, 0, 0, Tokyo), byChance.RainFrom);
        Assert.Equal(70, byChance.RainProbability);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 14, 0, 0, Tokyo), byAmount.RainFrom);
        Assert.Equal(1.2, byAmount.RainMm);
        Assert.False(dry.Rain);
        Assert.Null(dry.RainFrom);
    }

    [Fact]
    public void Rain_outside_the_window_does_not_count()
    {
        var profile = Build(Day(hour => new Reading(15, hour < 10 || hour > 22 ? 90 : 5, hour < 10 ? 3 : 0)));

        Assert.False(profile.Rain);
        Assert.Equal(5, profile.RainProbability);
        Assert.Equal(0, profile.RainMm);
    }

    [Theory]
    [InlineData(10, 17.9, false)]
    [InlineData(10, 18, true)]
    [InlineData(-4, 9, true)]
    public void A_swing_of_eight_degrees_asks_for_layers(double low, double high, bool layers)
    {
        var profile = Build(Day(hour => new Reading(hour == 15 ? high : low)));

        Assert.Equal(low, profile.FeelsMin);
        Assert.Equal(high, profile.FeelsMax);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 15, 0, 0, Tokyo), profile.WarmestAt);
        Assert.Equal(layers, profile.NeedsLayers);
    }

    [Theory]
    [InlineData(0, Sky.Sun)]
    [InlineData(1, Sky.CloudSun)]
    [InlineData(2, Sky.CloudSun)]
    [InlineData(3, Sky.Cloud)]
    [InlineData(45, Sky.Cloud)]
    [InlineData(71, Sky.Snow)]
    [InlineData(77, Sky.Snow)]
    [InlineData(85, Sky.Snow)]
    [InlineData(86, Sky.Snow)]
    public void The_sky_is_the_kind_most_hours_have(int code, Sky sky)
    {
        // Seven hours of the code under test against six clear ones (or six overcast ones when the code itself is clear).
        var other = code == 0 ? 3 : 0;
        var profile = Build(Day(hour => new Reading(15, Code: hour <= 16 ? code : other)));

        Assert.Equal(sky, profile.Sky);
    }

    [Fact]
    public void Snow_wins_over_rain_rain_over_clouds_and_a_tie_goes_to_the_cloudier_sky()
    {
        var snowAndRain = Build(Day(hour => new Reading(1, 90, 1, hour == 12 ? 73 : 61)));
        var rainAndSun = Build(Day(hour => new Reading(15, hour == 12 ? 80 : 0)));
        // The window is 10:00 to 21:00 here: six clear hours, six overcast.
        var tie = Build(Day(hour => new Reading(15, Code: hour < 16 ? 0 : 3)), to: 21);
        var sunnyTie = Build(Day(hour => new Reading(15, Code: hour < 16 ? 0 : 1)), to: 21);

        Assert.Equal(Sky.Snow, snowAndRain.Sky);
        Assert.Equal(Sky.Rain, rainAndSun.Sky);
        Assert.Equal(Sky.Cloud, tie.Sky);
        Assert.Equal(Sky.CloudSun, sunnyTie.Sky);
    }

    [Fact]
    public void Without_hours_in_the_window_there_is_no_profile()
    {
        Assert.Null(WeatherProfile.Build(new Forecast("Asia/Tokyo", []), Morning, ThermalPreference.Normal, Rules));

        // A forecast that ends before the window begins.
        var stale = new Forecast("Asia/Tokyo", [.. Day(_ => new Reading(15)).Hours.Take(10)]);
        Assert.Null(WeatherProfile.Build(stale, Morning, ThermalPreference.Normal, Rules));
        Assert.Null(WeatherProfile.Build(Day(_ => new Reading(15)), Morning.AddDays(3), ThermalPreference.Normal, Rules));
    }

    [Fact]
    public void Hours_given_out_of_order_are_read_in_order()
    {
        var shuffled = new Forecast("Asia/Tokyo", [.. Day(hour => new Reading(hour, hour >= 18 ? 60 : 0)).Hours.Reverse()]);

        var profile = Build(shuffled);

        Assert.Equal(new DateTimeOffset(2026, 10, 6, 18, 0, 0, Tokyo), profile.RainFrom);
        Assert.Equal(10, profile.FeelsMin);
    }

    // The table of product spec 6.2, row by row: (category, type, warmth) and whether the band shuts it out.
    [Theory]
    [InlineData(TemperatureBand.Hot, Category.Outerwear, Subcategory.DenimJacket, 2, true)]
    [InlineData(TemperatureBand.Hot, Category.Top, Subcategory.TShirt, 3, false)]
    [InlineData(TemperatureBand.Hot, Category.Top, Subcategory.Turtleneck, 4, true)]
    [InlineData(TemperatureBand.Hot, Category.MidLayer, Subcategory.Sweater, 5, true)]
    [InlineData(TemperatureBand.Hot, Category.Bottom, Subcategory.Shorts, 1, false)]
    [InlineData(TemperatureBand.Hot, Category.Shoes, Subcategory.Sandals, 1, false)]
    [InlineData(TemperatureBand.Hot, Category.Shoes, Subcategory.FlipFlops, 1, false)]
    [InlineData(TemperatureBand.Warm, Category.Outerwear, Subcategory.DenimJacket, 2, false)]
    [InlineData(TemperatureBand.Warm, Category.MidLayer, Subcategory.Sweater, 4, false)]
    [InlineData(TemperatureBand.Warm, Category.Outerwear, Subcategory.DownJacket, 5, true)]
    [InlineData(TemperatureBand.Warm, Category.Bottom, Subcategory.Shorts, 1, false)]
    [InlineData(TemperatureBand.Warm, Category.Shoes, Subcategory.Sandals, 1, false)]
    [InlineData(TemperatureBand.Mild, Category.Shoes, Subcategory.Sandals, 1, true)]
    [InlineData(TemperatureBand.Mild, Category.Shoes, Subcategory.FlipFlops, 1, true)]
    [InlineData(TemperatureBand.Mild, Category.Shoes, Subcategory.Sneakers, 1, false)]
    [InlineData(TemperatureBand.Mild, Category.Bottom, Subcategory.Shorts, 1, false)]
    [InlineData(TemperatureBand.Mild, Category.Outerwear, Subcategory.Coat, 4, false)]
    [InlineData(TemperatureBand.Mild, Category.Outerwear, Subcategory.DownJacket, 5, true)]
    [InlineData(TemperatureBand.Cold, Category.Bottom, Subcategory.Shorts, 1, true)]
    [InlineData(TemperatureBand.Cold, Category.Bottom, Subcategory.Skirt, 1, false)]
    [InlineData(TemperatureBand.Cold, Category.Shoes, Subcategory.Sandals, 2, true)]
    [InlineData(TemperatureBand.Cold, Category.Shoes, Subcategory.FlipFlops, 1, true)]
    [InlineData(TemperatureBand.Cold, Category.Shoes, Subcategory.Sneakers, 1, false)]
    [InlineData(TemperatureBand.Cold, Category.Outerwear, Subcategory.DownJacket, 5, false)]
    [InlineData(TemperatureBand.Freezing, Category.Bottom, Subcategory.Shorts, 3, true)]
    [InlineData(TemperatureBand.Freezing, Category.Shoes, Subcategory.Sandals, 3, true)]
    [InlineData(TemperatureBand.Freezing, Category.Shoes, Subcategory.Sneakers, 1, true)]
    [InlineData(TemperatureBand.Freezing, Category.Shoes, Subcategory.Sneakers, 2, false)]
    [InlineData(TemperatureBand.Freezing, Category.Shoes, Subcategory.WinterBoots, 5, false)]
    [InlineData(TemperatureBand.Freezing, Category.Top, Subcategory.TShirt, 1, false)]
    public void Each_band_shuts_out_what_the_table_says(TemperatureBand band, Category category, Subcategory type, int warmth, bool excluded)
    {
        Assert.Equal(excluded, BandRule.For(band).Excludes(Garment(category, type, warmth)));
    }

    [Theory]
    [InlineData(TemperatureBand.Hot, 1, 2, false, null, false, false)]
    [InlineData(TemperatureBand.Warm, 1, 3, false, null, false, false)]
    [InlineData(TemperatureBand.Mild, 4, 6, true, null, false, true)]
    [InlineData(TemperatureBand.Cold, 6, 9, false, 3, false, true)]
    [InlineData(TemperatureBand.Freezing, 9, 13, false, 4, true, true)]
    public void Each_band_asks_for_what_the_table_says(TemperatureBand band, int sumMin, int sumMax, bool layer, int? outerwearWarmth, bool midLayer, bool closedShoes)
    {
        var rule = BandRule.For(band);

        Assert.Equal((sumMin, sumMax), (rule.WarmthSumMin, rule.WarmthSumMax));
        Assert.Equal(layer, rule.NeedsLayer);
        Assert.Equal(outerwearWarmth, rule.OuterwearMinWarmth);
        Assert.Equal(outerwearWarmth is not null, rule.NeedsOuterwear);
        Assert.Equal(midLayer, rule.NeedsMidLayer);
        Assert.Equal(closedShoes, rule.ClosedShoes);
    }

    [Fact]
    public void The_warmth_tolerance_gives_way_by_one_point_and_never_on_the_type_of_garment()
    {
        var hot = BandRule.For(TemperatureBand.Hot);
        var freezing = BandRule.For(TemperatureBand.Freezing);

        Assert.True(hot.Excludes(Garment(Category.Top, Subcategory.Turtleneck, 4)));
        Assert.False(hot.Excludes(Garment(Category.Top, Subcategory.Turtleneck, 4), warmthTolerance: 1));
        Assert.True(hot.Excludes(Garment(Category.Top, Subcategory.Turtleneck, 5), warmthTolerance: 1));
        Assert.True(freezing.Excludes(Garment(Category.Shoes, Subcategory.Sneakers, 1)));
        Assert.False(freezing.Excludes(Garment(Category.Shoes, Subcategory.Sneakers, 1), warmthTolerance: 1));

        Assert.True(hot.Excludes(Garment(Category.Outerwear, Subcategory.DenimJacket, 1), warmthTolerance: 1));
        Assert.True(freezing.Excludes(Garment(Category.Bottom, Subcategory.Shorts, 3), warmthTolerance: 1));
        Assert.True(freezing.Excludes(Garment(Category.Shoes, Subcategory.Sandals, 3), warmthTolerance: 1));
    }

    [Fact]
    public void Accessories_are_never_shut_out_by_the_weather()
    {
        Assert.All(Enum.GetValues<TemperatureBand>(), band =>
        {
            Assert.False(BandRule.For(band).Excludes(Garment(Category.Accessory, Subcategory.Scarf, 5)));
            Assert.False(BandRule.For(band).Excludes(Garment(Category.Accessory, Subcategory.Sunglasses, 1)));
        });
    }

    [Theory]
    // Noon: eleven hours to the evening, four of them spread evenly, the current one first and the last one at the end.
    [InlineData(12, new[] { 12, 15, 19, 22 })]
    [InlineData(8, new[] { 8, 13, 17, 22 })]
    [InlineData(19, new[] { 19, 20, 21, 22 })]
    // Fewer than four hours left: what there is.
    [InlineData(20, new[] { 20, 21, 22 })]
    [InlineData(21, new[] { 21, 22 })]
    // After the usual end of the day the window runs to eleven at night.
    [InlineData(22, new[] { 22, 23 })]
    [InlineData(23, new[] { 23 })]
    public void The_hours_shown_run_from_now_to_the_end_of_todays_window(int now, int[] hours)
    {
        var slots = WeatherProfile.Slots(Day(hour => new Reading(hour)), new DateTimeOffset(2026, 10, 6, now, 40, 0, Tokyo), Rules);

        Assert.Equal(hours, slots.Select(slot => slot.Time.Hour));
        Assert.All(slots, slot => Assert.Equal((new DateOnly(2026, 10, 6), Tokyo, (double)slot.Time.Hour), (DateOnly.FromDateTime(slot.Time.Date), slot.Time.Offset, slot.FeelsLike)));
    }

    [Fact]
    public void Every_hour_shown_has_its_own_sky()
    {
        var forecast = Day(hour => hour switch
        {
            12 => new Reading(14, Code: 0),
            15 => new Reading(13, RainProbability: Rules.RainProbability, Code: 61),
            19 => new Reading(12, RainMm: 0.2, Code: 3),
            _ => new Reading(1, RainProbability: 20, Code: 73),
        });

        var slots = WeatherProfile.Slots(forecast, new DateTimeOffset(2026, 10, 6, 12, 0, 0, Tokyo), Rules);

        Assert.Equal([Sky.Sun, Sky.Rain, Sky.Rain, Sky.Snow], slots.Select(slot => slot.Sky));
        Assert.Equal([14d, 13d, 12d, 1d], slots.Select(slot => slot.FeelsLike));
    }

    [Fact]
    public void A_forecast_without_hours_in_the_window_shows_none()
    {
        Assert.Empty(WeatherProfile.Slots(new Forecast("Asia/Tokyo", []), Morning, Rules));
        Assert.Empty(WeatherProfile.Slots(Day(_ => new Reading(10)), Morning.AddDays(5), Rules));
    }

    private static GarmentTags Garment(Category category, Subcategory type, int warmth) =>
        new(category, type, "Rzecz", [Color.Black], Pattern.Plain, Material.Cotton, 2, warmth, false, []);

    private sealed record Reading(double Feels, int RainProbability = 0, double RainMm = 0, int Code = 2);

    /// <summary>Three days of hours in Tokyo from midnight of 6 October; every day repeats the same readings by hour of day.</summary>
    private static Forecast Day(Func<int, Reading> at) => new("Asia/Tokyo",
    [
        .. Enumerable.Range(0, 72).Select(index =>
        {
            var reading = at(index % 24);
            return new ForecastHour(new DateTimeOffset(2026, 10, 6, 0, 0, 0, Tokyo).AddHours(index), reading.Feels - 1, reading.Feels, reading.RainProbability, reading.RainMm, reading.Code);
        }),
    ]);

    private static WeatherProfile Build(Forecast forecast, DateTimeOffset? now = null, ThermalPreference thermal = ThermalPreference.Normal, int to = 22)
    {
        var profile = WeatherProfile.Build(forecast, now ?? Morning, thermal, new WeatherRules { DayEndHour = to });
        Assert.NotNull(profile);
        return profile;
    }
}
