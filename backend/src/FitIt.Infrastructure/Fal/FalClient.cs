using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Fal;

/// <summary>The result of an order: its JSON when it is done, otherwise why there is none.</summary>
public sealed record FalResult(ProviderJobState State, JsonElement Body);

/// <summary>
/// fal.ai's queue over REST: send an order, ask where it stands, fetch the result, download the picture. The key travels in
/// the <c>Authorization</c> header of requests to the queue and nowhere else: not to the host a picture is downloaded from,
/// not into a log line, not into an exception. Exceptions carry a status code at most; never an address or a body.
/// </summary>
public sealed partial class FalClient(HttpClient http, IOptions<FalOptions> options)
{
    public const string QueueHost = "queue.fal.run";

    /// <summary>The largest picture taken from fal: far above what the models return, far below what would hurt.</summary>
    public const int MaxDownloadBytes = 25_000_000;

    private const string ContentPolicy = "content_policy_violation";

    /// <summary>An order as fal addresses it: <c>{app}/requests/{id}</c>, the path of its status and result.</summary>
    [GeneratedRegex(@"^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)*/requests/[A-Za-z0-9-]{8,64}$")]
    private static partial Regex OrderPath();

    [GeneratedRegex("^[A-Za-z0-9-]{8,64}$")]
    private static partial Regex RequestId();

    /// <summary>Sends the order and returns its handle, which is all that is needed to ask about it later (also after a restart).</summary>
    /// <exception cref="ProviderException">fal did not take the order.</exception>
    public async Task<string> SubmitAsync(string endpoint, JsonObject input, CancellationToken cancellationToken)
    {
        using var request = Queue(HttpMethod.Post, endpoint);
        request.Content = new StringContent(input.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
        if (options.Value.DisablePayloadStorage)
        {
            request.Headers.Add("X-Fal-Store-IO", "0");
        }

        var (status, body) = await SendAsync(request, "take the order", cancellationToken);
        if ((int)status is < 200 or >= 300)
        {
            throw new ProviderException($"fal did not take the order: HTTP {(int)status}{ErrorType(body)}.");
        }

        if (Str(body, "request_id") is not { } id || !RequestId().IsMatch(id))
        {
            throw new ProviderException("fal took the order but named no request.");
        }

        // fal says where the order lives (an endpoint's sub-path is not always part of it); the address is used only when it is fal's own queue.
        if (Str(body, "response_url") is { } address && Uri.TryCreate(address, UriKind.Absolute, out var uri)
            && uri is { Scheme: "https", Host: QueueHost } && uri.AbsolutePath.EndsWith("/response", StringComparison.Ordinal))
        {
            var path = uri.AbsolutePath[1..^"/response".Length];
            if (OrderPath().IsMatch(path))
            {
                return path;
            }
        }

        var app = string.Join('/', endpoint.Split('/').Take(2));
        return $"{app}/requests/{id}";
    }

    /// <exception cref="ProviderException">fal could not say; asking again is safe.</exception>
    public async Task<ProviderJobState> StatusAsync(string order, CancellationToken cancellationToken)
    {
        using var request = Queue(HttpMethod.Get, $"{Checked(order)}/status");
        var (status, body) = await SendAsync(request, "say where the order stands", cancellationToken);
        if (status != HttpStatusCode.OK)
        {
            throw new ProviderException($"fal could not say where the order stands: HTTP {(int)status}.");
        }

        return Str(body, "status") switch
        {
            "IN_QUEUE" => ProviderJobState.Queued,
            "IN_PROGRESS" => ProviderJobState.Running,
            "COMPLETED" => Str(body, "error_type") is { } type
                ? Refusal(type)
                : body.TryGetProperty("error", out var error) && error.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined ? ProviderJobState.Failed : ProviderJobState.Completed,
            _ => throw new ProviderException("fal answered with a state this adapter does not know."),
        };
    }

    /// <summary>The result of a finished order. A refusal by the content filter and a failed order are states, not exceptions.</summary>
    /// <exception cref="ProviderException">fal could not answer; asking again is safe.</exception>
    public async Task<FalResult> ResultAsync(string order, CancellationToken cancellationToken)
    {
        using var request = Queue(HttpMethod.Get, Checked(order));
        var (status, body) = await SendAsync(request, "hand over the result", cancellationToken);
        if (status == HttpStatusCode.OK)
        {
            return new FalResult(ProviderJobState.Completed, body);
        }

        // 4xx is fal's verdict on the order itself and will not change; anything else may pass.
        return (int)status is >= 400 and < 500 and not 404 and not 408 and not 429
            ? new FalResult(DetailTypes(body).Any(type => type == ContentPolicy) ? ProviderJobState.Blocked : ProviderJobState.Failed, default)
            : throw new ProviderException($"fal could not hand over the result: HTTP {(int)status}.");
    }

    /// <summary>Downloads a picture fal made. The address is fal's and short-lived: it is never logged, stored or passed on.</summary>
    /// <exception cref="ProviderException">There is no usable picture at the address.</exception>
    public async Task<byte[]> DownloadAsync(string? address, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new ProviderException("fal's result names no picture.");
        }

        try
        {
            // No Authorization header here: the picture is public to whoever has its address, and the key is for the queue only.
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.StatusCode != HttpStatusCode.OK)
            {
                throw new ProviderException($"fal's picture could not be downloaded: HTTP {(int)response.StatusCode}.");
            }

            if (response.Content.Headers.ContentLength > MaxDownloadBytes)
            {
                throw new ProviderException("fal's picture is too large.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var buffer = new MemoryStream();
            var chunk = new byte[81920];
            int read;
            while ((read = await stream.ReadAsync(chunk, cancellationToken)) > 0)
            {
                if (buffer.Length + read > MaxDownloadBytes)
                {
                    throw new ProviderException("fal's picture is too large.");
                }

                buffer.Write(chunk, 0, read);
            }

            return buffer.ToArray();
        }
        catch (HttpRequestException exception)
        {
            throw new ProviderException($"fal's picture could not be downloaded: network error ({exception.HttpRequestError}).");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ProviderException("fal's picture could not be downloaded in time.");
        }
    }

    /// <summary>A picture as fal is to receive it: inside the request, or as the signed address when storage is reachable from outside.</summary>
    public async Task<string> ImageInputAsync(ImageSource source, IImageStorage storage, CancellationToken cancellationToken) =>
        options.Value.SendSignedUrls
            ? source.Url.AbsoluteUri
            : ProviderImages.DataUri(await storage.ReadAsync(source.Key, null, cancellationToken));

    private HttpRequestMessage Queue(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, $"https://{QueueHost}/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Key", options.Value.ApiKey);
        return request;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> SendAsync(HttpRequestMessage request, string what, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await http.SendAsync(request, cancellationToken);
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            try
            {
                return (response.StatusCode, JsonSerializer.Deserialize<JsonElement>(text));
            }
            catch (JsonException)
            {
                return response.IsSuccessStatusCode
                    ? throw new ProviderException($"fal's answer is not JSON (asked to {what}).")
                    : (response.StatusCode, default);
            }
        }
        catch (HttpRequestException exception)
        {
            throw new ProviderException($"fal could not be reached to {what}: network error ({exception.HttpRequestError}).");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ProviderException($"fal did not answer in time (asked to {what}).");
        }
    }

    private static string Checked(string order) =>
        OrderPath().IsMatch(order) && !order.Contains("..", StringComparison.Ordinal) ? order : throw new ProviderException("The order is not one this provider made.");

    private static ProviderJobState Refusal(string errorType) =>
        errorType.Contains("content_policy", StringComparison.OrdinalIgnoreCase) ? ProviderJobState.Blocked : ProviderJobState.Failed;

    private static string? Str(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    /// <summary>The machine-readable kinds of fal's errors (<c>detail[].type</c>).</summary>
    private static IEnumerable<string> DetailTypes(JsonElement body) =>
        body.ValueKind == JsonValueKind.Object && body.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.Array
            ? detail.EnumerateArray().Select(item => Str(item, "type")).OfType<string>()
            : [];

    private static string ErrorType(JsonElement body) =>
        DetailTypes(body).FirstOrDefault(type => type.All(character => char.IsAsciiLetterLower(character) || character == '_')) is { } type ? $" {type}" : "";
}
