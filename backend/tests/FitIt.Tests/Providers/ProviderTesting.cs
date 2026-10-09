using System.Net;
using System.Text;
using FitIt.Infrastructure.Usage;

namespace FitIt.Tests.Providers;

/// <summary>One request as the provider would have received it: where it went, what its headers said, what it carried.</summary>
public sealed record SeenRequest(HttpMethod Method, Uri Uri, IReadOnlyDictionary<string, string> Headers, string Body);

/// <summary>
/// Stands where the network would be. Each request takes the next scripted answer; when the script is empty, the last
/// answer repeats. Everything sent is kept, so a test can look for the key in places it must never be.
/// </summary>
public sealed class StubHttp : HttpMessageHandler
{
    public const string Key = "test-key-not-a-real-one";

    private readonly Queue<Func<SeenRequest, CancellationToken, Task<HttpResponseMessage>>> _script = new();
    private Func<SeenRequest, CancellationToken, Task<HttpResponseMessage>>? _last;

    public List<SeenRequest> Requests { get; } = [];

    public StubHttp Json(HttpStatusCode status, string body) =>
        Then((_, _) => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") }));

    public StubHttp Bytes(byte[] content, string contentType) =>
        Then((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(content) { Headers = { ContentType = new(contentType) } } }));

    /// <summary>Never answers: waits until whoever asked gives up.</summary>
    public StubHttp Hangs() => Then(async (_, cancellationToken) =>
    {
        await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
        return new HttpResponseMessage(HttpStatusCode.OK);
    });

    public StubHttp Fails(HttpRequestError error) => Then((_, _) => Task.FromException<HttpResponseMessage>(new HttpRequestException(error, $"The key is {Key}; nobody may repeat this message.")));

    public StubHttp Then(Func<SeenRequest, CancellationToken, Task<HttpResponseMessage>> answer)
    {
        _script.Enqueue(answer);
        return this;
    }

    public HttpClient Client() => new(this, disposeHandler: false);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var headers = request.Headers.ToDictionary(header => header.Key, header => string.Join(',', header.Value), StringComparer.OrdinalIgnoreCase);
        var seen = new SeenRequest(request.Method, request.RequestUri!, headers, request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
        Func<SeenRequest, CancellationToken, Task<HttpResponseMessage>> answer;
        lock (Requests)
        {
            Requests.Add(seen);
            answer = _script.Count > 0 ? _last = _script.Dequeue() : _last ?? throw new InvalidOperationException("The stub has no answer scripted.");
        }

        return await answer(seen, cancellationToken);
    }
}

public sealed class FixedBudget(bool left) : IAiBudget
{
    public int Asked { get; private set; }

    public Task<bool> HasBudgetAsync(CancellationToken cancellationToken)
    {
        Asked++;
        return Task.FromResult(left);
    }
}
