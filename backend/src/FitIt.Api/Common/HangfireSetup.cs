using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Jobs;
using FitIt.Infrastructure.Wardrobe;
using Hangfire;
using Hangfire.Dashboard;
using Hangfire.PostgreSql;

namespace FitIt.Api.Common;

internal static class HangfireSetup
{
    /// <summary>
    /// Background jobs on the same PostgreSQL, in their own schema. With <c>Hangfire:Enabled=false</c> (tests) jobs are only
    /// recorded and the caller decides when to run them.
    /// </summary>
    public static bool AddBackgroundJobs(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<MaintenanceJobs>();
        if (!builder.Configuration.GetValue("Hangfire:Enabled", true))
        {
            builder.Services.AddSingleton<RecordingBackgroundJobs>();
            builder.Services.AddSingleton<IBackgroundJobs>(provider => provider.GetRequiredService<RecordingBackgroundJobs>());
            return false;
        }

        builder.Services.AddHangfire((provider, configuration) => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            // Hangfire retries ten times by default; a failing provider should give up sooner and leave a clear state.
            .UseFilter(new AutomaticRetryAttribute { Attempts = 3 })
            .UsePostgreSqlStorage(
                storage => storage.UseNpgsqlConnection(provider.GetRequiredService<IConfiguration>().GetConnectionString("Database")),
                new PostgreSqlStorageOptions { SchemaName = "hangfire" }));
        builder.Services.AddHangfireServer(options => options.WorkerCount = builder.Configuration.GetValue("Hangfire:Workers", 4));
        builder.Services.AddSingleton<IBackgroundJobs, HangfireBackgroundJobs>();
        return true;
    }

    public static void UseBackgroundJobs(this WebApplication app)
    {
        var user = app.Configuration["Hangfire:DashboardUser"];
        var password = app.Configuration["Hangfire:DashboardPassword"];
        if (!string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(password))
        {
            app.MapHangfireDashboard("/hangfire", new DashboardOptions
            {
                Authorization = [new BasicAuthDashboardFilter(user, password)],
                DisplayStorageConnectionString = false,
            });
        }

        var recurring = app.Services.GetRequiredService<IRecurringJobManager>();
        var zone = new RecurringJobOptions { TimeZone = app.Services.GetRequiredService<AppClock>().Zone };
        recurring.AddOrUpdate<MaintenanceJobs>("heartbeat", job => job.HeartbeatAsync(), Cron.Hourly());
        recurring.AddOrUpdate<WardrobeMaintenance>("wardrobe-requeue", job => job.RequeueWaitingAsync(), "*/5 * * * *");
        recurring.AddOrUpdate<WardrobeMaintenance>("wardrobe-orphans", job => job.RemoveOrphansAsync(), "30 3 * * *", zone);
    }
}

/// <summary>The dashboard is for the administrator only: HTTP Basic credentials from configuration, compared in constant time.</summary>
internal sealed class BasicAuthDashboardFilter(string user, string password) : IDashboardAuthorizationFilter
{
    private readonly byte[] _expected = Encoding.UTF8.GetBytes($"{user}:{password}");

    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        if (AuthenticationHeaderValue.TryParse(http.Request.Headers.Authorization, out var header)
            && string.Equals(header.Scheme, "Basic", StringComparison.OrdinalIgnoreCase)
            && header.Parameter is { } parameter)
        {
            try
            {
                if (CryptographicOperations.FixedTimeEquals(Convert.FromBase64String(parameter), _expected))
                {
                    return true;
                }
            }
            catch (FormatException)
            {
                // Not base64: fall through to the challenge.
            }
        }

        http.Response.Headers.WWWAuthenticate = "Basic realm=\"FitIt jobs\", charset=\"UTF-8\"";
        http.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return false;
    }
}
