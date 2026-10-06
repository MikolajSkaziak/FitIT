using System.Text;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Accounts;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Wardrobe;
using FitIt.Infrastructure.Weather;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace FitIt.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddFitItInfrastructure(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddOptions<AppOptions>().Bind(configuration.GetSection(AppOptions.Section))
            .ValidateDataAnnotations()
            .Validate(o => TimeZoneInfo.TryFindSystemTimeZoneById(o.TimeZone, out _), "App:TimeZone is not a known time zone.")
            .ValidateOnStart();
        services.AddOptions<JwtOptions>().Bind(configuration.GetSection(JwtOptions.Section))
            .ValidateDataAnnotations()
            .Validate(o => Encoding.UTF8.GetByteCount(o.SigningKey) >= 32, "Jwt:SigningKey must be at least 32 bytes. Set it with user-secrets or the environment.")
            .ValidateOnStart();
        services.AddOptions<AccountOptions>().Bind(configuration.GetSection(AccountOptions.Section)).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<ProviderOptions>().Bind(configuration.GetSection(ProviderOptions.Section));
        services.AddOptions<LimitOptions>().Bind(configuration.GetSection(LimitOptions.Section)).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<StorageOptions>().Bind(configuration.GetSection(StorageOptions.Section)).ValidateDataAnnotations().ValidateOnStart();

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<AppClock>();

        // Read when the context is first built, not now: the test host adds its connection string after this method runs.
        services.AddDbContext<AppDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<IConfiguration>().GetConnectionString("Database")));
        services.AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequiredUniqueChars = 1;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddSingleton<TokenService>();
        services.AddScoped<AuthService>();
        services.AddScoped<ProfileService>();
        services.AddScoped<DatabaseInitializer>();
        services.AddScoped<UsageCounters>();
        services.AddScoped<AiLedger>();
        services.AddScoped<WardrobeService>();
        services.AddScoped<ClothingProcessor>();
        services.AddScoped<WardrobeMaintenance>();

        var providers = configuration.GetSection(ProviderOptions.Section).Get<ProviderOptions>() ?? new ProviderOptions();
        if (Use(providers.LocationSearch, "Providers:LocationSearch", providers, environment))
        {
            services.AddSingleton<ILocationSearch, FakeLocationSearch>();
        }
        else
        {
            services.AddHttpClient<ILocationSearch, OpenMeteoLocationSearch>(client =>
            {
                client.BaseAddress = new Uri(OpenMeteoLocationSearch.BaseAddress);
                client.Timeout = TimeSpan.FromSeconds(5);
            });
        }

        if (Use(providers.ImageStorage, "Providers:ImageStorage", providers, environment))
        {
            services.AddSingleton<InMemoryImageStorage>();
            services.AddSingleton<IImageStorage>(provider => provider.GetRequiredService<InMemoryImageStorage>());
        }
        else
        {
            services.AddSingleton<S3ImageStorage>();
            services.AddSingleton<IImageStorage>(provider => provider.GetRequiredService<S3ImageStorage>());
        }

        // The real adapters need provider keys and are added with them; until then the setting must say "Fake".
        if (Use(providers.BackgroundRemover, "Providers:BackgroundRemover", providers, environment))
        {
            services.AddScoped<IBackgroundRemover, FakeBackgroundRemover>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:BackgroundRemover is '{providers.BackgroundRemover}', but only 'Fake' exists so far.");
        }

        if (Use(providers.GarmentTagger, "Providers:GarmentTagger", providers, environment))
        {
            services.AddScoped<IGarmentTagger, FakeGarmentTagger>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:GarmentTagger is '{providers.GarmentTagger}', but only 'Fake' exists so far.");
        }

        return services;
    }

    /// <summary>True when the setting selects the fake. A fake in Production must be allowed explicitly.</summary>
    private static bool Use(string setting, string key, ProviderOptions providers, IHostEnvironment environment)
    {
        if (!string.Equals(setting, ProviderOptions.Fake, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (environment.IsProduction() && !providers.AllowFakesInProduction)
        {
            throw new InvalidOperationException($"{key} is set to a fake provider in Production. Configure the real provider or set Providers:AllowFakesInProduction.");
        }

        return true;
    }
}
