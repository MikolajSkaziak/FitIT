using System.Globalization;
using System.Text.RegularExpressions;

namespace FitIt.Core.Wardrobe;

/// <summary>
/// Names of stored files. Everything of one person lives under one prefix, so deleting an account is deleting a prefix
/// and a key can be checked against its owner without a database.
/// </summary>
public static partial class ObjectKeys
{
    public const string Root = "u/";

    public static string PrefixOf(Guid userId) => string.Create(CultureInfo.InvariantCulture, $"{Root}{userId:N}/");

    public static string NewOriginal(Guid userId) => string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}orig/{Guid.CreateVersion7():N}.jpg");

    public static string Cutout(Guid userId, Guid itemId, string extension) =>
        string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}cut/{itemId:N}.{extension}");

    /// <summary>True when the key is one this user could have been given by <see cref="NewOriginal"/>.</summary>
    public static bool IsOriginalOf(Guid userId, string? key) =>
        key is not null && key.StartsWith(PrefixOf(userId) + "orig/", StringComparison.Ordinal) && OriginalShape().IsMatch(key);

    [GeneratedRegex(@"^u/[0-9a-f]{32}/orig/[0-9a-f]{32}\.jpg$", RegexOptions.CultureInvariant)]
    private static partial Regex OriginalShape();
}
