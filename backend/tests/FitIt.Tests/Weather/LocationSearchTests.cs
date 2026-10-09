using System.Net;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Weather;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitIt.Tests.Weather;

public sealed class LocationSearchTests
{
    /// <summary>What the geocoding service really answers for "gli", shortened: in its own order, best name match first.</summary>
    private const string Recorded = """
        {"results":[
          {"name":"Glen Innes","latitude":-29.73,"longitude":151.74,"feature_code":"PPL","country_code":"AU","population":6093,"country":"Australia","admin1":"New South Wales"},
          {"name":"Gli","latitude":6.21,"longitude":-5.86,"feature_code":"PPL","country_code":"CI","country":"Ivory Coast","admin1":"Gôh-Djiboua"},
          {"name":"Gli","latitude":6.02,"longitude":-5.61,"feature_code":"PPL","country_code":"CI","country":"Ivory Coast","admin1":"Gôh-Djiboua"},
          {"name":"Glen Innes Airport","latitude":-29.68,"longitude":151.69,"feature_code":"AIRP","country_code":"AU","country":"Australia","admin1":"New South Wales"},
          {"name":"Gliwice","latitude":50.29761,"longitude":18.67658,"feature_code":"PPLA3","country_code":"PL","population":198835,"country":"Poland","admin1":"Silesia"},
          {"name":"Glin","latitude":52.57,"longitude":-9.28,"feature_code":"PPL","country_code":"IE","population":576,"country":"Ireland","admin1":"Munster"},
          {"name":"Belaya Glina","latitude":46.07,"longitude":40.87,"feature_code":"PPLA2","country_code":"RU","population":17997,"country":"Russia","admin1":"Krasnodar Krai"},
          {"name":"Glina","latitude":44.38,"longitude":26.25,"feature_code":"PPLA2","country_code":"RO","population":7227,"country":"Romania","admin1":"Ilfov"},
          {"name":"Goulib","latitude":33.8,"longitude":-4.4,"feature_code":"MT","country_code":"MA","country":"Morocco","admin1":"Fès-Meknès"},
          {"name":"Glinojeck","latitude":52.82,"longitude":20.29,"feature_code":"PPLA3","country_code":"PL","population":3052,"country":"Poland","admin1":"Masovia"},
          {"name":"Glide","latitude":43.3,"longitude":-123.1,"feature_code":"PPL","country_code":"US","population":1795,"country":"United States","admin1":"Oregon"}
        ]}
        """;

    [Fact]
    public async Task Bigger_places_come_first_whatever_the_country_and_only_towns_are_listed()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Recorded);

        var result = await Search(handler, " gli ");

        Assert.True(result.IsOk);
        // No airport, no mountain, the twin "Gli" once; places without a known population keep the provider's order at the end.
        Assert.Equal(
            ["Gliwice", "Belaya Glina", "Glina", "Glen Innes", "Glinojeck", "Glide", "Glin", "Gli"],
            result.Value.Select(place => place.Name));
        Assert.Equal(new PlaceMatch("Gliwice", "Silesia", "Poland", 50.29761, 18.67658), result.Value[0]);
        Assert.Equal("/v1/search?name=gli&count=20&language=en&format=json", handler.Asked?.PathAndQuery);
    }

    [Fact]
    public async Task Two_entries_that_read_the_same_are_shown_once()
    {
        const string twins = """
            {"results":[
              {"name":"Gli","latitude":6.21,"longitude":-5.86,"feature_code":"PPL","country_code":"CI","country":"Ivory Coast","admin1":"Gôh-Djiboua"},
              {"name":"Gli","latitude":6.02,"longitude":-5.61,"feature_code":"PPL","country_code":"CI","country":"Ivory Coast","admin1":"Gôh-Djiboua"},
              {"name":"Gli","latitude":5.1,"longitude":-6.4,"feature_code":"PPL","country_code":"CI","country":"Ivory Coast","admin1":"Bas-Sassandra District"}
            ]}
            """;

        var result = await Search(new StubHandler(HttpStatusCode.OK, twins), "gli");

        Assert.Equal(["Gôh-Djiboua", "Bas-Sassandra District"], result.Value.Select(place => place.Region));
        Assert.Equal(6.21, result.Value[0].Lat);
    }

    [Fact]
    public async Task Nothing_found_is_an_empty_list()
    {
        var result = await Search(new StubHandler(HttpStatusCode.OK, """{"generationtime_ms":0.4}"""), "qqqq");

        Assert.True(result.IsOk);
        Assert.Empty(result.Value);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, "oops")]
    [InlineData(HttpStatusCode.OK, "<html>not json</html>")]
    public async Task A_failing_or_garbled_answer_is_reported_as_unavailable(HttpStatusCode status, string body)
    {
        var result = await Search(new StubHandler(status, body), "gli");

        Assert.False(result.IsOk);
        Assert.Equal(503, result.Error?.Status);
        Assert.Equal("location_search_unavailable", result.Error?.Code);
    }

    [Fact]
    public async Task A_name_with_spaces_and_Polish_letters_is_escaped()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"results":[]}""");

        await Search(handler, "Zielona Góra");

        Assert.Equal("/v1/search?name=Zielona%20G%C3%B3ra&count=20&language=en&format=json", handler.Asked?.PathAndQuery);
    }

    private static Task<Result<IReadOnlyList<PlaceMatch>>> Search(StubHandler handler, string query)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri(OpenMeteoLocationSearch.BaseAddress) };
        return new OpenMeteoLocationSearch(http, NullLogger<OpenMeteoLocationSearch>.Instance).SearchAsync(query, CancellationToken.None);
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public Uri? Asked { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Asked = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
