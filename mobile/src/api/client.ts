import createClient from 'openapi-fetch';

import { refreshSession, useSession } from '@/auth/session';
import { apiUrl } from '@/lib/config';

import { ApiError, networkProblem } from './problem';
import type { components, paths } from './schema';

export type Schemas = components['schemas'];

/** Routes that must never trigger a token refresh: they are how a session starts, or the refresh itself. */
const sessionRoutes = /\/api\/auth\/(login|register|refresh|email-check)(\?|$)/;

/**
 * Adds the access token to every request. When the server answers 401, the session is renewed once
 * (shared by all requests waiting at that moment) and the request is sent again with the new token.
 */
export async function authorizedFetch(input: Request): Promise<Response> {
  const send = async (token: string | null): Promise<Response> => {
    // Each attempt sends a copy, so the body is still there if the request has to be repeated.
    const request = input.clone();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      return await fetch(request);
    } catch {
      throw new ApiError(networkProblem);
    }
  };

  const tokenSent = useSession.getState().accessToken;
  const response = await send(tokenSent);
  if (response.status !== 401 || sessionRoutes.test(input.url)) {
    return response;
  }

  // Another request may have renewed the session while this one was on its way: then the new token is enough.
  const tokenNow = useSession.getState().accessToken;
  if (tokenNow && tokenNow !== tokenSent) {
    return send(tokenNow);
  }

  return (await refreshSession()) ? send(useSession.getState().accessToken) : response;
}

export const api = createClient<paths>({ baseUrl: apiUrl, fetch: authorizedFetch });
