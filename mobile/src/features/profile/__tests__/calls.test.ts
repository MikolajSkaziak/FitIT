import { confirmPasswordReset, deleteAccount, requestPasswordReset } from '@/api/account';
import { ApiError } from '@/api/problem';
import { useSession } from '@/auth/session';
import { json, serveWith } from '@/test/http';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));

const noContent = () => new Response(null, { status: 204 });

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: null, accessToken: 'token', refreshToken: 'refresh' });
});

describe('the password reset calls', () => {
  it('asks for a code with the address alone, and no token', async () => {
    useSession.setState({ status: 'signedOut', accessToken: null, refreshToken: null });
    const seen = serveWith(noContent);

    await requestPasswordReset('ola@example.com');

    expect(seen).toEqual([{ method: 'POST', path: '/api/auth/password-reset/request', authorization: null, body: { email: 'ola@example.com' } }]);
  });

  it('sends the address, the code and the new password to confirm', async () => {
    const seen = serveWith(noContent);

    await confirmPasswordReset({ email: 'ola@example.com', code: '123456', newPassword: 'newpass123' });

    expect(seen).toEqual([
      expect.objectContaining({ method: 'POST', path: '/api/auth/password-reset/confirm', body: { email: 'ola@example.com', code: '123456', newPassword: 'newpass123' } }),
    ]);
  });

  it('hands the server\'s code for a bad reset code to the caller', async () => {
    serveWith(() => json(400, { status: 400, code: 'invalid_reset_code' }));

    await expect(confirmPasswordReset({ email: 'ola@example.com', code: '000000', newPassword: 'newpass123' })).rejects.toMatchObject(
      expect.objectContaining({ code: 'invalid_reset_code' }),
    );
  });
});

describe('deleting the account', () => {
  it('sends the password as a signed-in request to DELETE /api/me', async () => {
    const seen = serveWith(noContent);

    await deleteAccount('secretpass1');

    expect(seen).toEqual([{ method: 'DELETE', path: '/api/me', authorization: 'Bearer token', body: { password: 'secretpass1' } }]);
  });

  it('fails with the server\'s code when the password is wrong', async () => {
    serveWith(() => json(400, { status: 400, code: 'wrong_password' }));

    const failure = await deleteAccount('zle').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'wrong_password' });
  });
});
