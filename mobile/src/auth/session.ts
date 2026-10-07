import { create } from 'zustand';

import type { Schemas } from '@/api/client';
import { ApiError, networkProblem } from '@/api/problem';
import { apiUrl } from '@/lib/config';

import { tokenStorage } from './tokenStorage';

export type User = Schemas['UserResponse'];

/**
 * - `loading`: the app has just started and is finding out whether a session exists.
 * - `unreachable`: there is a stored session, but the server could not be reached to renew it.
 */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  /** Lives in memory only; it expires after fifteen minutes anyway. */
  accessToken: string | null;
  /** Also kept in the device's secure storage, so the session survives closing the app. */
  refreshToken: string | null;
}

const signedOut: SessionState = { status: 'signedOut', user: null, accessToken: null, refreshToken: null };

export const useSession = create<SessionState>(() => ({ ...signedOut, status: 'loading' }));

const sessionEndHandlers = new Set<() => void>();

/**
 * Registers something to run after anything that ends the session, so the app can drop what it holds for the
 * previous person (cached answers, photos waiting to be sent). Returns a function that removes the handler.
 */
export function onSessionEnd(handler: () => void): () => void {
  sessionEndHandlers.add(handler);
  return () => sessionEndHandlers.delete(handler);
}

async function endSession(): Promise<void> {
  await tokenStorage.clear();
  useSession.setState(signedOut);
  sessionEndHandlers.forEach((handler) => handler());
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a new pair. However many requests ask at once, the server is asked once:
 * the refresh token rotates on every use, so a second parallel exchange would end the session.
 * Resolves to false when the session is over; rejects with a `network` ApiError when the server cannot be reached.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= exchange().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function exchange(): Promise<boolean> {
  const refreshToken = useSession.getState().refreshToken ?? (await tokenStorage.load());
  if (!refreshToken) {
    await endSession();
    return false;
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new ApiError(networkProblem);
  }

  if (response.status === 400 || response.status === 401) {
    await endSession();
    return false;
  }

  if (!response.ok) {
    throw new ApiError({ status: response.status, code: 'server_error' });
  }

  const pair = (await response.json()) as TokenPair;
  await tokenStorage.save(pair.refreshToken);
  useSession.setState({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
  return true;
}

/** After a successful sign in or registration. */
export async function startSession(auth: Schemas['AuthResponse']): Promise<void> {
  await tokenStorage.save(auth.refreshToken);
  useSession.setState({ status: 'signedIn', user: auth.user, accessToken: auth.accessToken, refreshToken: auth.refreshToken });
}

export function setUser(user: User): void {
  useSession.setState({ user });
}

/** Tells the server to forget the refresh token, then forgets the session here whatever the server said. */
export async function signOut(): Promise<void> {
  const { accessToken, refreshToken } = useSession.getState();
  if (accessToken && refreshToken) {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Offline: the token simply expires on its own; signing out on the device must still work.
    }
  }

  await endSession();
}

/**
 * Runs once at start: restores the stored session, if any.
 * `loadUser` is passed in (instead of imported) because the API client itself depends on this module.
 */
export async function restoreSession(loadUser: () => Promise<User>): Promise<void> {
  useSession.setState({ status: 'loading' });
  const stored = await tokenStorage.load();
  if (!stored) {
    useSession.setState(signedOut);
    return;
  }

  useSession.setState({ refreshToken: stored });
  try {
    if (!(await refreshSession())) {
      return;
    }

    const user = await loadUser();
    useSession.setState({ status: 'signedIn', user });
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'unauthorized' || error.code === 'account_gone')) {
      await endSession();
    } else {
      useSession.setState({ status: 'unreachable' });
    }
  }
}
