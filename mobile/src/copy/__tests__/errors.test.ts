import { ApiError, networkProblem } from '@/api/problem';
import { messageFor } from '@/copy/errors';

describe('messageFor', () => {
  it('has its own words for the errors a person can do something about', () => {
    expect(messageFor(new ApiError(networkProblem))).toBe('Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.');
    expect(messageFor(new ApiError({ status: 401, code: 'invalid_credentials' }))).toBe('E-mail lub hasło się nie zgadza. Sprawdź je i spróbuj ponownie.');
  });

  it('uses the age limit the server sent', () => {
    expect(messageFor(new ApiError({ status: 422, code: 'underage', minimumAge: 18 }))).toBe('Konto można założyć po ukończeniu 18 lat.');
    expect(messageFor(new ApiError({ status: 422, code: 'underage' }))).toBe('Konto można założyć po ukończeniu 16 lat.');
  });

  it('never shows a code or an English server text', () => {
    expect(messageFor(new ApiError({ status: 418, code: 'something_new', title: 'I am a teapot' }))).toBe('Coś poszło nie tak. Spróbuj ponownie.');
    expect(messageFor(new Error('boom'))).toBe('Coś poszło nie tak. Spróbuj ponownie.');
  });
});
