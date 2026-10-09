using FitIt.Core.Wardrobe;

namespace FitIt.Core.Visualizations;

/// <summary>
/// What the image model is given (product spec 7.4): the text made from the repository's template and the garments'
/// descriptions, the silhouette (image 1) and the garments' cutouts in the order of the roles (images 2 and on), each
/// as a short-lived signed address. Never anything the person typed.
/// </summary>
public sealed record VisualizationInput(string Prompt, ImageSource Silhouette, IReadOnlyList<ImageSource> Garments);

public enum ProviderJobState
{
    Queued,
    Running,
    Completed,

    /// <summary>The provider's safety filter refused to make the image.</summary>
    Blocked,

    Failed,
}

/// <summary>Where the provider's order stands. <see cref="Cost"/> is what a finished or refused order cost, when the provider says.</summary>
public sealed record ProviderJobStatus(ProviderJobState State, AiCost? Cost = null)
{
    public static ProviderJobStatus Of(ProviderJobState state) => new(state);
}

public sealed record VisualizedImage(byte[] Content, string ContentType, string Extension, AiCost Cost);

/// <summary>
/// The image model behind a queue (product spec 7.2). An order is sent once and answered later, so the port has three
/// calls: send, ask where it stands, fetch the picture. A content-filter refusal is a state, not an exception.
/// </summary>
public interface IOutfitVisualizer
{
    /// <summary>The provider's name for the model, stored with the order.</summary>
    string Model { get; }

    /// <summary>Sends the order and returns the provider's id for it.</summary>
    /// <exception cref="ProviderException">The provider did not accept the order.</exception>
    Task<string> SubmitAsync(VisualizationInput input, CancellationToken cancellationToken);

    /// <exception cref="ProviderException">The provider could not say; asking again is safe.</exception>
    Task<ProviderJobStatus> GetStatusAsync(string providerRequestId, CancellationToken cancellationToken);

    /// <summary>The picture of an order whose state is <see cref="ProviderJobState.Completed"/>.</summary>
    /// <exception cref="ProviderException">The provider has no usable picture; asking again is safe.</exception>
    Task<VisualizedImage> GetResultAsync(string providerRequestId, CancellationToken cancellationToken);
}
