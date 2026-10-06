/**
 * Errors as the API sends them: ProblemDetails with a stable machine `code`.
 * The app never shows the server's English text; it maps `code` to its own Polish copy (see copy/errors).
 */
export interface Problem {
  status: number;
  code: string;
  /** Field errors of a 400, keyed by the JSON path of the member ("location.lat"). */
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
}

/** A request that did not succeed. `problem.code` is `network` when the server could not be reached at all. */
export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(`API error ${problem.status} ${problem.code}`);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.problem.code;
  }
}

export const networkProblem: Problem = { status: 0, code: 'network' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toProblem(body: unknown, status: number): Problem {
  if (isRecord(body) && typeof body.code === 'string') {
    return { ...body, status, code: body.code } as Problem;
  }

  return { status, code: status === 401 ? 'unauthorized' : status === 429 ? 'rate_limited' : status >= 500 ? 'server_error' : 'bad_request' };
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Turns an openapi-fetch result into the data, or throws an {@link ApiError}. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    throw new ApiError(networkProblem);
  }

  if (!result.response.ok) {
    throw new ApiError(toProblem(result.error, result.response.status));
  }

  return result.data as T;
}

export function codeOf(error: unknown): string {
  return error instanceof ApiError ? error.code : 'unknown';
}
