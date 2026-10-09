import { ApiError, networkProblem } from '@/api/problem';
import { onSessionEnd, refreshSession, restoreSession, signOut, startSession, useSession, type User } from '@/auth/session';
import { tokenStorage } from '@/auth/tokenStorage';
import { goOffline, json, serveWith } from '@/test/http';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => {
  let stored: string | null = null;
  return {
    tokenStorage: {
      load: jest.fn(async () => stored),
      save: jest.fn(async (token: string) => {
        stored = token;
      }),
      clear: jest.fn(async () => {
        stored = null;
      }),
    },
  };
});

const ola = { id: 'u1', displayName: 'Ola', email: 'ola@example.com' } as User;
const pair = { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 };
const onEnd = jest.fn();
onSessionEnd(onEnd);

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  useSession.setState({ status: 'loading', user: null, accessToken: null, refreshToken: null });
  onEnd.mockClear();
});

describe('restoring the session at start', () => {
  it('is signed out when nothing is stored', async () => {
    const seen = serveWith(() => json(500, {}));

    await restoreSession(async () => ola);

    expect(useSession.getState().status).toBe('signedOut');
    expect(seen).toHaveLength(0);
  });

  it('signs in with the stored refresh token and stores the one that replaces it', async () => {
    await tokenStorage.save('refresh-1');
    const seen = serveWith(() => json(200, pair));

    await restoreSession(async () => ola);

    expect(seen).toEqual([expect.objectContaining({ path: '/api/auth/refresh', body: { refreshToken: 'refresh-1' }, authorization: null })]);
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', user: ola, accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(await tokenStorage.load()).toBe('refresh-2');
  });

  it('is signed out, with nothing left on the phone, when the stored token is no longer accepted', async () => {
    await tokenStorage.save('refresh-1');
    serveWith(() => json(401, { code: 'invalid_refresh_token' }));

    await restoreSession(async () => ola);

    expect(useSession.getState()).toMatchObject({ status: 'signedOut', user: null, refreshToken: null });
    expect(await tokenStorage.load()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored session when the server cannot be reached', async () => {
    await tokenStorage.save('refresh-1');
    goOffline();

    await restoreSession(async () => ola);

    expect(useSession.getState().status).toBe('unreachable');
    expect(await tokenStorage.load()).toBe('refresh-1');
  });

  it('keeps the session when the server is up but the profile could not be loaded', async () => {
    await tokenStorage.save('refresh-1');
    serveWith(() => json(200, pair));

    await restoreSession(async () => {
      throw new ApiError(networkProblem);
    });

    expect(useSession.getState().status).toBe('unreachable');
    expect(await tokenStorage.load()).toBe('refresh-2');
  });

  it('is signed out when the account no longer exists', async () => {
    await tokenStorage.save('refresh-1');
    serveWith(() => json(200, pair));

    await restoreSession(async () => {
      throw new ApiError({ status: 401, code: 'account_gone' });
    });

    expect(useSession.getState().status).toBe('signedOut');
    expect(await tokenStorage.load()).toBeNull();
  });
});

describe('refreshing', () => {
  it('asks the server once however many callers wait', async () => {
    useSession.setState({ status: 'signedIn', refreshToken: 'refresh-1', accessToken: 'access-1' });
    const seen = serveWith(() => json(200, pair));

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(seen).toHaveLength(1);
  });

  it('can run again after the previous refresh has finished', async () => {
    useSession.setState({ status: 'signedIn', refreshToken: 'refresh-1', accessToken: 'access-1' });
    const seen = serveWith(() => json(200, pair));

    await refreshSession();
    await refreshSession();

    expect(seen.map((request) => request.body)).toEqual([{ refreshToken: 'refresh-1' }, { refreshToken: 'refresh-2' }]);
  });

  it('treats a server fault as a fault, not as the end of the session', async () => {
    useSession.setState({ status: 'signedIn', refreshToken: 'refresh-1', accessToken: 'access-1' });
    serveWith(() => json(503, { code: 'server_error' }));

    await expect(refreshSession()).rejects.toMatchObject({ code: 'server_error' });
    expect(useSession.getState().status).toBe('signedIn');
  });
});

describe('signing in and out', () => {
  it('keeps the access token in memory and the refresh token in secure storage', async () => {
    await startSession({ ...pair, user: ola });

    expect(useSession.getState()).toMatchObject({ status: 'signedIn', user: ola, accessToken: 'access-2' });
    expect(await tokenStorage.load()).toBe('refresh-2');
  });

  it('tells the server to forget the refresh token, then forgets the session', async () => {
    await startSession({ ...pair, user: ola });
    const seen = serveWith(() => new Response(null, { status: 204 }));

    await signOut();

    expect(seen).toEqual([{ method: 'POST', path: '/api/auth/logout', authorization: 'Bearer access-2', body: { refreshToken: 'refresh-2' } }]);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', user: null, accessToken: null });
    expect(await tokenStorage.load()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('signs out on the phone even with no connection', async () => {
    await startSession({ ...pair, user: ola });
    goOffline();

    await signOut();

    expect(useSession.getState().status).toBe('signedOut');
    expect(await tokenStorage.load()).toBeNull();
  });
});
