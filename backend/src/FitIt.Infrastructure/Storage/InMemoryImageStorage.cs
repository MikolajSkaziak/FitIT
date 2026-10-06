using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using FitIt.Core.Wardrobe;

namespace FitIt.Infrastructure.Storage;

/// <summary>
/// Storage that lives in memory, for tests. It behaves like the real one from the API's side, but its addresses lead
/// nowhere: a test plays the phone by calling <see cref="Put"/>.
/// </summary>
public sealed class InMemoryImageStorage(TimeProvider time) : IImageStorage
{
    private readonly ConcurrentDictionary<string, (byte[] Content, string ContentType, DateTimeOffset Modified)> _objects = new(StringComparer.Ordinal);

    public IReadOnlyCollection<string> Keys => [.. _objects.Keys];

    public bool Contains(string key) => _objects.ContainsKey(key);

    /// <summary>What the phone's PUT does.</summary>
    public void Put(string key, byte[] content, string contentType = "image/jpeg") => _objects[key] = (content, contentType, time.GetUtcNow());

    public UploadTicket CreateUpload(string key, string contentType, TimeSpan lifetime) =>
        new(key, new Uri($"https://storage.test/{key}?upload=1"), new Dictionary<string, string>(StringComparer.Ordinal) { ["Content-Type"] = contentType }, time.GetUtcNow().Add(lifetime));

    public Uri SignRead(string key, TimeSpan lifetime) => new($"https://storage.test/{key}?expires={time.GetUtcNow().Add(lifetime).ToUnixTimeSeconds()}");

    public Task<StoredObject?> FindAsync(string key, CancellationToken cancellationToken) =>
        Task.FromResult(_objects.TryGetValue(key, out var found) ? new StoredObject(key, found.Content.LongLength, found.Modified) : null);

    public Task<byte[]> ReadAsync(string key, int? limit, CancellationToken cancellationToken)
    {
        var content = _objects.TryGetValue(key, out var found) ? found.Content : throw new FileNotFoundException("No such object.", key);
        return Task.FromResult(limit is { } bytes && bytes < content.Length ? content[..bytes] : content);
    }

    public Task WriteAsync(string key, ReadOnlyMemory<byte> content, string contentType, CancellationToken cancellationToken)
    {
        _objects[key] = (content.ToArray(), contentType, time.GetUtcNow());
        return Task.CompletedTask;
    }

    public Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        foreach (var key in keys)
        {
            _objects.TryRemove(key, out _);
        }

        return Task.CompletedTask;
    }

    public async IAsyncEnumerable<StoredObject> ListAsync(string prefix, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        foreach (var (key, found) in _objects.Where(entry => entry.Key.StartsWith(prefix, StringComparison.Ordinal)).OrderBy(entry => entry.Key, StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return new StoredObject(key, found.Content.LongLength, found.Modified);
            await Task.Yield();
        }
    }
}
