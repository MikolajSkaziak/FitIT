using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Infrastructure.Accounts;

namespace FitIt.Tests.Core;

public sealed class AccountRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 6);

    [Theory]
    [InlineData("2010-10-06", true)]   // sixteenth birthday is today
    [InlineData("2010-10-07", false)]  // one day short
    [InlineData("2010-10-05", true)]
    [InlineData("1990-01-01", true)]
    [InlineData("2026-10-07", false)]  // not born yet
    public void Age_rule_counts_whole_years_up_to_today(string birthDate, bool expected)
    {
        Assert.Equal(expected, AgeRule.IsOldEnough(DateOnly.Parse(birthDate, System.Globalization.CultureInfo.InvariantCulture), Today, 16));
    }

    [Fact]
    public void Age_rule_treats_a_leap_day_birthday_as_reached_on_the_last_day_of_february()
    {
        var bornOnLeapDay = new DateOnly(2008, 2, 29);

        Assert.False(AgeRule.IsOldEnough(bornOnLeapDay, new DateOnly(2024, 2, 27), 16));
        Assert.True(AgeRule.IsOldEnough(bornOnLeapDay, new DateOnly(2024, 2, 29), 16));
        Assert.True(AgeRule.IsOldEnough(bornOnLeapDay, new DateOnly(2026, 2, 28), 18));
    }

    [Theory]
    [InlineData(50.2945, 50.3)]
    [InlineData(50.25, 50.3)]
    [InlineData(-0.05, -0.1)]
    [InlineData(18.6714, 18.7)]
    [InlineData(18.64, 18.6)]
    public void Coordinates_are_rounded_to_one_decimal_away_from_zero(double input, double expected)
    {
        Assert.Equal(expected, WeatherPlace.RoundCoordinate(input));
    }

    [Theory]
    [InlineData(90.0, 180.0, true)]
    [InlineData(-90.0, -180.0, true)]
    [InlineData(90.1, 0.0, false)]
    [InlineData(0.0, 180.1, false)]
    [InlineData(double.NaN, 0.0, false)]
    public void Coordinates_outside_the_globe_are_invalid(double lat, double lon, bool expected)
    {
        Assert.Equal(expected, WeatherPlace.IsValid(lat, lon));
    }

    [Fact]
    public void Enum_codes_are_lower_snake_case_and_round_trip()
    {
        Assert.Equal("runs_cold", EnumCodes.ToCode(ThermalPreference.RunsCold));
        Assert.Equal(ThermalPreference.RunsWarm, EnumCodes.Parse<ThermalPreference>("runs_warm"));
        Assert.False(EnumCodes.TryParse<Gender>("Female", out _));
        Assert.False(EnumCodes.TryParse<Gender>(null, out _));
        Assert.Equal(["female", "male", "non_binary", "unspecified"], EnumCodes.All<Gender>());
        Assert.Equal(Gender.NonBinary, EnumCodes.Parse<Gender>("non_binary"));
        Assert.Equal(Gender.Unspecified, EnumCodes.Parse<Gender>("unspecified"));
    }

    [Fact]
    public void Refresh_tokens_are_long_random_and_hash_to_fixed_hex()
    {
        var first = TokenService.NewRefreshToken();
        var second = TokenService.NewRefreshToken();

        Assert.NotEqual(first, second);
        Assert.Equal(43, first.Length);
        Assert.Equal(TokenService.Hash(first), TokenService.Hash(first));
        Assert.Matches("^[0-9a-f]{64}$", TokenService.Hash(first));
    }
}
