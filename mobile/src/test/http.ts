/** Helpers for tests that stand in for the server by replacing `fetch`. */

export interface SeenRequest {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

type Handler = (request: SeenRequest) => Response | Promise<Response>;

/**
 * Replaces `fetch` with `handler` and records what was asked.
 * Returns the list of requests seen so far, in order.
 */
export function serveWith(handler: Handler): SeenRequest[] {
  const seen: SeenRequest[] = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const text = request.method === 'GET' ? '' : await request.text();
    const entry: SeenRequest = {
      method: request.method,
      path: request.url.replace(/^https?:\/\/[^/]+/, ''),
      authorization: request.headers.get('Authorization'),
      body: text ? JSON.parse(text) : null,
    };
    seen.push(entry);
    return handler(entry);
  }) as unknown as typeof fetch;
  return seen;
}

/** A `fetch` that fails the way it does with no connection. */
export function goOffline(): void {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
}
