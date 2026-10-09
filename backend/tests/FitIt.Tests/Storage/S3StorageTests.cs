using System.Net;
using System.Net.Http.Headers;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Storage;
using FitIt.Tests.Support;
using Microsoft.Extensions.Options;

namespace FitIt.Tests.Storage;

/// <summary>A real S3-compatible server in a container: the same one local development uses, speaking the protocol R2 speaks.</summary>
public sealed class S3Server : IAsyncLifetime
{
    public const string AccessKey = "test-access-key";
    public const string SecretKey = "test-secret-key-0123456789";
    private const int Port = 7070;

    private readonly IContainer _container = new ContainerBuilder("versity/versitygw:v1.8.0")
        .WithEnvironment("ROOT_ACCESS_KEY", AccessKey)
        .WithEnvironment("ROOT_SECRET_KEY", SecretKey)
        // Object metadata goes to a second directory, so the data directory needs no extended attributes.
        .WithTmpfsMount("/data")
        .WithTmpfsMount("/meta")
        .WithCommand("posix", "--sidecar", "/meta", "/data")
        .WithPortBinding(Port, assignRandomHostPort: true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(Port))
        .Build();

    public string Endpoint => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(Port)}";

    public S3ImageStorage Storage { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        Storage = Create(Endpoint);
        await Storage.EnsureBucketAsync(CancellationToken.None);
    }

    public async Task DisposeAsync()
    {
        Storage.Dispose();
        await _container.DisposeAsync();
    }

    public static S3ImageStorage Create(string endpoint, string? publicEndpoint = null, string secretKey = SecretKey) => new(
        Options.Create(new StorageOptions
        {
            Endpoint = endpoint,
            PublicEndpoint = publicEndpoint,
            Bucket = "fitit-test",
            Region = "us-east-1",
            AccessKey = AccessKey,
            SecretKey = secretKey,
        }),
        TimeProvider.System);
}

/// <summary>Which address the client talks to, decided from the settings alone. No server is involved.</summary>
public sealed class StorageAddressTests
{
    [Theory]
    [InlineData("eu", "https://abc123.eu.r2.cloudflarestorage.com")]
    [InlineData("us", "https://abc123.us.r2.cloudflarestorage.com")]
    [InlineData("", "https://abc123.r2.cloudflarestorage.com")]
    [InlineData(null, "https://abc123.r2.cloudflarestorage.com")]
    public void An_account_id_becomes_the_r2_address_of_its_jurisdiction(string? jurisdiction, string expected)
    {
        var options = new StorageOptions { AccountId = " abc123 ", Jurisdiction = jurisdiction };

        Assert.Equal(expected, options.ResolvedEndpoint);
        Assert.True(options.UsesR2);
    }

    [Fact]
    public void An_explicit_endpoint_wins_so_development_keeps_its_local_server()
    {
        var options = new StorageOptions { Endpoint = "http://localhost:9000", AccountId = "abc123" };

        Assert.Equal("http://localhost:9000", options.ResolvedEndpoint);
        Assert.False(options.UsesR2);
    }

    [Fact]
    public void Without_either_setting_the_storage_client_says_what_is_missing()
    {
        var options = Options.Create(new StorageOptions { AccessKey = "a", SecretKey = "b" });

        var failure = Assert.Throws<InvalidOperationException>(() => new S3ImageStorage(options, TimeProvider.System));

        Assert.Contains("Storage:AccountId", failure.Message, StringComparison.Ordinal);
    }
}

public sealed class S3StorageTests(S3Server server) : IClassFixture<S3Server>
{
    private static readonly HttpClient Phone = new();

    private readonly S3ImageStorage _storage = server.Storage;

    [Fact]
    public async Task Creating_the_bucket_twice_is_harmless()
    {
        await _storage.EnsureBucketAsync(CancellationToken.None);
        await _storage.EnsureBucketAsync(CancellationToken.None);
    }

    [Fact]
    public async Task A_phone_uploads_with_the_ticket_and_the_api_sees_what_arrived()
    {
        var key = ObjectKeys.NewOriginal(Guid.NewGuid());
        var photo = TestApi.Jpeg(50_000);
        var ticket = _storage.CreateUpload(key, "image/jpeg", TimeSpan.FromMinutes(5));

        var put = await PutAsync(ticket.Url, photo, ticket.Headers["Content-Type"]);

        Assert.True(put.IsSuccessStatusCode, await put.Content.ReadAsStringAsync());
        var found = await _storage.FindAsync(key, CancellationToken.None);
        Assert.NotNull(found);
        Assert.Equal(50_000, found.Size);
        Assert.True(found.LastModified > DateTimeOffset.UtcNow.AddMinutes(-2));
        Assert.Equal([0xFF, 0xD8, 0xFF], await _storage.ReadAsync(key, 3, CancellationToken.None));
        Assert.Equal(photo, await _storage.ReadAsync(key, null, CancellationToken.None));
        Assert.True(ticket.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(4));
    }

    [Fact]
    public async Task The_ticket_is_good_only_for_the_content_type_it_was_made_for()
    {
        var key = ObjectKeys.NewOriginal(Guid.NewGuid());
        var ticket = _storage.CreateUpload(key, "image/jpeg", TimeSpan.FromMinutes(5));

        var put = await PutAsync(ticket.Url, TestApi.Jpeg(), "text/html");

        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
        Assert.Null(await _storage.FindAsync(key, CancellationToken.None));
    }

    [Fact]
    public async Task A_ticket_cannot_be_used_for_another_key_or_after_it_expires()
    {
        var key = ObjectKeys.NewOriginal(Guid.NewGuid());
        var other = ObjectKeys.NewOriginal(Guid.NewGuid());
        var ticket = _storage.CreateUpload(key, "image/jpeg", TimeSpan.FromMinutes(5));
        var redirected = new Uri(ticket.Url.AbsoluteUri.Replace(key, other, StringComparison.Ordinal));
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(redirected, TestApi.Jpeg(), "image/jpeg")).StatusCode);

        var brief = _storage.CreateUpload(key, "image/jpeg", TimeSpan.FromSeconds(1));
        await Task.Delay(TimeSpan.FromSeconds(3));
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(brief.Url, TestApi.Jpeg(), "image/jpeg")).StatusCode);
        Assert.Null(await _storage.FindAsync(key, CancellationToken.None));
        Assert.Null(await _storage.FindAsync(other, CancellationToken.None));
    }

    [Fact]
    public async Task A_signed_address_reads_the_object_and_nothing_else_does()
    {
        var key = ObjectKeys.Cutout(Guid.NewGuid(), Guid.NewGuid(), "png");
        await _storage.WriteAsync(key, ScriptedAi.Cutout, "image/png", CancellationToken.None);

        var signed = _storage.SignRead(key, TimeSpan.FromMinutes(5));
        var read = await Phone.GetAsync(signed);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(ScriptedAi.Cutout, await read.Content.ReadAsByteArrayAsync());
        Assert.Equal("image/png", read.Content.Headers.ContentType?.MediaType);

        var unsigned = new Uri(signed.GetLeftPart(UriPartial.Path));
        Assert.Equal(HttpStatusCode.Forbidden, (await Phone.GetAsync(unsigned)).StatusCode);
        var tampered = new Uri(signed.AbsoluteUri[..^4] + "0000");
        Assert.Equal(HttpStatusCode.Forbidden, (await Phone.GetAsync(tampered)).StatusCode);
    }

    [Fact]
    public async Task Addresses_are_signed_for_the_public_host_when_it_differs_from_the_one_the_api_uses()
    {
        // The API reaches storage by one name, phones by another (here: the same server under "localhost" and "127.0.0.1").
        var port = new Uri(server.Endpoint).Port;
        using var split = S3Server.Create($"http://127.0.0.1:{port}", publicEndpoint: $"http://localhost:{port}");
        var key = ObjectKeys.NewOriginal(Guid.NewGuid());

        var ticket = split.CreateUpload(key, "image/jpeg", TimeSpan.FromMinutes(5));

        Assert.Equal("localhost", ticket.Url.Host);
        Assert.Equal("http", ticket.Url.Scheme);
        Assert.True((await PutAsync(ticket.Url, TestApi.Jpeg(), "image/jpeg")).IsSuccessStatusCode);
        Assert.NotNull(await split.FindAsync(key, CancellationToken.None));
        Assert.Equal("localhost", split.SignRead(key, TimeSpan.FromMinutes(1)).Host);
    }

    [Fact]
    public async Task Objects_are_listed_by_prefix_and_deleted_for_good()
    {
        var owner = Guid.NewGuid();
        var first = ObjectKeys.NewOriginal(owner);
        var second = ObjectKeys.Cutout(owner, Guid.NewGuid(), "png");
        var foreign = ObjectKeys.NewOriginal(Guid.NewGuid());
        await _storage.WriteAsync(first, TestApi.Jpeg(), "image/jpeg", CancellationToken.None);
        await _storage.WriteAsync(second, ScriptedAi.Cutout, "image/png", CancellationToken.None);
        await _storage.WriteAsync(foreign, TestApi.Jpeg(), "image/jpeg", CancellationToken.None);

        var mine = new List<StoredObject>();
        await foreach (var found in _storage.ListAsync(ObjectKeys.PrefixOf(owner), CancellationToken.None))
        {
            mine.Add(found);
        }

        Assert.Equal(new[] { first, second }.Order(StringComparer.Ordinal), mine.Select(found => found.Key).Order(StringComparer.Ordinal));
        Assert.Equal(ScriptedAi.Cutout.Length, mine.Single(found => found.Key == second).Size);

        await _storage.DeleteAsync([first, second, "u/nobody/orig/missing.jpg"], CancellationToken.None);

        Assert.Null(await _storage.FindAsync(first, CancellationToken.None));
        Assert.Null(await _storage.FindAsync(second, CancellationToken.None));
        Assert.NotNull(await _storage.FindAsync(foreign, CancellationToken.None));
    }

    [Fact]
    public async Task Every_object_under_a_prefix_is_listed()
    {
        var owner = Guid.NewGuid();
        var keys = Enumerable.Range(0, 30).Select(_ => ObjectKeys.NewOriginal(owner)).ToList();
        await Task.WhenAll(keys.Select(key => _storage.WriteAsync(key, new byte[] { 0xFF, 0xD8, 0xFF }, "image/jpeg", CancellationToken.None)));

        var listed = 0;
        await foreach (var _ in _storage.ListAsync(ObjectKeys.PrefixOf(owner), CancellationToken.None))
        {
            listed++;
        }

        Assert.Equal(30, listed);
    }

    [Fact]
    public async Task Wrong_credentials_are_refused_by_the_server_not_silently_accepted()
    {
        using var intruder = S3Server.Create(server.Endpoint, secretKey: "not-the-secret-key-000000");

        await Assert.ThrowsAnyAsync<Amazon.S3.AmazonS3Exception>(() => intruder.WriteAsync("u/x/orig/y.jpg", TestApi.Jpeg(), "image/jpeg", CancellationToken.None));
    }

    private static Task<HttpResponseMessage> PutAsync(Uri url, byte[] content, string contentType)
    {
        var body = new ByteArrayContent(content);
        body.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return Phone.PutAsync(url, body);
    }
}
