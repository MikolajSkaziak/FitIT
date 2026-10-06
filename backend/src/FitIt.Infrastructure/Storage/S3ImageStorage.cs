using System.Net;
using System.Runtime.CompilerServices;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Storage;

/// <summary>
/// File storage over the S3 protocol: Cloudflare R2 in production, any S3-compatible server locally.
/// Two clients because a signature covers the host name: the API may reach storage by one address (a container name)
/// while phones reach it by another.
/// </summary>
public sealed class S3ImageStorage : IImageStorage, IDisposable
{
    private readonly AmazonS3Client _client;
    private readonly AmazonS3Client _signer;
    private readonly string _bucket;
    private readonly Protocol _publicProtocol;
    private readonly TimeProvider _time;

    public S3ImageStorage(IOptions<StorageOptions> options, TimeProvider time)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Endpoint) || string.IsNullOrEmpty(settings.AccessKey) || string.IsNullOrEmpty(settings.SecretKey))
        {
            throw new InvalidOperationException("Storage:Endpoint, Storage:AccessKey and Storage:SecretKey must be set (user-secrets or the environment).");
        }

        var credentials = new BasicAWSCredentials(settings.AccessKey, settings.SecretKey);
        var publicEndpoint = string.IsNullOrWhiteSpace(settings.PublicEndpoint) ? settings.Endpoint : settings.PublicEndpoint;
        _client = new AmazonS3Client(credentials, Configure(settings.Endpoint, settings.Region));
        _signer = string.Equals(publicEndpoint, settings.Endpoint, StringComparison.OrdinalIgnoreCase)
            ? _client
            : new AmazonS3Client(credentials, Configure(publicEndpoint, settings.Region));
        _publicProtocol = publicEndpoint.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ? Protocol.HTTP : Protocol.HTTPS;
        _bucket = settings.Bucket;
        _time = time;
    }

    public UploadTicket CreateUpload(string key, string contentType, TimeSpan lifetime)
    {
        var url = _signer.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.Add(lifetime),
            Protocol = _publicProtocol,
        });

        // The content type is part of the signature: the phone must send exactly this header.
        return new UploadTicket(key, new Uri(url), new Dictionary<string, string>(StringComparer.Ordinal) { ["Content-Type"] = contentType }, _time.GetUtcNow().Add(lifetime));
    }

    public Uri SignRead(string key, TimeSpan lifetime) => new(_signer.GetPreSignedURL(new GetPreSignedUrlRequest
    {
        BucketName = _bucket,
        Key = key,
        Verb = HttpVerb.GET,
        Expires = DateTime.UtcNow.Add(lifetime),
        Protocol = _publicProtocol,
    }));

    public async Task<StoredObject?> FindAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            var metadata = await _client.GetObjectMetadataAsync(_bucket, key, cancellationToken);
            return new StoredObject(key, metadata.ContentLength, new DateTimeOffset(metadata.LastModified.GetValueOrDefault().ToUniversalTime(), TimeSpan.Zero));
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<byte[]> ReadAsync(string key, int? limit, CancellationToken cancellationToken)
    {
        var request = new GetObjectRequest { BucketName = _bucket, Key = key };
        if (limit is { } bytes)
        {
            request.ByteRange = new ByteRange(0, bytes - 1);
        }

        using var response = await _client.GetObjectAsync(request, cancellationToken);
        using var buffer = new MemoryStream();
        await response.ResponseStream.CopyToAsync(buffer, cancellationToken);
        return buffer.ToArray();
    }

    public async Task WriteAsync(string key, ReadOnlyMemory<byte> content, string contentType, CancellationToken cancellationToken)
    {
        using var stream = new MemoryStream(content.ToArray(), writable: false);
        await _client.PutObjectAsync(
            new PutObjectRequest
            {
                BucketName = _bucket,
                Key = key,
                InputStream = stream,
                ContentType = contentType,
                // One signed request with a known length; the chunked streaming signature is not understood everywhere.
                UseChunkEncoding = false,
            },
            cancellationToken);
    }

    public async Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken)
    {
        // One by one: the batch call needs a body checksum that S3-compatible servers disagree about. Deleting a key that is not there succeeds.
        foreach (var key in keys)
        {
            await _client.DeleteObjectAsync(_bucket, key, cancellationToken);
        }
    }

    public async IAsyncEnumerable<StoredObject> ListAsync(string prefix, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var request = new ListObjectsV2Request { BucketName = _bucket, Prefix = prefix };
        ListObjectsV2Response response;
        do
        {
            response = await _client.ListObjectsV2Async(request, cancellationToken);
            foreach (var found in response.S3Objects ?? [])
            {
                yield return new StoredObject(found.Key, found.Size ?? 0, new DateTimeOffset(found.LastModified.GetValueOrDefault().ToUniversalTime(), TimeSpan.Zero));
            }

            request.ContinuationToken = response.NextContinuationToken;
        }
        while (response.IsTruncated == true);
    }

    /// <summary>Creates the bucket when it does not exist yet. Used at startup in development.</summary>
    public async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (!await AmazonS3Util.DoesS3BucketExistV2Async(_client, _bucket))
        {
            await _client.PutBucketAsync(new PutBucketRequest { BucketName = _bucket }, cancellationToken);
        }
    }

    public void Dispose()
    {
        if (!ReferenceEquals(_signer, _client))
        {
            _signer.Dispose();
        }

        _client.Dispose();
    }

    private static AmazonS3Config Configure(string endpoint, string region) => new()
    {
        ServiceURL = endpoint,
        ForcePathStyle = true,
        AuthenticationRegion = region,
        // Checksums only where the protocol requires them: R2 and other S3-compatible servers refuse the SDK's newer defaults.
        RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
        ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
    };
}
