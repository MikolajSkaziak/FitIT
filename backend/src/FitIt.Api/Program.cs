using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Api.Endpoints;
using FitIt.Infrastructure;
using FitIt.Infrastructure.Accounts;
using FitIt.Infrastructure.Common;
using FitIt.Infrastructure.Persistence;
using FitIt.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;

// The host machine may run in pl-PL, where "52.2" formats as "52,2". Nothing in this service is locale dependent.
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, logger) => logger
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture));

var ephemeralSigningKey = false;
if (builder.Environment.IsDevelopment() && string.IsNullOrEmpty(builder.Configuration["Jwt:SigningKey"]))
{
    // Development only: sessions survive through the refresh token, so a new key per start is merely a re-login of access tokens.
    builder.Configuration["Jwt:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    ephemeralSigningKey = true;
}

builder.Services.AddFitItInfrastructure(builder.Configuration, builder.Environment);
var backgroundWorker = builder.AddBackgroundJobs();

builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<LinkBuilder>();
builder.Services.AddScoped<ResponseMapper>();
builder.Services.AddScoped<ClothingMapper>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false));

    // Numbers are numbers: the web default also accepts "12", which would make every number in the contract "number or string".
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    // Field names in validation errors follow the JSON the client sent ("location.lat"), not the C# members.
    if (context.ProblemDetails is HttpValidationProblemDetails validation)
    {
        validation.Errors = validation.Errors.ToDictionary(
            entry => string.Join('.', entry.Key.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName)),
            entry => entry.Value,
            StringComparer.Ordinal);
    }

    // Errors raised by the framework itself (validation, 401, 404, 500) get a code too, so the app can always switch on it.
    if (!context.ProblemDetails.Extensions.ContainsKey("code"))
    {
        context.ProblemDetails.Extensions["code"] = context.ProblemDetails.Status switch
        {
            StatusCodes.Status400BadRequest => context.ProblemDetails is HttpValidationProblemDetails ? "validation_failed" : "bad_request",
            StatusCodes.Status401Unauthorized => "unauthorized",
            StatusCodes.Status403Forbidden => "forbidden",
            StatusCodes.Status404NotFound => "not_found",
            StatusCodes.Status405MethodNotAllowed => "method_not_allowed",
            StatusCodes.Status415UnsupportedMediaType => "unsupported_media_type",
            StatusCodes.Status429TooManyRequests => "rate_limited",
            _ => "server_error",
        };
    }
});
builder.Services.AddValidation();
builder.Services.AddOpenApi();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>, TimeProvider>((bearer, jwtOptions, timeProvider) =>
    {
        var jwt = jwtOptions.Value;
        var skew = TimeSpan.FromSeconds(30);
        bearer.MapInboundClaims = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.KeyFrom(jwt.SigningKey),
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = JwtRegisteredClaimNames.Sub,
            ClockSkew = skew,
            // The injected clock decides, so tests can move time and production has one source of "now".
            LifetimeValidator = (notBefore, expires, _, _) =>
            {
                var now = timeProvider.GetUtcNow().UtcDateTime;
                return (notBefore is null || notBefore <= now + skew) && expires is not null && expires > now - skew;
            },
        };
    });
builder.Services.AddAuthorization();

var authPerMinute = builder.Configuration.GetValue("RateLimits:AuthPerMinute", 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        var problems = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context.HttpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too many requests. Try again in a minute.",
                Extensions = { ["code"] = "rate_limited" },
            },
        });
    };
    options.AddPolicy(AccountEndpoints.AuthRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var app = builder.Build();

if (ephemeralSigningKey)
{
    app.Logger.LogWarning("Jwt:SigningKey is not set; using a key generated for this run. Set it with `dotnet user-secrets set Jwt:SigningKey <value>` to keep access tokens across restarts.");
}

await using (var scope = app.Services.CreateAsyncScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
    {
        await initializer.MigrateAsync(app.Lifetime.ApplicationStopping);
    }

    await initializer.SeedAvatarsAsync(app.Lifetime.ApplicationStopping);
}

// Local development: the storage server starts empty, so the bucket is made here. In production it is created by hand, once.
if (app.Configuration.GetValue("Storage:CreateBucket", false) && app.Services.GetService<S3ImageStorage>() is { } s3)
{
    await s3.EnsureBucketAsync(app.Lifetime.ApplicationStopping);
}

app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
if (app.Environment.IsDevelopment())
{
    app.MapScalarApiReference();
}

app.MapGet("/health", async (AppDbContext db, CancellationToken cancellationToken) =>
        await db.Database.CanConnectAsync(cancellationToken)
            ? Results.Ok(new HealthResponse("ok"))
            : Results.Json(new HealthResponse("database_unreachable"), statusCode: StatusCodes.Status503ServiceUnavailable))
    .WithTags("Stan").WithName("health")
    .Produces<HealthResponse>().Produces<HealthResponse>(StatusCodes.Status503ServiceUnavailable);

app.MapAccountEndpoints();
app.MapWardrobeEndpoints();

if (backgroundWorker)
{
    app.UseBackgroundJobs();
}
else
{
    app.Logger.LogWarning("Hangfire is switched off: background jobs are recorded but do not run on their own.");
}

await app.RunAsync();

/// <summary>Exposed so the test host can start the application.</summary>
public partial class Program;
