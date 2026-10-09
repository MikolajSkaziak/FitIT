using System.Net;
using System.Text.Json.Nodes;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Fal;
using FitIt.Infrastructure.Storage;
using FitIt.Tests.Support;
using Microsoft.Extensions.Options;

namespace FitIt.Tests.Providers;

/// <summary>The fal.ai adapters against a scripted queue: what they send, how they wait, and how every ending maps onto the ports.</summary>
public sealed class FalAdapterTests
{
    private const string Id = "764cabcf-b745-4b3e-ae38-1200304cf45b";
    private const string Picture = "https://v3.fal.media/files/zebra/result-abc.png";
    private const string CutoutResult = "{\"image\":{\"url\":\"" + Picture + "\",\"content_type\":\"image/png\"}}";
    private const string Blocked = """{"detail":[{"loc":["body","prompt"],"msg":"The content could not be processed.","type":"content_policy_violation"}]}""";

    private static readonly ImageSource Photo = new("u/photo.jpg", new Uri("https://storage.test/u/photo.jpg?expires=1"));
    private static readonly ImageSource Figure = new("u/figure.jpg", new Uri("https://storage.test/u/figure.jpg?expires=1"));
    private static readonly ImageSource Shirt = new("u/shirt.png", new Uri("https://storage.test/u/shirt.png?expires=1"));
    private static readonly ImageSource Trousers = new("u/trousers.png", new Uri("https://storage.test/u/trousers.png?expires=1"));
    private static readonly VisualizationInput Order = new("Image 1 shows a person.", Figure, [Shirt, Trousers]);

    private readonly InMemoryImageStorage _storage = new(TimeProvider.System);
    private readonly byte[] _jpeg = TestApi.Jpeg();

    public FalAdapterTests()
    {
        _storage.Put(Photo.Key, _jpeg);
        _storage.Put(Figure.Key, _jpeg);
        _storage.Put(Shirt.Key, ScriptedAi.Cutout, "image/png");
        _storage.Put(Trousers.Key, ScriptedAi.Cutout, "image/png");
    }

    // ---- background removal -----------------------------------------------------------------------------------------

    [Fact]
    public async Task Background_removal_orders_waits_fetches_and_downloads_the_cutout()
    {
        var http = new StubHttp()
            .Json(HttpStatusCode.Accepted, Submitted("fal-ai/birefnet"))
            .Json(HttpStatusCode.OK, """{"status":"IN_QUEUE","queue_position":1}""")
            .Json(HttpStatusCode.OK, """{"status":"IN_PROGRESS"}""")
            .Json(HttpStatusCode.OK, """{"status":"COMPLETED","metrics":{"inference_time":0.4}}""")
            .Json(HttpStatusCode.OK, CutoutResult)
            .Bytes(ScriptedAi.Cutout, "image/png");

        var removal = await Remover(http).RemoveAsync(Photo, CancellationToken.None);

        Assert.Equal(ScriptedAi.Cutout, removal.Content);
        Assert.Equal(("image/png", "png"), (removal.ContentType, removal.Extension));
        Assert.Equal(new AiCost("fal-ai/birefnet/v2", 0.005m), removal.Cost);
        Assert.Equal(
            [
                "POST https://queue.fal.run/fal-ai/birefnet/v2",
                $"GET https://queue.fal.run/fal-ai/birefnet/requests/{Id}/status",
                $"GET https://queue.fal.run/fal-ai/birefnet/requests/{Id}/status",
                $"GET https://queue.fal.run/fal-ai/birefnet/requests/{Id}/status",
                $"GET https://queue.fal.run/fal-ai/birefnet/requests/{Id}",
                $"GET {Picture}",
            ],
            http.Requests.Select(request => $"{request.Method} {request.Uri.AbsoluteUri}"));
        var sent = JsonNode.Parse(http.Requests[0].Body)!;
        Assert.Equal($"data:image/jpeg;base64,{Convert.ToBase64String(_jpeg)}", (string?)sent["image_url"]);
        Assert.Equal("png", (string?)sent["output_format"]);
    }

    [Fact]
    public async Task The_key_goes_to_the_queue_in_its_header_and_never_to_the_host_of_the_picture()
    {
        var http = new StubHttp()
            .Json(HttpStatusCode.Accepted, Submitted("fal-ai/birefnet"))
            .Json(HttpStatusCode.OK, """{"status":"COMPLETED"}""")
            .Json(HttpStatusCode.OK, CutoutResult)
            .Bytes(ScriptedAi.Cutout, "image/png");

        await Remover(http).RemoveAsync(Photo, CancellationToken.None);

        foreach (var request in http.Requests)
        {
            Assert.Empty(request.Uri.Query);
            Assert.DoesNotContain(StubHttp.Key, request.Uri.AbsoluteUri + request.Body, StringComparison.Ordinal);
            if (request.Uri.Host == FalClient.QueueHost)
            {
                Assert.Equal($"Key {StubHttp.Key}", request.Headers["Authorization"]);
            }
            else
            {
                Assert.DoesNotContain(request.Headers, header => header.Value.Contains(StubHttp.Key, StringComparison.Ordinal));
            }
        }

        Assert.Contains(http.Requests, request => request.Uri.Host != FalClient.QueueHost);
    }

    public static TheoryData<string, HttpStatusCode[], string[]> RemovalFailures => new()
    {
        { "the order is refused", [HttpStatusCode.InternalServerError], ["{}"] },
        { "the key is wrong", [HttpStatusCode.Unauthorized], ["""{"detail":"Invalid key test-key-not-a-real-one"}"""] },
        { "fal reports an error", [HttpStatusCode.Accepted, HttpStatusCode.OK], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED","error":"boom","error_type":"internal_error"}"""] },
        { "the result is an error", [HttpStatusCode.Accepted, HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED"}""", Blocked] },
        { "the result names no picture", [HttpStatusCode.Accepted, HttpStatusCode.OK, HttpStatusCode.OK], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED"}""", """{"image":null}"""] },
        { "the picture is not on https", [HttpStatusCode.Accepted, HttpStatusCode.OK, HttpStatusCode.OK], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED"}""", """{"image":{"url":"http://169.254.169.254/latest"}}"""] },
        { "the picture is gone", [HttpStatusCode.Accepted, HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.NotFound], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED"}""", CutoutResult, "gone"] },
        { "the picture is not a PNG", [HttpStatusCode.Accepted, HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.OK], [Submitted("fal-ai/birefnet"), """{"status":"COMPLETED"}""", CutoutResult, "<html>error</html>"] },
    };

    [Theory]
    [MemberData(nameof(RemovalFailures))]
    public async Task Every_way_background_removal_can_fail_is_a_provider_failure_that_says_nothing_secret(string what, HttpStatusCode[] statuses, string[] bodies)
    {
        var http = new StubHttp();
        foreach (var (status, body) in statuses.Zip(bodies))
        {
            http.Json(status, body);
        }

        var failure = await Assert.ThrowsAsync<ProviderException>(() => Remover(http).RemoveAsync(Photo, CancellationToken.None));

        Assert.False(string.IsNullOrEmpty(what));
        Assert.DoesNotContain(StubHttp.Key, failure.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("fal.media", failure.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("storage.test", failure.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_background_removal_that_never_finishes_ends_as_a_provider_failure()
    {
        var http = new StubHttp().Json(HttpStatusCode.Accepted, Submitted("fal-ai/birefnet")).Json(HttpStatusCode.OK, """{"status":"IN_QUEUE"}""");

        var failure = await Assert.ThrowsAsync<ProviderException>(() => Remover(http, o => (o.BackgroundRemovalTimeoutSeconds, o.PollIntervalMs) = (1, 50)).RemoveAsync(Photo, CancellationToken.None));

        Assert.Contains("within 1 s", failure.Message, StringComparison.Ordinal);
        Assert.True(http.Requests.Count > 2);
    }

    [Fact]
    public async Task A_queue_that_does_not_answer_ends_as_a_provider_failure()
    {
        var http = new StubHttp().Hangs();

        await Assert.ThrowsAsync<ProviderException>(() => Remover(http, o => o.BackgroundRemovalTimeoutSeconds = 1).RemoveAsync(Photo, CancellationToken.None));
    }

    // ---- the picture on the figure ----------------------------------------------------------------------------------

    [Fact]
    public async Task An_order_carries_the_prompt_the_figure_first_and_the_garments_in_order_and_remembers_where_fal_keeps_it()
    {
        var http = new StubHttp().Json(HttpStatusCode.Accepted, Submitted("fal-ai/nano-banana-2"));
        var visualizer = Visualizer(http);

        var order = await visualizer.SubmitAsync(Order, CancellationToken.None);

        // fal drops the endpoint's sub-path from the address of an order; the handle is what fal said, not a guess.
        Assert.Equal($"fal-ai/nano-banana-2/requests/{Id}", order);
        Assert.True(order.Length <= 200);
        Assert.Equal("fal-ai/nano-banana-2/edit", visualizer.Model);
        var request = Assert.Single(http.Requests);
        Assert.Equal("https://queue.fal.run/fal-ai/nano-banana-2/edit", request.Uri.AbsoluteUri);
        Assert.False(request.Headers.ContainsKey("X-Fal-Store-IO"));
        var sent = JsonNode.Parse(request.Body)!;
        Assert.Equal(Order.Prompt, (string?)sent["prompt"]);
        Assert.Equal(
            [$"data:image/jpeg;base64,{Convert.ToBase64String(_jpeg)}", $"data:image/png;base64,{Convert.ToBase64String(ScriptedAi.Cutout)}", $"data:image/png;base64,{Convert.ToBase64String(ScriptedAi.Cutout)}"],
            sent["image_urls"]!.AsArray().Select(image => (string?)image));
        Assert.Equal(("3:4", "1K", "jpeg", 1), ((string?)sent["aspect_ratio"], (string?)sent["resolution"], (string?)sent["output_format"], (int)sent["num_images"]!));
    }

    [Fact]
    public async Task With_storage_reachable_from_outside_fal_is_given_the_signed_addresses_and_may_be_told_not_to_keep_them()
    {
        var http = new StubHttp().Json(HttpStatusCode.Accepted, $$"""{"request_id":"{{Id}}"}""");

        var order = await Visualizer(http, o => (o.SendSignedUrls, o.DisablePayloadStorage) = (true, true)).SubmitAsync(Order, CancellationToken.None);

        // Without an address from fal the handle is built from the endpoint's app.
        Assert.Equal($"fal-ai/nano-banana-2/requests/{Id}", order);
        var request = Assert.Single(http.Requests);
        Assert.Equal("0", request.Headers["X-Fal-Store-IO"]);
        Assert.Equal(
            [Figure.Url.AbsoluteUri, Shirt.Url.AbsoluteUri, Trousers.Url.AbsoluteUri],
            JsonNode.Parse(request.Body)!["image_urls"]!.AsArray().Select(image => (string?)image));
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, "{}")]
    [InlineData(HttpStatusCode.UnprocessableEntity, """{"detail":[{"type":"file_too_large","msg":"too large"}]}""")]
    [InlineData(HttpStatusCode.Accepted, """{"queue_position":0}""")]
    [InlineData(HttpStatusCode.Accepted, """{"request_id":"../../admin"}""")]
    public async Task An_order_fal_does_not_take_is_a_provider_failure(HttpStatusCode status, string body)
    {
        var http = new StubHttp().Json(status, body);

        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).SubmitAsync(Order, CancellationToken.None));
    }

    [Fact]
    public async Task An_order_without_garments_is_not_sent()
    {
        var http = new StubHttp().Json(HttpStatusCode.Accepted, Submitted("fal-ai/nano-banana-2"));

        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).SubmitAsync(Order with { Garments = [] }, CancellationToken.None));

        Assert.Empty(http.Requests);
    }

    public static TheoryData<ProviderJobState, HttpStatusCode[], string[]> States => new()
    {
        { ProviderJobState.Queued, [HttpStatusCode.OK], ["""{"status":"IN_QUEUE","queue_position":3}"""] },
        { ProviderJobState.Running, [HttpStatusCode.OK], ["""{"status":"IN_PROGRESS"}"""] },
        { ProviderJobState.Completed, [HttpStatusCode.OK, HttpStatusCode.OK], ["""{"status":"COMPLETED"}""", $$"""{"images":[{"url":"{{Picture}}"}],"description":""}"""] },
        // The content filter, as fal reports it on the result and as it reports it on the status.
        { ProviderJobState.Blocked, [HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity], ["""{"status":"COMPLETED"}""", Blocked] },
        { ProviderJobState.Blocked, [HttpStatusCode.OK], ["""{"status":"COMPLETED","error":"flagged","error_type":"content_policy_violation"}"""] },
        { ProviderJobState.Failed, [HttpStatusCode.OK], ["""{"status":"COMPLETED","error":"out of memory","error_type":"internal_error"}"""] },
        { ProviderJobState.Failed, [HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity], ["""{"status":"COMPLETED"}""", """{"detail":[{"type":"image_too_large"}]}"""] },
        { ProviderJobState.Failed, [HttpStatusCode.OK, HttpStatusCode.OK], ["""{"status":"COMPLETED"}""", """{"images":[]}"""] },
    };

    [Theory]
    [MemberData(nameof(States))]
    public async Task What_fal_says_about_an_order_becomes_the_ports_state(ProviderJobState expected, HttpStatusCode[] statuses, string[] bodies)
    {
        var http = new StubHttp();
        foreach (var (status, body) in statuses.Zip(bodies))
        {
            http.Json(status, body);
        }

        var state = await Visualizer(http).GetStatusAsync($"fal-ai/nano-banana-2/requests/{Id}", CancellationToken.None);

        Assert.Equal(expected, state.State);
        Assert.Equal(statuses.Length, http.Requests.Count);
        Assert.Equal($"https://queue.fal.run/fal-ai/nano-banana-2/requests/{Id}/status", http.Requests[0].Uri.AbsoluteUri);
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable, "{}")]
    [InlineData(HttpStatusCode.OK, """{"status":"SOMETHING_NEW"}""")]
    [InlineData(HttpStatusCode.OK, "not json")]
    public async Task When_fal_cannot_say_where_an_order_stands_the_job_is_told_to_ask_again(HttpStatusCode status, string body)
    {
        var http = new StubHttp().Json(status, body);

        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).GetStatusAsync($"fal-ai/nano-banana-2/requests/{Id}", CancellationToken.None));
    }

    [Fact]
    public async Task A_result_that_is_not_ready_on_the_second_look_is_asked_for_again_rather_than_given_up()
    {
        var http = new StubHttp().Json(HttpStatusCode.OK, """{"status":"COMPLETED"}""").Json(HttpStatusCode.BadGateway, "{}");

        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).GetStatusAsync($"fal-ai/nano-banana-2/requests/{Id}", CancellationToken.None));
    }

    [Fact]
    public async Task The_finished_picture_is_downloaded_and_priced_per_image()
    {
        var http = new StubHttp().Json(HttpStatusCode.OK, $$"""{"images":[{"url":"{{Picture}}","content_type":"image/jpeg"}]}""").Bytes(_jpeg, "image/jpeg");

        var image = await Visualizer(http).GetResultAsync($"fal-ai/nano-banana-2/requests/{Id}", CancellationToken.None);

        Assert.Equal(_jpeg, image.Content);
        Assert.Equal(("image/jpeg", "jpg"), (image.ContentType, image.Extension));
        Assert.Equal(new AiCost("fal-ai/nano-banana-2/edit", 0.08m), image.Cost);
        Assert.Equal($"https://queue.fal.run/fal-ai/nano-banana-2/requests/{Id}", http.Requests[0].Uri.AbsoluteUri);
    }

    [Theory]
    [InlineData("fake-0123456789abcdef-dS9maWd1cmUuanBn")]
    [InlineData("fal-ai/nano-banana-2/requests/../../../admin")]
    [InlineData("https://evil.example/requests/764cabcf-b745-4b3e-ae38-1200304cf45b")]
    [InlineData("fal-ai/x/requests/764cabcf?x=1")]
    public async Task An_order_this_adapter_did_not_make_is_never_asked_about(string order)
    {
        var http = new StubHttp().Json(HttpStatusCode.OK, """{"status":"COMPLETED"}""");

        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).GetStatusAsync(order, CancellationToken.None));
        await Assert.ThrowsAsync<ProviderException>(() => Visualizer(http).GetResultAsync(order, CancellationToken.None));

        Assert.Empty(http.Requests);
    }

    // ---- helpers ----------------------------------------------------------------------------------------------------

    private static string Submitted(string app) =>
        $$"""{"request_id":"{{Id}}","response_url":"https://queue.fal.run/{{app}}/requests/{{Id}}/response","status_url":"https://queue.fal.run/{{app}}/requests/{{Id}}/status","queue_position":0}""";

    private static IOptions<FalOptions> Settings(Action<FalOptions>? change)
    {
        var options = new FalOptions { ApiKey = StubHttp.Key, PollIntervalMs = 0 };
        change?.Invoke(options);
        return Options.Create(options);
    }

    private FalBackgroundRemover Remover(StubHttp http, Action<FalOptions>? change = null)
    {
        var settings = Settings(change);
        return new FalBackgroundRemover(new FalClient(http.Client(), settings), _storage, settings, TimeProvider.System);
    }

    private FalOutfitVisualizer Visualizer(StubHttp http, Action<FalOptions>? change = null)
    {
        var settings = Settings(change);
        return new FalOutfitVisualizer(new FalClient(http.Client(), settings), _storage, settings);
    }
}
