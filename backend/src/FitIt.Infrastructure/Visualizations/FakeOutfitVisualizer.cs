using System.Collections.Concurrent;
using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>
/// Stands in for the image model until there is a provider key. Like the real one it answers late: an order stays queued
/// for a configured number of status polls, and only then is done. The picture it returns is the silhouette itself, a real
/// JPEG, so everything downstream (storage, signed addresses, the screen) works as it will with the real service.
/// The same order always gets the same id, and the id carries what the result needs, so a restart loses nothing.
/// </summary>
public sealed class FakeOutfitVisualizer(IImageStorage storage, IOptions<VisualizationOptions> options) : IOutfitVisualizer
{
    public const string FakeModel = "fake-outfit-visualizer";

    private const string IdPrefix = "fake-";

    private readonly ConcurrentDictionary<string, int> _polls = new(StringComparer.Ordinal);

    public string Model => FakeModel;

    public Task<string> SubmitAsync(VisualizationInput input, CancellationToken cancellationToken)
    {
        if (input.Garments.Count == 0)
        {
            throw new ProviderException("An order needs at least one garment.");
        }

        var order = string.Join('\n', input.Garments.Select(garment => garment.Key).Prepend(input.Silhouette.Key).Append(input.Prompt));
        var digest = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(order)))[..16];
        return Task.FromResult($"{IdPrefix}{digest}-{Base64Url.EncodeToString(Encoding.UTF8.GetBytes(input.Silhouette.Key))}");
    }

    public Task<ProviderJobStatus> GetStatusAsync(string providerRequestId, CancellationToken cancellationToken)
    {
        Parse(providerRequestId);
        var polls = _polls.AddOrUpdate(providerRequestId, 1, (_, seen) => seen + 1);
        var wanted = Math.Max(0, options.Value.FakePollsBeforeDone);
        var state = polls > wanted ? ProviderJobState.Completed : polls == 1 ? ProviderJobState.Queued : ProviderJobState.Running;
        return Task.FromResult(ProviderJobStatus.Of(state));
    }

    public async Task<VisualizedImage> GetResultAsync(string providerRequestId, CancellationToken cancellationToken) =>
        new(await storage.ReadAsync(Parse(providerRequestId), null, cancellationToken), "image/jpeg", "jpg", AiCost.None(FakeModel));

    /// <summary>The storage key of the silhouette the order was made for.</summary>
    private static string Parse(string providerRequestId)
    {
        // The digest is hex, so the first dash after the prefix ends it; the key after it may hold dashes of its own.
        var separator = providerRequestId.IndexOf('-', IdPrefix.Length);
        if (!providerRequestId.StartsWith(IdPrefix, StringComparison.Ordinal) || separator < 0)
        {
            throw new ProviderException("The order is not one this provider made.");
        }

        try
        {
            return Encoding.UTF8.GetString(Base64Url.DecodeFromChars(providerRequestId.AsSpan(separator + 1)));
        }
        catch (FormatException exception)
        {
            throw new ProviderException("The order is not one this provider made.", exception);
        }
    }
}
