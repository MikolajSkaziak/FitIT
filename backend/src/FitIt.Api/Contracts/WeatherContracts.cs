using FitIt.Core.Weather;

namespace FitIt.Api.Contracts;

/// <summary>
/// The weather an outfit is chosen for: the hours from now until the evening, or tomorrow's day once it is late.
/// Temperatures are "feels like", in degrees Celsius. The app words the headline and the advice itself.
/// <c>Hours</c> are up to four hours of that window, the first being the current one.
/// </summary>
public sealed record WeatherResponse(
    string Place,
    bool ForTomorrow,
    DateTimeOffset From,
    DateTimeOffset To,
    int FeelsMin,
    int FeelsMax,
    DateTimeOffset ColdestAt,
    DateTimeOffset WarmestAt,
    Sky Sky,
    bool Rain,
    int RainProbability,
    DateTimeOffset? RainFrom,
    bool NeedsLayers,
    TemperatureBand Band,
    IReadOnlyList<WeatherHourResponse> Hours);

/// <summary>One hour of today at the place: what it feels like and what the sky does.</summary>
public sealed record WeatherHourResponse(DateTimeOffset Time, int Feels, Sky Sky);
