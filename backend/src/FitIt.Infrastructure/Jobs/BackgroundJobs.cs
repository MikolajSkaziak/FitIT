using System.Collections.Concurrent;
using System.Linq.Expressions;
using Hangfire;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FitIt.Infrastructure.Jobs;

/// <summary>Hands work to the background. Call sites look the same whether Hangfire or a test double runs the job.</summary>
public interface IBackgroundJobs
{
    void Enqueue<TJob>(Expression<Func<TJob, Task>> work) where TJob : notnull;

    void Schedule<TJob>(Expression<Func<TJob, Task>> work, TimeSpan delay) where TJob : notnull;
}

public sealed class HangfireBackgroundJobs(IBackgroundJobClient client) : IBackgroundJobs
{
    public void Enqueue<TJob>(Expression<Func<TJob, Task>> work) where TJob : notnull => client.Enqueue(work);

    public void Schedule<TJob>(Expression<Func<TJob, Task>> work, TimeSpan delay) where TJob : notnull => client.Schedule(work, delay);
}

/// <summary>
/// Keeps enqueued jobs in memory until <see cref="RunPendingAsync"/> is called. Used by the tests, and as a visible
/// stand-in when Hangfire is switched off: jobs are then recorded but never run on their own.
/// </summary>
public sealed class RecordingBackgroundJobs(IServiceScopeFactory scopes, ILogger<RecordingBackgroundJobs> logger) : IBackgroundJobs
{
    private readonly ConcurrentQueue<Func<IServiceProvider, Task>> _pending = new();

    public int PendingCount => _pending.Count;

    public void Enqueue<TJob>(Expression<Func<TJob, Task>> work) where TJob : notnull
    {
        var run = work.Compile();
        _pending.Enqueue(provider => run(provider.GetRequiredService<TJob>()));
        if (logger.IsEnabled(LogLevel.Debug))
        {
            logger.LogDebug("Recorded a {Job} job", typeof(TJob).Name);
        }
    }

    public void Schedule<TJob>(Expression<Func<TJob, Task>> work, TimeSpan delay) where TJob : notnull => Enqueue(work);

    /// <summary>Runs every recorded job once, each in its own scope, including jobs enqueued by the jobs themselves.</summary>
    public async Task<int> RunPendingAsync()
    {
        var count = 0;
        while (_pending.TryDequeue(out var job))
        {
            await using var scope = scopes.CreateAsyncScope();
            await job(scope.ServiceProvider);
            count++;
        }

        return count;
    }

    public void Clear() => _pending.Clear();
}

/// <summary>Housekeeping that runs on a schedule.</summary>
public sealed class MaintenanceJobs(ILogger<MaintenanceJobs> logger)
{
    /// <summary>Proves the worker is alive; visible in the dashboard and in the log once an hour.</summary>
    public Task HeartbeatAsync()
    {
        logger.LogInformation("Background worker heartbeat");
        return Task.CompletedTask;
    }
}
