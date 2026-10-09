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

    /// <summary>
    /// A garment's picture without background, cropped to the garment (see <c>CutoutTrimmer</c>). The <c>-tight</c> in the name
    /// tells such a picture from the padded ones stored before cropping existed, and gives a repaired picture a new name,
    /// which is what the phone caches pictures by.
    /// </summary>
    public static string Cutout(Guid userId, Guid itemId, string extension) =>
        string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}cut/{itemId:N}{TightMark}{extension}");

    /// <summary>How every cutout written since cropping ends, up to its extension.</summary>
    public const string TightMark = "-tight.";

    /// <summary>A copy of a silhouette in the person's own prefix: the image model reads it through a signed address like everything else.</summary>
    public static string Silhouette(Guid userId, Guid avatarId) => string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}sil/{avatarId:N}.jpg");

    public static string Visualization(Guid userId, Guid visualizationId, string extension) =>
        string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}viz/{visualizationId:N}.{extension}");

    /// <summary>A face photo for the colour analysis. It lives only while the analysis runs and is deleted in the same request.</summary>
    public static string NewSelfie(Guid userId) => string.Create(CultureInfo.InvariantCulture, $"{PrefixOf(userId)}selfie/{Guid.CreateVersion7():N}.jpg");

    /// <summary>True for any selfie, whoever's: the sweep removes these on a short horizon because no row ever points to them.</summary>
    public static bool IsSelfie(string key) => SelfieShape().IsMatch(key);

    /// <summary>True when the key is one this user could have been given by <see cref="NewSelfie"/>.</summary>
    public static bool IsSelfieOf(Guid userId, string? key) =>
        key is not null && key.StartsWith(PrefixOf(userId) + "selfie/", StringComparison.Ordinal) && SelfieShape().IsMatch(key);

    /// <summary>Silhouette copies belong to no row: the sweep for unreferenced files must leave them alone.</summary>
    public static bool IsSilhouette(string key) => SilhouetteShape().IsMatch(key);

    /// <summary>True when the key is one this user could have been given by <see cref="NewOriginal"/>.</summary>
    public static bool IsOriginalOf(Guid userId, string? key) =>
        key is not null && key.StartsWith(PrefixOf(userId) + "orig/", StringComparison.Ordinal) && OriginalShape().IsMatch(key);

    [GeneratedRegex(@"^u/[0-9a-f]{32}/sil/[0-9a-f]{32}\.jpg$", RegexOptions.CultureInvariant)]
    private static partial Regex SilhouetteShape();

    [GeneratedRegex(@"^u/[0-9a-f]{32}/selfie/[0-9a-f]{32}\.jpg$", RegexOptions.CultureInvariant)]
    private static partial Regex SelfieShape();

    [GeneratedRegex(@"^u/[0-9a-f]{32}/orig/[0-9a-f]{32}\.jpg$", RegexOptions.CultureInvariant)]
    private static partial Regex OriginalShape();
}
