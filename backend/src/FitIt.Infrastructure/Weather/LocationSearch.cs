using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Weather;

/// <summary>Place search through the Open-Meteo geocoding API. Needs no key.</summary>
public sealed class OpenMeteoLocationSearch(HttpClient http, ILogger<OpenMeteoLocationSearch> logger) : ILocationSearch
{
    public const string BaseAddress = "https://geocoding-api.open-meteo.com/";

    /// <summary>More are asked for than shown: the provider orders by how well the name matches, not by how likely the place is meant.</summary>
    private const int Asked = 20;

    private const int Shown = 8;

    private static readonly ApiError Unavailable = new(503, "location_search_unavailable", "Place search is not answering. Try again in a moment.");

    public async Task<Result<IReadOnlyList<PlaceMatch>>> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var url = string.Create(CultureInfo.InvariantCulture, $"v1/search?name={Uri.EscapeDataString(query.Trim())}&count={Asked}&language=en&format=json");
        try
        {
            var response = await http.GetFromJsonAsync<Response>(url, cancellationToken);
            IReadOnlyList<PlaceMatch> found = [.. Rank(response?.Results ?? [])];
            return Result.Ok(found);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                throw;
            }

            logger.LogWarning(exception, "Place search failed");
            return Unavailable;
        }
    }

    /// <summary>
    /// Keeps towns and cities (no airports or mountains), puts bigger ones before smaller, and drops entries a person
    /// could not tell apart. No country is preferred: the app is used worldwide. Ties keep the provider's order.
    /// </summary>
    private static IEnumerable<PlaceMatch> Rank(IEnumerable<Item> items) => items
        .Where(item => item.FeatureCode is null || item.FeatureCode.StartsWith("PPL", StringComparison.Ordinal))
        .OrderByDescending(item => item.Population ?? 0)
        .Select(item => new PlaceMatch(item.Name, item.Admin1, item.Country, item.Latitude, item.Longitude))
        .DistinctBy(place => (place.Name, place.Region, place.Country))
        .Take(Shown);

    private sealed record Response([property: JsonPropertyName("results")] List<Item>? Results);

    private sealed record Item(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("admin1")] string? Admin1,
        [property: JsonPropertyName("country")] string? Country,
        [property: JsonPropertyName("feature_code")] string? FeatureCode,
        [property: JsonPropertyName("population")] long? Population,
        [property: JsonPropertyName("latitude")] double Latitude,
        [property: JsonPropertyName("longitude")] double Longitude);
}

/// <summary>A fixed list of Polish cities, named in English as the geocoder names them, for tests and for work without a network. Matching ignores case and diacritics.</summary>
public sealed class FakeLocationSearch : ILocationSearch
{
    private static readonly PlaceMatch[] Places =
    [
        new("Gliwice", "Silesia", "Poland", 50.29, 18.67),
        new("Gdańsk", "Pomerania", "Poland", 54.35, 18.65),
        new("Gdynia", "Pomerania", "Poland", 54.52, 18.53),
        new("Katowice", "Silesia", "Poland", 50.26, 19.02),
        new("Kraków", "Lesser Poland", "Poland", 50.06, 19.94),
        new("Łódź", "Łódź Voivodeship", "Poland", 51.77, 19.46),
        new("Poznań", "Greater Poland", "Poland", 52.41, 16.93),
        new("Warsaw", "Masovia", "Poland", 52.23, 21.01),
        new("Wrocław", "Lower Silesia", "Poland", 51.11, 17.03),
    ];

    public Task<Result<IReadOnlyList<PlaceMatch>>> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var needle = Fold(query.Trim());
        IReadOnlyList<PlaceMatch> found = needle.Length == 0 ? [] : [.. Places.Where(p => Fold(p.Name).StartsWith(needle, StringComparison.Ordinal))];
        return Task.FromResult(Result.Ok(found));
    }

    private static string Fold(string text)
    {
        var builder = new StringBuilder(text.Length);
        foreach (var ch in text.ToLowerInvariant().Replace('ł', 'l').Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(ch);
            }
        }

        return builder.ToString();
    }
}
