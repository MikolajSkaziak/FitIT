import { ApiError, networkProblem } from '@/api/problem';
import { messageFor } from '@/copy/errors';

describe('messageFor', () => {
  it('has its own words for the errors a person can do something about', () => {
    expect(messageFor(new ApiError(networkProblem))).toBe('Can’t connect right now. Check your internet connection and try again.');
    expect(messageFor(new ApiError({ status: 401, code: 'invalid_credentials' }))).toBe('That email and password don’t match. Check them and try again.');
  });

  it('has words for the errors of the stylist and the weather, none of them blaming', () => {
    expect(messageFor(new ApiError({ status: 409, code: 'location_missing' }))).toBe('We don’t know where to check the weather. Turn on location or choose a city.');
    expect(messageFor(new ApiError({ status: 503, code: 'weather_unavailable' }))).toBe('We couldn’t get the forecast. Try again in a moment.');
    expect(messageFor(new ApiError({ status: 400, code: 'base_item_invalid' }))).toContain('We can’t build an outfit around this item yet');
    expect(messageFor(new ApiError({ status: 429, code: 'limit_reached', limit: 20 }))).toBe('You’ve hit today’s limit. More tomorrow.');
  });

  it('uses the age limit the server sent', () => {
    expect(messageFor(new ApiError({ status: 422, code: 'underage', minimumAge: 18 }))).toBe('You need to be 18 to create an account.');
    expect(messageFor(new ApiError({ status: 422, code: 'underage' }))).toBe('You need to be 16 to create an account.');
  });

  it('never shows a code or an English server text', () => {
    expect(messageFor(new ApiError({ status: 418, code: 'something_new', title: 'I am a teapot' }))).toBe('Something went wrong. Try again.');
    expect(messageFor(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
