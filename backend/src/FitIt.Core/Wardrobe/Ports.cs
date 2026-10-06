namespace FitIt.Core.Wardrobe;

/// <summary>Where and how the phone sends a photo: a short-lived address that accepts one PUT.</summary>
public sealed record UploadTicket(string Key, Uri Url, IReadOnlyDictionary<string, string> Headers, DateTimeOffset ExpiresAt);

public sealed record StoredObject(string Key, long Size, DateTimeOffset LastModified);

/// <summary>
/// Private file storage (S3 compatible). Photos never pass through the API: the phone uploads straight to storage and
/// everybody else reads through signed addresses that expire.
/// </summary>
public interface IImageStorage
{
    UploadTicket CreateUpload(string key, string contentType, TimeSpan lifetime);

    /// <summary>An address that lets its holder read the object until it expires. Never logged.</summary>
    Uri SignRead(string key, TimeSpan lifetime);

    Task<StoredObject?> FindAsync(string key, CancellationToken cancellationToken);

    /// <summary>The object's bytes, or only the first <paramref name="limit"/> of them.</summary>
    Task<byte[]> ReadAsync(string key, int? limit, CancellationToken cancellationToken);

    Task WriteAsync(string key, ReadOnlyMemory<byte> content, string contentType, CancellationToken cancellationToken);

    Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken);

    IAsyncEnumerable<StoredObject> ListAsync(string prefix, CancellationToken cancellationToken);
}

/// <summary>A stored picture handed to an outside service: the key for adapters that read storage, the signed address for those that fetch.</summary>
public sealed record ImageSource(string Key, Uri Url);

/// <summary>What one call to an AI provider cost, for the usage log and the daily budget.</summary>
public sealed record AiCost(string Model, decimal Usd)
{
    public static AiCost None(string model) => new(model, 0m);
}

public sealed record BackgroundRemoval(byte[] Content, string ContentType, string Extension, AiCost Cost);

public interface IBackgroundRemover
{
    /// <exception cref="ProviderException">The provider failed or answered with something unusable.</exception>
    Task<BackgroundRemoval> RemoveAsync(ImageSource photo, CancellationToken cancellationToken);
}

/// <summary>Either the tags of a supported garment and the model's own English sentence, or the reason the photo is not accepted.</summary>
public sealed record TaggingOutcome(GarmentTags? Tags, string? Description, RejectReason? Rejected, AiCost Cost)
{
    public static TaggingOutcome Accepted(GarmentTags tags, string description, AiCost cost) => new(tags, description, null, cost);

    public static TaggingOutcome Refused(RejectReason reason, AiCost cost) => new(null, null, reason, cost);
}

public interface IGarmentTagger
{
    /// <exception cref="ProviderException">The provider failed or its answer does not fit the dictionaries.</exception>
    Task<TaggingOutcome> TagAsync(ImageSource cutout, CancellationToken cancellationToken);
}

/// <summary>An outside service did not do its job. Carries what the failed call cost, if anything.</summary>
public sealed class ProviderException : Exception
{
    public ProviderException()
    {
    }

    public ProviderException(string message)
        : base(message)
    {
    }

    public ProviderException(string message, Exception? innerException)
        : base(message, innerException)
    {
    }

    public AiCost? Cost { get; init; }
}
