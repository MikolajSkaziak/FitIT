using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Accounts;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Visualizations;
using FitIt.Infrastructure.Wardrobe;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;

namespace FitIt.Tests.Support;

/// <summary>
/// The real application on a real PostgreSQL in a container, with a clock the tests control and fakes for outside services.
/// One instance is shared by every test class in the <see cref="ApiTests"/> collection.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:18-alpine").Build();

    /// <summary>Starts on a Tuesday morning; tests move it forward and must not assume the exact value.</summary>
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 10, 6, 8, 0, 0, TimeSpan.Zero));

    public Task InitializeAsync() => _database.StartAsync();

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // UseSetting, unlike ConfigureAppConfiguration, is visible to the values Program reads while it is still building.
        builder.UseSetting("ConnectionStrings:Database", _database.GetConnectionString());
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Jwt:SigningKey", "test-only-signing-key-0123456789-0123456789");
        builder.UseSetting("RateLimits:AuthPerMinute", "100000");
        builder.UseSetting("RateLimits:PasswordResetPer15Minutes", "100000");
        builder.UseSetting("RateLimits:ReportsPerHour", "100000");
        builder.UseSetting("RateLimits:StylistChatPerMinute", "100000");
        // The job schedules its own next poll; the test host runs jobs by hand and has no need to wait between them.
        builder.UseSetting("Visualization:PollIntervalSeconds", "0");
        builder.UseSetting("Providers:LocationSearch", "Fake");
        builder.UseSetting("Providers:ImageStorage", "Fake");
        builder.UseSetting("Providers:Weather", "Fake");
        builder.UseSetting("Hangfire:Enabled", "false");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<IBackgroundRemover>();
            services.RemoveAll<IGarmentTagger>();
            services.AddSingleton(Ai);
            services.AddSingleton<IBackgroundRemover>(Ai);
            services.AddSingleton<IGarmentTagger>(Ai);
            services.RemoveAll<FitIt.Core.Accounts.IColorAnalyst>();
            services.AddSingleton<ScriptedColorAnalyst>();
            services.AddSingleton<FitIt.Core.Accounts.IColorAnalyst>(provider => provider.GetRequiredService<ScriptedColorAnalyst>());
            services.RemoveAll<FitIt.Core.Styling.IOutfitStylist>();
            services.AddSingleton(Stylist);
            services.AddSingleton<FitIt.Core.Styling.IOutfitStylist>(Stylist);
            services.RemoveAll<IOutfitVisualizer>();
            services.AddSingleton(Visualizer);
            services.AddSingleton<IOutfitVisualizer>(Visualizer);
        });
    }

    /// <summary>The AI providers of every host built from this factory. Tests script failures here; reset it first.</summary>
    public ScriptedAi Ai { get; } = new();

    /// <summary>The colour analyst of every host built from this factory; a test makes it fail here, after a reset.</summary>
    public ScriptedColorAnalyst Colors => Services.GetRequiredService<ScriptedColorAnalyst>();

    /// <summary>The stylist model of every host built from this factory. Tests script its answers here; reset it first.</summary>
    public ScriptedStylist Stylist { get; } = new();

    /// <summary>The image provider of every host built from this factory. Tests script its answers here; reset it first.</summary>
    public ScriptedVisualizer Visualizer { get; } = new();

    /// <summary>The mail service of every host built from this factory: what it was asked to send is kept here.</summary>
    public FakeEmailSender Email => Services.GetRequiredService<FakeEmailSender>();

    /// <summary>The storage the phone would upload to. A test plays the phone with <see cref="InMemoryImageStorage.Put"/>.</summary>
    public InMemoryImageStorage Storage => Services.GetRequiredService<InMemoryImageStorage>();

    /// <summary>The weather of every place. Tests set the day they need; reset it first.</summary>
    public FitIt.Infrastructure.Weather.FakeWeather Weather => Services.GetRequiredService<FitIt.Infrastructure.Weather.FakeWeather>();

    /// <summary>The default day again and no kept forecasts, so a test gets exactly the weather it sets next.</summary>
    public FitIt.Infrastructure.Weather.FakeWeather FreshWeather()
    {
        (Services.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>() as Microsoft.Extensions.Caching.Memory.MemoryCache)?.Clear();
        Weather.Reset();
        return Weather;
    }

    public RecordingBackgroundJobs Jobs => Services.GetRequiredService<RecordingBackgroundJobs>();

    /// <summary>Runs the processing job for one garment once, the way the worker would. Provider failures surface as exceptions, as they do for the worker.</summary>
    public async Task ProcessAsync(Guid itemId, IServiceProvider? services = null)
    {
        await using var scope = (services ?? Services).CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ClothingProcessor>().RunAsync(itemId);
    }

    /// <summary>Runs the visualization job for one order once, the way the worker would. Whatever it throws surfaces, as it does for the worker.</summary>
    public async Task RunVisualizationAsync(Guid id, IServiceProvider? services = null)
    {
        await using var scope = (services ?? Services).CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<VisualizationProcessor>().RunAsync(id);
    }

    public async Task<T> WithServicesAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        await using var scope = Services.CreateAsyncScope();
        return await work(scope.ServiceProvider);
    }

    /// <summary>Runs <paramref name="work"/> against the database in its own scope, for assertions on stored rows.</summary>
    public async Task<T> WithDatabaseAsync<T>(Func<AppDbContext, Task<T>> work)
    {
        await using var scope = Services.CreateAsyncScope();
        return await work(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
}

[CollectionDefinition(Name)]
public sealed class ApiTests : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
