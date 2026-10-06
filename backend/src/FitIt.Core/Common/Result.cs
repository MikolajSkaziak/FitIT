namespace FitIt.Core.Common;

/// <summary>A failure the API reports as ProblemDetails: HTTP status, stable machine code, English title.</summary>
public sealed record ApiError(int Status, string Code, string Title, string? Detail = null)
{
    public IReadOnlyDictionary<string, object?>? Extensions { get; init; }

    public static ApiError BadRequest(string code, string title, string? detail = null) => new(400, code, title, detail);
    public static ApiError Unauthorized(string code, string title) => new(401, code, title);
    public static ApiError Forbidden(string code, string title) => new(403, code, title);
    public static ApiError NotFound(string code = "not_found", string title = "The resource does not exist.") => new(404, code, title);
    public static ApiError Conflict(string code, string title) => new(409, code, title);
    public static ApiError Unprocessable(string code, string title, string? detail = null) => new(422, code, title, detail);
    public static ApiError TooManyRequests(string code, string title) => new(429, code, title);
}

/// <summary>Either a value or an <see cref="ApiError"/>. Services return it instead of throwing for expected failures.</summary>
public readonly struct Result<T>
{
    private readonly T? _value;

    internal Result(T? value, ApiError? error)
    {
        _value = value;
        Error = error;
    }

    public ApiError? Error { get; }

    public bool IsOk => Error is null;

    public T Value => Error is null ? _value! : throw new InvalidOperationException($"Result holds an error: {Error.Code}");

    public static implicit operator Result<T>(T value) => new(value, null);

    public static implicit operator Result<T>(ApiError error) => new(default, error);
}

public static class Result
{
    /// <summary>Explicit form of the conversion; needed when the value is typed as an interface, where C# skips user-defined conversions.</summary>
    public static Result<T> Ok<T>(T value) => new(value, null);
}

/// <summary>Stands in for <c>void</c> in <see cref="Result{T}"/>.</summary>
public readonly record struct Unit
{
    public static readonly Unit Value;
}
