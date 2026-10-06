using System.Collections.Concurrent;
using System.Text.Json;

namespace FitIt.Core.Common;

/// <summary>
/// Enum values travel as lower snake case codes (<c>RunsCold</c> is <c>runs_cold</c>) in the database, the API and prompts.
/// The same policy is given to System.Text.Json, so all three always agree.
/// </summary>
public static class EnumCodes
{
    private static readonly ConcurrentDictionary<Type, (Dictionary<string, object> ByCode, Dictionary<object, string> ByValue)> Cache = new();

    public static string ToCode<T>(T value) where T : struct, Enum => Map(typeof(T)).ByValue[value];

    public static bool TryParse<T>(string? code, out T value) where T : struct, Enum
    {
        if (code is not null && Map(typeof(T)).ByCode.TryGetValue(code, out var boxed))
        {
            value = (T)boxed;
            return true;
        }

        value = default;
        return false;
    }

    public static T Parse<T>(string code) where T : struct, Enum =>
        TryParse<T>(code, out var value) ? value : throw new FormatException($"'{code}' is not a {typeof(T).Name} code.");

    public static IReadOnlyList<string> All<T>() where T : struct, Enum => [.. Enum.GetValues<T>().Select(ToCode)];

    private static (Dictionary<string, object> ByCode, Dictionary<object, string> ByValue) Map(Type type) =>
        Cache.GetOrAdd(type, static t =>
        {
            var byCode = new Dictionary<string, object>(StringComparer.Ordinal);
            var byValue = new Dictionary<object, string>();
            foreach (var value in Enum.GetValues(t))
            {
                var code = JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString()!);
                byCode[code] = value;
                byValue[value] = code;
            }

            return (byCode, byValue);
        });
}
