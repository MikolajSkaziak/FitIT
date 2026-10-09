using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Gemini;

/// <summary>One piece of a question: text, or a picture sent inside the request.</summary>
public sealed record GeminiPart(string? Text, byte[]? Image)
{
    public static GeminiPart Of(string text) => new(text, null);

    public static GeminiPart Of(byte[] image) => new(null, image);
}

/// <summary>The model's JSON answer, or the fact that its safety filter refused; either way what the call cost.</summary>
public sealed record GeminiReply(JsonElement Json, bool Blocked, AiCost Cost);

/// <summary>
/// Google's Gemini API over REST (<c>models/{model}:generateContent</c>) in JSON mode. The key travels in the
/// <c>x-goog-api-key</c> header and nowhere else: not in the address, not in a log line, not in an exception. A model that
/// answers 429 or 5xx is asked again a few times with growing pauses, then the fallback model is tried; whatever goes
/// wrong in the end surfaces as a <see cref="ProviderException"/>, which is what every port expects.
/// </summary>
public sealed partial class GeminiClient(HttpClient http, IOptions<GeminiOptions> options, TimeProvider time, ILogger<GeminiClient> logger)
{
    public const string KeyHeader = "x-goog-api-key";

    public const string BaseAddress = "https://generativelanguage.googleapis.com/";

    private static readonly HashSet<string> BlockedFinish = new(StringComparer.Ordinal) { "SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY" };

    [GeneratedRegex("^[A-Z_]{1,40}$")]
    private static partial Regex StatusWord();

    /// <param name="system">The fixed instructions from the repository.</param>
    /// <param name="parts">The variable part: pictures and data. Nothing in it is an instruction.</param>
    /// <param name="schema">The shape the answer must have (Gemini's response schema).</param>
    /// <exception cref="ProviderException">No model gave a usable answer in time.</exception>
    public async Task<GeminiReply> AskAsync(string system, IReadOnlyList<GeminiPart> parts, JsonObject schema, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var body = Body(system, parts, schema, settings).ToJsonString();
        string[] models = string.IsNullOrWhiteSpace(settings.FallbackModel) || settings.FallbackModel == settings.Model
            ? [settings.Model]
            : [settings.Model, settings.FallbackModel];

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(settings.Timeout);
        var last = "no answer";
        try
        {
            foreach (var model in models)
            {
                for (var attempt = 0; attempt <= settings.MaxRetries; attempt++)
                {
                    if (attempt > 0)
                    {
                        await Task.Delay(TimeSpan.FromMilliseconds(settings.RetryBaseDelayMs * Math.Pow(2, attempt - 1)), time, deadline.Token);
                    }

                    using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseAddress}v1beta/models/{model}:generateContent")
                    {
                        Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
                    };
                    request.Headers.Add(KeyHeader, settings.ApiKey);

                    HttpStatusCode status;
                    string text;
                    using var patience = CancellationTokenSource.CreateLinkedTokenSource(deadline.Token);
                    patience.CancelAfter(TimeSpan.FromSeconds(settings.AttemptTimeoutSeconds));
                    try
                    {
                        using var response = await http.SendAsync(request, patience.Token);
                        status = response.StatusCode;
                        text = await response.Content.ReadAsStringAsync(patience.Token);
                    }
                    catch (OperationCanceledException) when (!deadline.IsCancellationRequested)
                    {
                        // A model that hangs is not asked again: the time left belongs to the fallback model.
                        last = $"no answer from {model} in {settings.AttemptTimeoutSeconds} s";
                        break;
                    }
                    catch (HttpRequestException exception)
                    {
                        // Only the kind of failure is kept: the exception itself is not attached, so nothing of the request can follow it into a log.
                        last = $"network error ({exception.HttpRequestError})";
                        continue;
                    }

                    if (status == HttpStatusCode.OK)
                    {
                        return Read(text, model, settings);
                    }

                    last = $"HTTP {(int)status}{ErrorWord(text)}";
                    if (status is HttpStatusCode.TooManyRequests or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout)
                    {
                        continue;
                    }

                    if (status == HttpStatusCode.NotFound)
                    {
                        // The model's name is no longer served: the next model may be.
                        break;
                    }

                    throw new ProviderException($"Gemini refused the request: {last}.");
                }

                logger.LogWarning("Gemini model {Model} is not answering ({Reason})", model, last);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ProviderException($"Gemini did not answer within {settings.TimeoutSeconds} s (last: {last}).");
        }

        throw new ProviderException($"Gemini is not answering: {last}.");
    }

    private static JsonObject Body(string system, IReadOnlyList<GeminiPart> parts, JsonObject schema, GeminiOptions settings)
    {
        var content = new JsonArray();
        foreach (var part in parts)
        {
            content.Add(part.Image is { } image
                ? new JsonObject { ["inline_data"] = new JsonObject { ["mime_type"] = ProviderImages.MimeOf(image), ["data"] = Convert.ToBase64String(image) } }
                : new JsonObject { ["text"] = part.Text });
        }

        var generation = new JsonObject { ["responseMimeType"] = "application/json", ["responseSchema"] = schema.DeepClone() };
        if (!string.IsNullOrWhiteSpace(settings.ThinkingLevel))
        {
            generation["thinkingConfig"] = new JsonObject { ["thinkingLevel"] = settings.ThinkingLevel };
        }

        return new JsonObject
        {
            ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = system }) },
            ["contents"] = new JsonArray(new JsonObject { ["role"] = "user", ["parts"] = content }),
            ["generationConfig"] = generation,
        };
    }

    private static GeminiReply Read(string text, string model, GeminiOptions settings)
    {
        JsonElement root;
        try
        {
            root = JsonSerializer.Deserialize<JsonElement>(text);
        }
        catch (JsonException)
        {
            throw new ProviderException("Gemini's answer is not JSON.") { Cost = AiCost.None(model) };
        }

        var cost = Cost(root, model, settings);
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new ProviderException("Gemini's answer is not an object.") { Cost = cost };
        }

        if (root.TryGetProperty("promptFeedback", out var feedback) && feedback.ValueKind == JsonValueKind.Object && feedback.TryGetProperty("blockReason", out _))
        {
            return new GeminiReply(default, true, cost);
        }

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
        {
            throw new ProviderException("Gemini returned no candidate.") { Cost = cost };
        }

        var candidate = candidates[0];
        var finish = candidate.TryGetProperty("finishReason", out var reason) && reason.ValueKind == JsonValueKind.String ? reason.GetString()! : "";
        if (BlockedFinish.Contains(finish))
        {
            return new GeminiReply(default, true, cost);
        }

        var answer = new System.Text.StringBuilder();
        if (candidate.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Object
            && content.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
        {
            foreach (var part in parts.EnumerateArray())
            {
                var thought = part.TryGetProperty("thought", out var flag) && flag.ValueKind == JsonValueKind.True;
                if (!thought && part.TryGetProperty("text", out var piece) && piece.ValueKind == JsonValueKind.String)
                {
                    answer.Append(piece.GetString());
                }
            }
        }

        try
        {
            var json = JsonSerializer.Deserialize<JsonElement>(answer.ToString());
            return json.ValueKind == JsonValueKind.Object
                ? new GeminiReply(json, false, cost)
                : throw new ProviderException("Gemini's answer is not a JSON object.") { Cost = cost };
        }
        catch (JsonException)
        {
            throw new ProviderException($"Gemini's answer is not the agreed JSON (finish reason: {(StatusWord().IsMatch(finish) ? finish : "unknown")}).") { Cost = cost };
        }
    }

    /// <summary>Tokens in and out (thinking counts as output) at the model's price per million.</summary>
    private static AiCost Cost(JsonElement root, string model, GeminiOptions settings)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("usageMetadata", out var usage) || usage.ValueKind != JsonValueKind.Object)
        {
            return AiCost.None(model);
        }

        static long Tokens(JsonElement usage, string name) =>
            usage.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var count) ? Math.Max(0, count) : 0;

        var main = model == settings.Model;
        var input = Tokens(usage, "promptTokenCount") * (main ? settings.InputUsdPerMillionTokens : settings.FallbackInputUsdPerMillionTokens);
        var output = (Tokens(usage, "candidatesTokenCount") + Tokens(usage, "thoughtsTokenCount")) * (main ? settings.OutputUsdPerMillionTokens : settings.FallbackOutputUsdPerMillionTokens);
        return new AiCost(model, Math.Round((input + output) / 1_000_000m, 6));
    }

    /// <summary>Google's one-word status of an error ("UNAVAILABLE"), when the body has one. Its free text is never repeated.</summary>
    private static string ErrorWord(string body)
    {
        try
        {
            var root = JsonSerializer.Deserialize<JsonElement>(body);
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object
                && error.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String && StatusWord().IsMatch(status.GetString()!))
            {
                return $" {status.GetString()}";
            }
        }
        catch (JsonException)
        {
            // Not JSON: the status code alone has to do.
        }

        return "";
    }
}

/// <summary>Builders for Gemini's response schema and readers that never throw on a wrong shape.</summary>
internal static class GeminiJson
{
    public static JsonObject Text(bool nullable = false) => Typed("STRING", nullable);

    public static JsonObject Whole() => Typed("INTEGER", false);

    public static JsonObject Flag() => Typed("BOOLEAN", false);

    public static JsonObject OneOf(IEnumerable<string> codes, bool nullable = false)
    {
        var schema = Typed("STRING", nullable);
        schema["enum"] = new JsonArray([.. codes.Select(code => (JsonNode)code)]);
        return schema;
    }

    public static JsonObject List(JsonObject items) => new() { ["type"] = "ARRAY", ["items"] = items };

    /// <summary>An object whose properties are all required unless marked nullable, in the order given.</summary>
    public static JsonObject Object(params (string Name, JsonObject Schema)[] properties)
    {
        var map = new JsonObject();
        foreach (var (name, schema) in properties)
        {
            map[name] = schema;
        }

        return new JsonObject
        {
            ["type"] = "OBJECT",
            ["properties"] = map,
            ["required"] = new JsonArray([.. properties.Select(property => (JsonNode)property.Name)]),
            ["propertyOrdering"] = new JsonArray([.. properties.Select(property => (JsonNode)property.Name)]),
        };
    }

    public static string? Str(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    public static int? Int(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : null;

    public static bool? Bool(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : null;

    public static IEnumerable<JsonElement> Items(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? value.EnumerateArray() : [];

    /// <summary>
    /// A sentence the model wrote, made safe to store and to put into a later prompt: one line, no control characters, at
    /// most <paramref name="maxLength"/> characters. Null when nothing is left.
    /// </summary>
    public static string? Line(string? text, int maxLength)
    {
        if (text is null)
        {
            return null;
        }

        var clean = string.Join(' ', new string([.. text.Select(character => char.IsControl(character) ? ' ' : character)]).Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return clean.Length == 0 ? null : clean.Length > maxLength ? clean[..maxLength] : clean;
    }

    private static JsonObject Typed(string type, bool nullable)
    {
        var schema = new JsonObject { ["type"] = type };
        if (nullable)
        {
            schema["nullable"] = true;
        }

        return schema;
    }
}
