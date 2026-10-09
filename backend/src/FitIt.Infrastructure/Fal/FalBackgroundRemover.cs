using System.Text.Json;
using System.Text.Json.Nodes;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Fal;

/// <summary>
/// Background removal by fal.ai (BiRefNet v2 unless configured otherwise): the photo goes out, a PNG with a transparent
/// background comes back and is handed to the job, which stores it in our own storage. Every failure is a
/// <see cref="ProviderException"/>; after the job's last try the photo itself becomes the cutout, so no garment is lost.
/// </summary>
public sealed class FalBackgroundRemover(FalClient fal, IImageStorage storage, IOptions<FalOptions> options, TimeProvider time) : IBackgroundRemover
{
    public async Task<BackgroundRemoval> RemoveAsync(ImageSource photo, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var endpoint = settings.BackgroundRemovalEndpoint;
        var input = new JsonObject
        {
            ["image_url"] = await fal.ImageInputAsync(photo, storage, cancellationToken),
            ["output_format"] = "png",
        };

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(settings.BackgroundRemovalTimeoutSeconds));
        try
        {
            var order = await fal.SubmitAsync(endpoint, input, deadline.Token);
            while (true)
            {
                var state = await fal.StatusAsync(order, deadline.Token);
                if (state is ProviderJobState.Blocked or ProviderJobState.Failed)
                {
                    throw new ProviderException($"fal could not remove the background ({state}).");
                }

                if (state == ProviderJobState.Completed)
                {
                    break;
                }

                await Task.Delay(TimeSpan.FromMilliseconds(settings.PollIntervalMs), time, deadline.Token);
            }

            var result = await fal.ResultAsync(order, deadline.Token);
            if (result.State != ProviderJobState.Completed)
            {
                throw new ProviderException($"fal could not remove the background ({result.State}).");
            }

            var address = result.Body.ValueKind == JsonValueKind.Object && result.Body.TryGetProperty("image", out var image) && image.ValueKind == JsonValueKind.Object
                && image.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String ? url.GetString() : null;
            var cost = new AiCost(endpoint, settings.BackgroundRemovalUsdPerImage);
            var content = await fal.DownloadAsync(address, deadline.Token);
            return ProviderImages.MimeOf(content) == "image/png"
                ? new BackgroundRemoval(content, "image/png", "png", cost)
                : throw new ProviderException("fal's cutout is not a PNG.") { Cost = cost };
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ProviderException($"fal did not remove the background within {settings.BackgroundRemovalTimeoutSeconds} s.");
        }
    }
}
