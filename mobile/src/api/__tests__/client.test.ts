import { api, authorizedFetch } from '@/api/client';
import { ApiError, unwrap } from '@/api/problem';
import { useSession } from '@/auth/session';
import { tokenStorage } from '@/auth/tokenStorage';
import { goOffline, json, serveWith } from '@/test/http';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));

const signedIn = { status: 'signedIn' as const, user: null, accessToken: 'stale', refreshToken: 'refresh-1' };
const freshPair = { accessToken: 'fresh', refreshToken: 'refresh-2', expiresIn: 900 };

/** A server that accepts only the fresh access token and hands it out for `refresh-1`. */
const server = (refresh: () => Response | Promise<Response> = () => json(200, freshPair)) =>
  serveWith((request) => {
    if (request.path === '/api/auth/refresh') {
      return refresh();
    }

    return request.authorization === 'Bearer fresh' ? json(200, { echo: request.body }) : json(401, { code: 'unauthorized' });
  });

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState(signedIn);
});

describe('authorizedFetch', () => {
  it('sends the access token with the request', async () => {
    useSession.setState({ accessToken: 'fresh' });
    const seen = server();

    const response = await authorizedFetch(new Request('http://api.test/api/me'));

    expect(response.status).toBe(200);
    expect(seen).toEqual([expect.objectContaining({ path: '/api/me', authorization: 'Bearer fresh' })]);
  });

  it('renews the session once for several requests refused at the same time, then repeats each of them', async () => {
    const seen = server();

    const responses = await Promise.all([
      authorizedFetch(new Request('http://api.test/api/me')),
      authorizedFetch(new Request('http://api.test/api/clothes')),
      authorizedFetch(new Request('http://api.test/api/outfits')),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(seen.filter((request) => request.path === '/api/auth/refresh')).toHaveLength(1);
    expect(seen.filter((request) => request.authorization === 'Bearer fresh').map((request) => request.path).sort()).toEqual([
      '/api/clothes',
      '/api/me',
      '/api/outfits',
    ]);
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', accessToken: 'fresh', refreshToken: 'refresh-2' });
    expect(tokenStorage.save).toHaveBeenCalledWith('refresh-2');
  });

  it('repeats a request with its body intact', async () => {
    const seen = server();

    const response = await authorizedFetch(
      new Request('http://api.test/api/me', { method: 'PATCH', body: JSON.stringify({ displayName: 'Ola' }), headers: { 'Content-Type': 'application/json' } }),
    );

    expect(await response.json()).toEqual({ echo: { displayName: 'Ola' } });
    expect(seen.filter((request) => request.path === '/api/me').map((request) => request.body)).toEqual([{ displayName: 'Ola' }, { displayName: 'Ola' }]);
  });

  it('uses a token renewed by another request instead of renewing again', async () => {
    const seen = serveWith((request) => {
      if (request.authorization === 'Bearer stale') {
        // While this request was on its way, somebody else finished a refresh.
        useSession.setState({ accessToken: 'fresh' });
        return json(401, { code: 'unauthorized' });
      }

      return json(200, {});
    });

    const response = await authorizedFetch(new Request('http://api.test/api/me'));

    expect(response.status).toBe(200);
    expect(seen.map((request) => request.path)).toEqual(['/api/me', '/api/me']);
  });

  it('ends the session when the refresh token is refused, and hands back the refusal', async () => {
    const seen = server(() => json(401, { code: 'invalid_refresh_token' }));

    const response = await authorizedFetch(new Request('http://api.test/api/me'));

    expect(response.status).toBe(401);
    expect(seen.map((request) => request.path)).toEqual(['/api/me', '/api/auth/refresh']);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', accessToken: null, refreshToken: null });
    expect(tokenStorage.clear).toHaveBeenCalled();
  });

  it('keeps the session when the refresh cannot reach the server', async () => {
    let offline = false;
    serveWith((request) => {
      if (offline) {
        throw new TypeError('Network request failed');
      }

      offline = request.path === '/api/me';
      return json(401, { code: 'unauthorized' });
    });

    await expect(authorizedFetch(new Request('http://api.test/api/me'))).rejects.toMatchObject({ code: 'network' });
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', refreshToken: 'refresh-1' });
    expect(tokenStorage.clear).not.toHaveBeenCalled();
  });

  it('does not try to renew anything when signing in is what failed', async () => {
    const seen = serveWith(() => json(401, { code: 'invalid_credentials' }));

    const response = await authorizedFetch(new Request('http://api.test/api/auth/login', { method: 'POST', body: '{}' }));

    expect(response.status).toBe(401);
    expect(seen.map((request) => request.path)).toEqual(['/api/auth/login']);
    expect(useSession.getState().status).toBe('signedIn');
  });
});

describe('the typed client', () => {
  it('returns the data of a successful call', async () => {
    useSession.setState({ accessToken: 'fresh' });
    serveWith(() => json(200, [{ id: 'a', label: 'Klepsydra' }]));

    await expect(unwrap(api.GET('/api/avatars', { params: { query: { gender: 'female' } } }))).resolves.toEqual([{ id: 'a', label: 'Klepsydra' }]);
  });

  it('throws the problem of a refused call with its machine code and extensions', async () => {
    serveWith(() => json(422, { code: 'underage', minimumAge: 16, title: 'Too young' }));

    const call = unwrap(api.POST('/api/auth/register', { body: { email: 'a@b.pl', password: 'x', displayName: 'A', birthDate: null, gender: null, avatarId: null } }));

    await expect(call).rejects.toBeInstanceOf(ApiError);
    await expect(call).rejects.toMatchObject({ code: 'underage', problem: { status: 422, minimumAge: 16 } });
  });

  it('reports a missing connection as a network problem', async () => {
    goOffline();

    await expect(unwrap(api.GET('/api/me'))).rejects.toMatchObject({ code: 'network', problem: { status: 0 } });
  });

  it('gives a code to an error that came without one', async () => {
    serveWith(() => new Response('Bad gateway', { status: 502 }));

    await expect(unwrap(api.GET('/api/me'))).rejects.toMatchObject({ code: 'server_error' });
  });
});
