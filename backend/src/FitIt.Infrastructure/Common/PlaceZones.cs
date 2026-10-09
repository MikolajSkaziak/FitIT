using GeoTimeZone;

namespace FitIt.Infrastructure.Common;

/// <summary>Time zones of places on the map, looked up offline from coordinates.</summary>
public static class PlaceZones
{
    /// <summary>The zone at the coordinates; null where the system does not know the zone the map names.</summary>
    public static TimeZoneInfo? At(double lat, double lon) => Find(TimeZoneLookup.GetTimeZone(lat, lon).Result);

    public static TimeZoneInfo? Find(string id) => TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) ? zone : null;
}
