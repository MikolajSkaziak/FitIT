namespace FitIt.Infrastructure.Common;

/// <summary>What kind of picture a run of bytes is, by its first bytes, for adapters that send pictures inside a request.</summary>
public static class ProviderImages
{
    public static string MimeOf(ReadOnlySpan<byte> content) => content switch
    {
        [0x89, 0x50, 0x4E, 0x47, ..] => "image/png",
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => "image/webp",
        _ => "image/jpeg",
    };

    public static string ExtensionOf(ReadOnlySpan<byte> content) => MimeOf(content) switch
    {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    };

    public static string DataUri(byte[] content) => $"data:{MimeOf(content)};base64,{Convert.ToBase64String(content)}";
}
