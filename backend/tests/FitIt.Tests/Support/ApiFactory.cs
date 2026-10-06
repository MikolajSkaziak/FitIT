using FitIt.Infrastructure.Persistence;
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
        builder.UseSetting("Providers:LocationSearch", "Fake");
        builder.UseSetting("Hangfire:Enabled", "false");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
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
