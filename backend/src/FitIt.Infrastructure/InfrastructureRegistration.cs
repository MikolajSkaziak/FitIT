using System.Text;
using FitIt.Core.Accounts;
using FitIt.Core.Styling;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Accounts;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Fal;
using FitIt.Infrastructure.Gemini;
using FitIt.Infrastructure.Identity;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Storage;
using FitIt.Infrastructure.Styling;
using FitIt.Infrastructure.Usage;
using FitIt.Infrastructure.Visualizations;
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
        services.AddOptions<VisualizationOptions>().Bind(configuration.GetSection(VisualizationOptions.Section)).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<StorageOptions>().Bind(configuration.GetSection(StorageOptions.Section)).ValidateDataAnnotations().ValidateOnStart();

        services.AddOptions<WeatherRules>().Bind(configuration.GetSection(WeatherRules.Section))
            .Validate(rules => rules.AreConsistent(), "Weather: the temperature bands must descend and the hours must describe one day.")
            .ValidateOnStart();

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<AppClock>();
        services.AddScoped<PersonalCalendar>();

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
        services.AddScoped<PasswordService>();
        services.AddScoped<PasswordResetService>();
        services.AddScoped<AccountService>();
        services.AddScoped<ColorAnalysisService>();
        services.AddScoped<AccountCleanup>();
        services.AddScoped<DatabaseInitializer>();
        services.AddScoped<UsageCounters>();
        services.AddScoped<AiLedger>();
        services.AddScoped<WardrobeService>();
        services.AddScoped<StarterPieceService>();
        services.AddScoped<ClothingProcessor>();
        services.AddScoped<WardrobeMaintenance>();
        services.AddMemoryCache();
        services.AddScoped<WeatherService>();
        services.AddScoped<StylistService>();
        services.AddScoped<OutfitService>();
        services.AddScoped<CalendarService>();
        services.AddScoped<OutfitBuilderService>();
        services.AddScoped<VisualizationFiles>();
        services.AddScoped<SilhouetteStore>();
        services.AddScoped<VisualizationService>();
        services.AddScoped<VisualizationReportService>();
        services.AddScoped<VisualizationProcessor>();
        services.AddScoped<VisualizationMaintenance>();

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

        if (Use(providers.Weather, "Providers:Weather", providers, environment))
        {
            services.AddSingleton<FakeWeather>();
            services.AddSingleton<IWeatherProvider>(provider => provider.GetRequiredService<FakeWeather>());
        }
        else
        {
            services.AddHttpClient<IWeatherProvider, OpenMeteoWeather>(client =>
            {
                client.BaseAddress = new Uri(OpenMeteoWeather.BaseAddress);
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

        AddAiProviders(services, configuration, providers);

        if (Use(providers.BackgroundRemover, "Providers:BackgroundRemover", providers, environment))
        {
            services.AddScoped<IBackgroundRemover, FakeBackgroundRemover>();
        }
        else if (Is(providers.BackgroundRemover, ProviderOptions.Fal))
        {
            services.AddScoped<IBackgroundRemover, FalBackgroundRemover>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:BackgroundRemover is '{providers.BackgroundRemover}', but only 'Fal' and 'Fake' exist.");
        }

        if (Use(providers.GarmentTagger, "Providers:GarmentTagger", providers, environment))
        {
            services.AddScoped<IGarmentTagger, FakeGarmentTagger>();
        }
        else if (Is(providers.GarmentTagger, ProviderOptions.Gemini))
        {
            services.AddScoped<IGarmentTagger, GeminiGarmentTagger>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:GarmentTagger is '{providers.GarmentTagger}', but only 'Gemini' and 'Fake' exist.");
        }

        if (Use(providers.ColorAnalyst, "Providers:ColorAnalyst", providers, environment))
        {
            services.AddScoped<IColorAnalyst, FakeColorAnalyst>();
        }
        else if (Is(providers.ColorAnalyst, ProviderOptions.Gemini))
        {
            services.AddScoped<IColorAnalyst, GeminiColorAnalyst>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:ColorAnalyst is '{providers.ColorAnalyst}', but only 'Gemini' and 'Fake' exist.");
        }

        if (Use(providers.OutfitStylist, "Providers:OutfitStylist", providers, environment))
        {
            services.AddSingleton<IOutfitStylist, FakeOutfitStylist>();
        }
        else if (Is(providers.OutfitStylist, ProviderOptions.Gemini))
        {
            services.AddScoped<IOutfitStylist, GeminiOutfitStylist>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:OutfitStylist is '{providers.OutfitStylist}', but only 'Gemini' and 'Fake' exist.");
        }

        if (Use(providers.OutfitCritic, "Providers:OutfitCritic", providers, environment))
        {
            services.AddSingleton<IOutfitCritic, FakeOutfitCritic>();
        }
        else if (Is(providers.OutfitCritic, ProviderOptions.Gemini))
        {
            services.AddScoped<IOutfitCritic, GeminiOutfitCritic>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:OutfitCritic is '{providers.OutfitCritic}', but only 'Gemini' and 'Fake' exist.");
        }

        if (Use(providers.OutfitVisualizer, "Providers:OutfitVisualizer", providers, environment))
        {
            services.AddSingleton<FakeOutfitVisualizer>();
            services.AddSingleton<IOutfitVisualizer>(provider => provider.GetRequiredService<FakeOutfitVisualizer>());
        }
        else if (Is(providers.OutfitVisualizer, ProviderOptions.Fal))
        {
            services.AddScoped<IOutfitVisualizer, FalOutfitVisualizer>();
        }
        else
        {
            throw new InvalidOperationException($"Providers:OutfitVisualizer is '{providers.OutfitVisualizer}', but only 'Fal' and 'Fake' exist.");
        }

        if (Use(providers.Email, "Providers:Email", providers, environment))
        {
            services.AddSingleton<FakeEmailSender>();
            services.AddSingleton<IEmailSender>(provider => provider.GetRequiredService<FakeEmailSender>());
        }
        else
        {
            throw new InvalidOperationException($"Providers:Email is '{providers.Email}', but only 'Fake' exists so far.");
        }

        return services;
    }

    private static bool Is(string setting, string provider) => string.Equals(setting, provider, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// The clients of the real AI providers. Their keys come from configuration only (user-secrets in development, the
    /// environment in production); a provider that is switched on without its key stops the application at startup. The HTTP
    /// clients write nothing to the log and, should logging ever be put back, never the headers that carry the keys.
    /// </summary>
    private static void AddAiProviders(IServiceCollection services, IConfiguration configuration, ProviderOptions providers)
    {
        string[] secretHeaders = ["Authorization", GeminiClient.KeyHeader];
        services.AddScoped<IAiBudget>(provider => provider.GetRequiredService<AiLedger>());

        var gemini = new[] { providers.GarmentTagger, providers.OutfitStylist, providers.OutfitCritic, providers.ColorAnalyst }.Any(setting => Is(setting, ProviderOptions.Gemini));
        services.AddOptions<GeminiOptions>().Bind(configuration.GetSection(GeminiOptions.Section))
            .ValidateDataAnnotations()
            .Validate(o => !gemini || !string.IsNullOrWhiteSpace(o.ApiKey), "Gemini:ApiKey is missing although a provider is set to 'Gemini'. Set it with `dotnet user-secrets set Gemini:ApiKey <key>` or the environment variable Gemini__ApiKey.")
            .ValidateOnStart();
        // The client keeps its own deadline across retries and the fallback model.
        services.AddHttpClient<GeminiClient>(client => client.Timeout = Timeout.InfiniteTimeSpan)
            .RemoveAllLoggers()
            .RedactLoggedHeaders(secretHeaders);

        var fal = new[] { providers.BackgroundRemover, providers.OutfitVisualizer }.Any(setting => Is(setting, ProviderOptions.Fal));
        services.AddOptions<FalOptions>().Bind(configuration.GetSection(FalOptions.Section))
            .ValidateDataAnnotations()
            .Validate(o => !fal || !string.IsNullOrWhiteSpace(o.ApiKey), "Fal:ApiKey is missing although a provider is set to 'Fal'. Set it with `dotnet user-secrets set Fal:ApiKey <key>` or the environment variable Fal__ApiKey.")
            .ValidateOnStart();
        services.AddHttpClient<FalClient>(client => client.Timeout = TimeSpan.FromSeconds(60))
            .RemoveAllLoggers()
            .RedactLoggedHeaders(secretHeaders);
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
