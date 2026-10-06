using System.Buffers.Text;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FitIt.Infrastructure.Common;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FitIt.Infrastructure.Accounts;

public sealed record AuthTokens(string AccessToken, string RefreshToken, int ExpiresIn);

/// <summary>Issues short-lived access tokens and creates the random values used as refresh tokens.</summary>
public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider timeProvider)
{
    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public static SymmetricSecurityKey KeyFrom(string signingKey) => new(Encoding.UTF8.GetBytes(signingKey));

    public (string Token, int ExpiresIn) CreateAccessToken(Guid userId)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Subject = new ClaimsIdentity([new Claim(JwtRegisteredClaimNames.Sub, userId.ToString())]),
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(_options.AccessTokenMinutes),
            SigningCredentials = new SigningCredentials(KeyFrom(_options.SigningKey), SecurityAlgorithms.HmacSha256),
        };
        return (_handler.CreateToken(descriptor), _options.AccessTokenMinutes * 60);
    }

    /// <summary>32 random bytes as base64url. Only <see cref="Hash"/> of it is ever stored.</summary>
    public static string NewRefreshToken() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
