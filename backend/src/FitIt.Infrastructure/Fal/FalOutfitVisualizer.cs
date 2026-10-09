using System.Text.Json;
using System.Text.Json.Nodes;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Fal;

/// <summary>
/// The picture of an outfit on the figure, made by an image model behind fal.ai's queue (Nano Banana 2 unless configured
/// otherwise). The figure is image 1 and the garments follow in the order of the prompt. The job polls through this adapter
/// and keeps the picture in our own storage; fal's address never reaches the phone. A refusal by the content filter is the
/// port's <see cref="ProviderJobState.Blocked"/>.
/// </summary>
public sealed class FalOutfitVisualizer(FalClient fal, IImageStorage storage, IOptions<FalOptions> options) : IOutfitVisualizer
{
    public string Model => options.Value.TryOnEndpoint;

    public async Task<string> SubmitAsync(VisualizationInput input, CancellationToken cancellationToken)
    {
        if (input.Garments.Count == 0)
        {
            throw new ProviderException("An order needs at least one garment.");
        }

        var settings = options.Value;
        var images = new JsonArray();
        foreach (var source in input.Garments.Prepend(input.Silhouette))
        {
            images.Add(await fal.ImageInputAsync(source, storage, cancellationToken));
        }

        return await fal.SubmitAsync(settings.TryOnEndpoint, new JsonObject
        {
            ["prompt"] = input.Prompt,
            ["image_urls"] = images,
            ["aspect_ratio"] = settings.AspectRatio,
            ["resolution"] = settings.Resolution,
            ["output_format"] = "jpeg",
            ["num_images"] = 1,
        }, cancellationToken);
    }

    public async Task<ProviderJobStatus> GetStatusAsync(string providerRequestId, CancellationToken cancellationToken)
    {
        var state = await fal.StatusAsync(providerRequestId, cancellationToken);
        if (state != ProviderJobState.Completed)
        {
            return ProviderJobStatus.Of(state);
        }

        // "Completed" on fal's side also covers orders that ended in an error; only the result says which.
        var result = await fal.ResultAsync(providerRequestId, cancellationToken);
        return ProviderJobStatus.Of(result.State == ProviderJobState.Completed && Address(result.Body) is null ? ProviderJobState.Failed : result.State);
    }

    public async Task<VisualizedImage> GetResultAsync(string providerRequestId, CancellationToken cancellationToken)
    {
        var result = await fal.ResultAsync(providerRequestId, cancellationToken);
        if (result.State != ProviderJobState.Completed)
        {
            throw new ProviderException($"fal has no picture for this order ({result.State}).");
        }

        var content = await fal.DownloadAsync(Address(result.Body), cancellationToken);
        return new VisualizedImage(content, ProviderImages.MimeOf(content), ProviderImages.ExtensionOf(content), new AiCost(Model, options.Value.TryOnUsdPerImage));
    }

    private static string? Address(JsonElement body) =>
        body.ValueKind == JsonValueKind.Object && body.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array && images.GetArrayLength() > 0
        && images[0].ValueKind == JsonValueKind.Object && images[0].TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String
            ? url.GetString()
            : null;
}
