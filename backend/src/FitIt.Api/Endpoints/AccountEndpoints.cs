using FitIt.Api.Common;
using FitIt.Api.Contracts;
using FitIt.Core.Accounts;
using FitIt.Core.Common;
using FitIt.Core.Weather;
using FitIt.Infrastructure.Accounts;
using FitIt.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Api.Endpoints;

internal static class AccountEndpoints
{
    public const string AuthRateLimit = "auth";

    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/avatars", ListAvatars)
            .WithTags("Konto").WithName("listAvatars")
            .Produces<IReadOnlyList<AvatarResponse>>().ProducesProblem(400);

        app.MapGet("/api/locations", SearchLocations)
            .WithTags("Konto").WithName("searchLocations")
            .RequireRateLimiting(AuthRateLimit)
            .Produces<IReadOnlyList<PlaceResponse>>().ProducesProblem(400).ProducesProblem(503);

        var auth = app.MapGroup("/api/auth").WithTags("Konto").RequireRateLimiting(AuthRateLimit);
        auth.MapPost("/email-check", CheckEmail).WithName("checkEmail")
            .Produces<EmailCheckResponse>().ProducesValidationProblem();
        auth.MapPost("/register", Register).WithName("register")
            .Produces<AuthResponse>(StatusCodes.Status201Created).ProducesValidationProblem().ProducesProblem(409);
        auth.MapPost("/login", Login).WithName("login")
            .Produces<AuthResponse>().ProducesValidationProblem().ProducesProblem(401).ProducesProblem(429);
        auth.MapPost("/refresh", Refresh).WithName("refreshSession")
            .Produces<TokenResponse>().ProducesValidationProblem().ProducesProblem(401);
        auth.MapPost("/logout", Logout).WithName("logout")
            .RequireAuthorization()
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(401);

        var me = app.MapGroup("/api/me").WithTags("Konto").RequireAuthorization();
        me.MapGet("", GetProfile).WithName("getProfile")
            .Produces<UserResponse>().ProducesProblem(401);
        me.MapPatch("", UpdateProfile).WithName("updateProfile")
            .Produces<UserResponse>().ProducesValidationProblem().ProducesProblem(401);

        return app;
    }

    private static async Task<IResult> ListAvatars([FromQuery] string? gender, AppDbContext db, ResponseMapper mapper, CancellationToken cancellationToken)
    {
        var query = db.Avatars.AsNoTracking().Where(a => a.IsActive);
        if (gender is not null)
        {
            // Query values arrive as text; enum codes are snake case, which the framework's own enum binding does not read.
            if (!EnumCodes.TryParse<Gender>(gender, out var wanted))
            {
                return ApiError.BadRequest("gender_invalid", "The gender is not on the list.").ToProblem();
            }

            query = query.Where(a => a.Gender == wanted);
        }

        var avatars = await query.OrderBy(a => a.Gender).ThenBy(a => a.SortOrder).ToListAsync(cancellationToken);
        return TypedResults.Ok(avatars.Select(mapper.Map).ToList());
    }

    private static async Task<IResult> SearchLocations([FromQuery] string? query, ILocationSearch search, CancellationToken cancellationToken)
    {
        if (query is null || query.Trim().Length is < 2 or > 80)
        {
            return ApiError.BadRequest("query_invalid", "Type at least two letters of the place name.").ToProblem();
        }

        var found = await search.SearchAsync(query, cancellationToken);
        if (!found.IsOk)
        {
            return found.Error!.ToProblem();
        }

        // Districts of one town come back as separate hits; after rounding they are the same place for a forecast.
        var places = found.Value
            .Select(p => new PlaceResponse(p.Name, p.Region, p.Country, WeatherPlace.RoundCoordinate(p.Lat), WeatherPlace.RoundCoordinate(p.Lon)))
            .Distinct()
            .ToList();
        return TypedResults.Ok(places);
    }

    private static async Task<IResult> CheckEmail(EmailCheckRequest request, AuthService auth) =>
        TypedResults.Ok(new EmailCheckResponse(await auth.IsEmailAvailableAsync(request.Email)));

    private static async Task<IResult> Register(RegisterRequest request, AuthService auth, ResponseMapper mapper, CancellationToken cancellationToken)
    {
        var command = new RegisterCommand(
            request.Email,
            request.Password,
            request.DisplayName,
            request.BirthDate!.Value,
            request.Gender!.Value,
            request.AvatarId!.Value,
            [.. (request.Styles ?? []).Select(EnumCodes.ToCode)],
            request.ThermalPreference ?? ThermalPreference.Normal,
            request.Location?.ToPlace());
        var outcome = await auth.RegisterAsync(command, cancellationToken);
        if (!outcome.IsOk)
        {
            return outcome.Error!.ToProblem();
        }

        var (user, tokens) = outcome.Value;
        return TypedResults.Created("/api/me", new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn, mapper.Map(user)));
    }

    private static async Task<IResult> Login(LoginRequest request, AuthService auth, ResponseMapper mapper, CancellationToken cancellationToken)
    {
        var outcome = await auth.LoginAsync(request.Email, request.Password, cancellationToken);
        if (!outcome.IsOk)
        {
            return outcome.Error!.ToProblem();
        }

        var (user, tokens) = outcome.Value;
        return TypedResults.Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn, mapper.Map(user)));
    }

    private static async Task<IResult> Refresh(RefreshRequest request, AuthService auth, CancellationToken cancellationToken)
    {
        var outcome = await auth.RefreshAsync(request.RefreshToken, cancellationToken);
        return outcome.IsOk
            ? TypedResults.Ok(new TokenResponse(outcome.Value.AccessToken, outcome.Value.RefreshToken, outcome.Value.ExpiresIn))
            : outcome.Error!.ToProblem();
    }

    private static async Task<IResult> Logout(RefreshRequest request, HttpContext http, AuthService auth, CancellationToken cancellationToken)
    {
        await auth.LogoutAsync(http.User.UserId(), request.RefreshToken, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> GetProfile(HttpContext http, ProfileService profiles, ResponseMapper mapper, CancellationToken cancellationToken)
    {
        var user = await profiles.FindAsync(http.User.UserId(), cancellationToken);
        return user is null
            ? ApiError.Unauthorized("account_gone", "The account no longer exists.").ToProblem()
            : TypedResults.Ok(mapper.Map(user));
    }

    private static async Task<IResult> UpdateProfile(UpdateProfileRequest request, HttpContext http, ProfileService profiles, ResponseMapper mapper, CancellationToken cancellationToken)
    {
        var patch = new ProfilePatch
        {
            DisplayName = request.DisplayName,
            BirthDate = request.BirthDate,
            Gender = request.Gender,
            AvatarId = request.AvatarId,
            Styles = request.Styles is null ? null : [.. request.Styles.Select(EnumCodes.ToCode)],
            ThermalPreference = request.ThermalPreference,
            Place = request.Location?.ToPlace(),
            ClearPlace = request.ClearLocation == true,
            AiConsent = request.AiConsent,
        };
        var updated = await profiles.UpdateAsync(http.User.UserId(), patch, cancellationToken);
        return updated.IsOk ? TypedResults.Ok(mapper.Map(updated.Value)) : updated.Error!.ToProblem();
    }
}
