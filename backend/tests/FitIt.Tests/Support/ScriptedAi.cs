using FitIt.Core.Wardrobe;

namespace FitIt.Tests.Support;

/// <summary>
/// Background remover and tagger whose behaviour a test writes in advance: each call takes the next step from the
/// script and, when the script is empty, succeeds. Both count their calls.
/// </summary>
public sealed class ScriptedAi : IBackgroundRemover, IGarmentTagger
{
    public static readonly byte[] Cutout = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02];

    public static readonly GarmentTags Shirt = new(
        Category.Top, Subcategory.Shirt, "Navy oxford shirt", [Color.Navy], Pattern.Plain, Material.Cotton, 4, 2, false, [StyleTag.Smart, StyleTag.Elegant]);

    private readonly Queue<Func<BackgroundRemoval>> _removals = new();
    private readonly Queue<Func<TaggingOutcome>> _taggings = new();
    private readonly Lock _gate = new();

    public int RemoverCalls { get; private set; }

    public int TaggerCalls { get; private set; }

    /// <summary>The signed addresses the providers were handed, to check that nothing else leaks out.</summary>
    public List<ImageSource> Seen { get; } = [];

    /// <summary>Forgets scripts and counts left by an earlier test. Returns itself so a script can follow in one line.</summary>
    public ScriptedAi Reset()
    {
        lock (_gate)
        {
            _removals.Clear();
            _taggings.Clear();
            Seen.Clear();
            RemoverCalls = 0;
            TaggerCalls = 0;
        }

        return this;
    }

    public ScriptedAi RemovalFails(int times = 1) => Script(_removals, times, () => throw new ProviderException("The background service is down."));

    public ScriptedAi RemovalReturns(byte[] cutout) => Script(_removals, 1, () => new BackgroundRemoval(cutout, "image/png", "png", new AiCost("scripted-remover", 0m)));

    public ScriptedAi TaggingFails(int times = 1) => Script(_taggings, times, () => throw new ProviderException("The tagging model did not answer."));

    public ScriptedAi TaggingRefuses(RejectReason reason) => Script(_taggings, 1, () => TaggingOutcome.Refused(reason, new AiCost("scripted-tagger", 0.01m)));

    public ScriptedAi TaggingReturns(GarmentTags tags, string? description = null, decimal cost = 0m) =>
        Script(_taggings, 1, () => TaggingOutcome.Accepted(tags, description ?? "navy blue oxford cotton shirt, button-down collar", new AiCost("scripted-tagger", cost)));

    public Task<BackgroundRemoval> RemoveAsync(ImageSource photo, CancellationToken cancellationToken)
    {
        Func<BackgroundRemoval>? step;
        lock (_gate)
        {
            RemoverCalls++;
            Seen.Add(photo);
            _removals.TryDequeue(out step);
        }

        return Task.FromResult(step?.Invoke() ?? new BackgroundRemoval(Cutout, "image/png", "png", new AiCost("scripted-remover", 0m)));
    }

    public Task<TaggingOutcome> TagAsync(ImageSource cutout, CancellationToken cancellationToken)
    {
        Func<TaggingOutcome>? step;
        lock (_gate)
        {
            TaggerCalls++;
            Seen.Add(cutout);
            _taggings.TryDequeue(out step);
        }

        return Task.FromResult(step?.Invoke() ?? TaggingOutcome.Accepted(Shirt, "navy blue oxford cotton shirt, button-down collar", new AiCost("scripted-tagger", 0m)));
    }

    private ScriptedAi Script<T>(Queue<Func<T>> queue, int times, Func<T> step)
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
