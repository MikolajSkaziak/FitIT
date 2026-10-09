using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Wardrobe;

namespace FitIt.Tests.Support;

/// <summary>The fake colour analyst, which a test can make fail and whose calls it can count.</summary>
public sealed class ScriptedColorAnalyst(InMemoryImageStorage storage) : IColorAnalyst
{
    private readonly FakeColorAnalyst _inner = new(storage);
    private readonly Lock _gate = new();
    private int _failures;

    public int Calls { get; private set; }

    /// <summary>Whether the selfie was still in storage while the analyst was looking at it.</summary>
    public bool? PhotoWasThere { get; private set; }

    public ScriptedColorAnalyst Reset()
    {
        lock (_gate)
        {
            _failures = 0;
            Calls = 0;
            PhotoWasThere = null;
        }

        return this;
    }

    public ScriptedColorAnalyst Fails(int times = 1)
    {
        lock (_gate)
        {
            _failures = times;
        }

        return this;
    }

    public Task<ColorAnalysisOutcome> AnalyzeAsync(ColorAnalysisRequest request, CancellationToken cancellationToken)
    {
        bool fail;
        lock (_gate)
        {
            Calls++;
            PhotoWasThere = request.Photo is { } photo ? storage.Contains(photo.Key) : null;
            fail = _failures > 0;
            if (fail)
            {
                _failures--;
            }
        }

        return fail ? throw new ProviderException("The color model is down.") : _inner.AnalyzeAsync(request, cancellationToken);
    }
}
