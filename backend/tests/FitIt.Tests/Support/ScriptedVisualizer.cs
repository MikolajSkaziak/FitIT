using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;

namespace FitIt.Tests.Support;

/// <summary>
/// An image provider whose behaviour a test writes in advance: each call takes the next step from the script and, when the
/// script is empty, the order is done at once and the picture is a small JPEG. Every call is counted and every order kept.
/// </summary>
public sealed class ScriptedVisualizer : IOutfitVisualizer
{
    public const string ModelName = "scripted-visualizer";

    /// <summary>What the provider costs per picture unless a test says otherwise.</summary>
    public const decimal PictureCost = 0.08m;

    private readonly Queue<Func<string>> _submits = new();
    private readonly Queue<Func<ProviderJobStatus>> _statuses = new();
    private readonly Queue<Func<VisualizedImage>> _results = new();
    private readonly Lock _gate = new();

    public string Model => ModelName;

    public int SubmitCalls { get; private set; }

    public int StatusCalls { get; private set; }

    public int ResultCalls { get; private set; }

    /// <summary>The orders that were accepted, in order. Each one is what the provider would have seen.</summary>
    public List<VisualizationInput> Orders { get; } = [];

    /// <summary>Forgets scripts and counts left by an earlier test. Returns itself so a script can follow in one line.</summary>
    public ScriptedVisualizer Reset()
    {
        lock (_gate)
        {
            _submits.Clear();
            _statuses.Clear();
            _results.Clear();
            Orders.Clear();
            (SubmitCalls, StatusCalls, ResultCalls) = (0, 0, 0);
        }

        return this;
    }

    public ScriptedVisualizer SubmitFails(int times = 1) =>
        Script(_submits, times, () => throw new ProviderException("The image service is down.") { Cost = new AiCost(ModelName, 0m) });

    /// <summary>The next poll finds the order still being made, this many times in a row.</summary>
    public ScriptedVisualizer StaysRunning(int polls = 1) => Script(_statuses, polls, () => ProviderJobStatus.Of(ProviderJobState.Running));

    public ScriptedVisualizer Queued(int polls = 1) => Script(_statuses, polls, () => ProviderJobStatus.Of(ProviderJobState.Queued));

    public ScriptedVisualizer Completes(decimal cost = PictureCost) => Script(_statuses, 1, () => new ProviderJobStatus(ProviderJobState.Completed, new AiCost(ModelName, cost)))
        .Script(_results, 1, () => new VisualizedImage(TestApi.Jpeg(512), "image/jpeg", "jpg", new AiCost(ModelName, cost)));

    /// <summary>The safety filter refuses. A refused order may still cost something.</summary>
    public ScriptedVisualizer Blocks(decimal cost = 0m) => Script(_statuses, 1, () => new ProviderJobStatus(ProviderJobState.Blocked, new AiCost(ModelName, cost)));

    /// <summary>The provider reports that it could not make the picture.</summary>
    public ScriptedVisualizer ReportsFailure() => Script(_statuses, 1, () => ProviderJobStatus.Of(ProviderJobState.Failed));

    /// <summary>The next poll blows up in a way the job does not expect, as a crashed worker would.</summary>
    /// <summary>The order is done, and something happens at the very moment the job asks for the picture (the outfit is deleted, say).</summary>
    public ScriptedVisualizer CompletesAfter(Func<Task> meanwhile) => Script(_statuses, 1, () => ProviderJobStatus.Of(ProviderJobState.Completed))
        .Script(_results, 1, () =>
        {
            meanwhile().GetAwaiter().GetResult();
            return new VisualizedImage(TestApi.Jpeg(512), "image/jpeg", "jpg", new AiCost(ModelName, PictureCost));
        });

    public ScriptedVisualizer PollCrashes() => Script(_statuses, 1, () => throw new InvalidOperationException("The worker was killed mid-poll."));

    public ScriptedVisualizer PollFails() => Script(_statuses, 1, () => throw new ProviderException("The provider could not say."));

    /// <summary>The order is done but what the provider hands over is not a picture.</summary>
    public ScriptedVisualizer ReturnsGarbage() => Script(_statuses, 1, () => ProviderJobStatus.Of(ProviderJobState.Completed))
        .Script(_results, 1, () => new VisualizedImage("<html>502 Bad Gateway</html>"u8.ToArray(), "image/jpeg", "jpg", new AiCost(ModelName, 0m)));

    public Task<string> SubmitAsync(VisualizationInput input, CancellationToken cancellationToken)
    {
        Func<string>? step;
        lock (_gate)
        {
            SubmitCalls++;
            _submits.TryDequeue(out step);
        }

        // A refused order is not an order: the provider never saw it.
        var id = step?.Invoke() ?? $"scripted-{Guid.NewGuid():N}";
        lock (_gate)
        {
            Orders.Add(input);
        }

        return Task.FromResult(id);
    }

    public Task<ProviderJobStatus> GetStatusAsync(string providerRequestId, CancellationToken cancellationToken)
    {
        Func<ProviderJobStatus>? step;
        lock (_gate)
        {
            StatusCalls++;
            _statuses.TryDequeue(out step);
        }

        return Task.FromResult(step?.Invoke() ?? new ProviderJobStatus(ProviderJobState.Completed, new AiCost(ModelName, PictureCost)));
    }

    public Task<VisualizedImage> GetResultAsync(string providerRequestId, CancellationToken cancellationToken)
    {
        Func<VisualizedImage>? step;
        lock (_gate)
        {
            ResultCalls++;
            _results.TryDequeue(out step);
        }

        return Task.FromResult(step?.Invoke() ?? new VisualizedImage(TestApi.Jpeg(512), "image/jpeg", "jpg", new AiCost(ModelName, PictureCost)));
    }

    private ScriptedVisualizer Script<T>(Queue<Func<T>> queue, int times, Func<T> step)
    {
        lock (_gate)
        {
            for (var i = 0; i < times; i++)
            {
                queue.Enqueue(step);
            }
        }

        return this;
    }
}
