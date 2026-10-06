using FitIt.Core.Common;

namespace FitIt.Core.Weather;

/// <summary>A place found by name: what the person sees in the list, and where the forecast is taken.</summary>
public sealed record PlaceMatch(string Name, string? Region, string? Country, double Lat, double Lon);

/// <summary>Finds places by name. Used only when the phone's location is refused or not wanted.</summary>
public interface ILocationSearch
{
    Task<Result<IReadOnlyList<PlaceMatch>>> SearchAsync(string query, CancellationToken cancellationToken);
}
