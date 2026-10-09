import { ApiError, codeOf } from '@/api/problem';

/** What the person reads for each error code of the API. Says what happened and what to do next; never blames. */
const messages: Record<string, string> = {
  network: 'Can’t connect right now. Check your internet connection and try again.',
  server_error: 'Something went wrong on our end. Try again in a moment.',
  rate_limited: 'Too many tries in a row. Wait a minute, then try again.',
  invalid_credentials: 'That email and password don’t match. Check them and try again.',
  locked_out: 'Too many sign-in attempts. Try again in a few minutes.',
  email_taken: 'There’s already an account with this email. Log in, or use a different email.',
  underage: 'You need to be 16 to create an account.',
  birth_date_invalid: 'That birth date doesn’t look right. Check the month, day and year.',
  avatar_invalid: 'That body shape isn’t available anymore. Pick another one.',
  avatar_gender_mismatch: 'That body shape doesn’t go with the gender you chose. Pick one from the list.',
  password_invalid: 'Use at least 8 characters for your password.',
  // The server gives one answer for a wrong, expired, used or exhausted code, so that guessing learns nothing.
  invalid_reset_code: 'That code didn’t work. It may be wrong, expired or already used. Check it, or ask for a new one.',
  wrong_password: 'That password doesn’t match. Check it and try again.',
  account_gone: 'This account doesn’t exist anymore.',
  location_invalid: 'We couldn’t save that place. Pick it again.',
  location_search_unavailable: 'Place search isn’t working right now. Try again in a moment.',
  validation_failed: 'Something you entered doesn’t look right. Check it and try again.',
  consent_required: 'First we need your OK to send clothing photos to AI services. You can turn that on in Profile.',
  limit_reached: 'You’ve hit today’s limit. More tomorrow.',
  upload_refused: 'The photo didn’t upload. Try again.',
  upload_missing: 'The photo didn’t arrive. Try again.',
  upload_too_large: 'That photo is too large. Pick a smaller one.',
  upload_not_jpeg: 'We couldn’t read that photo. Try a different one.',
  photo_unreadable: 'We couldn’t read that photo. Try a different one.',
  not_found: 'This item isn’t in your wardrobe anymore.',
  still_processing: 'We’re still describing this item. Try again in a moment.',
  tags_incomplete: 'Fill in all the details to save.',
  subcategory_mismatch: 'That type doesn’t go with the category. Pick the type again.',
  name_invalid: 'Use a name of up to 60 characters.',
  styles_invalid: 'One of those styles isn’t available. Pick again.',
  location_missing: 'We don’t know where to check the weather. Turn on location or choose a city.',
  weather_unavailable: 'We couldn’t get the forecast. Try again in a moment.',
  base_item_invalid: 'We can’t build an outfit around this item yet. Wait until we’ve described it, or pick another item.',
  colors_invalid: 'Pick one or two different colors.',
};

const rejections: Record<string, string> = {
  no_garment: 'We can’t see any clothing in this photo.',
  several_garments: 'This photo has several items. Take one photo per item.',
  underwear_or_swimwear: 'We can’t add underwear or swimwear.',
  unclear: 'We couldn’t tell what this is. Try another photo.',
};

/** Why a photo was not taken into the wardrobe, in words the person can act on. */
export const rejectionFor = (reason: string | null | undefined): string => rejections[reason ?? ''] ?? rejections.unclear!;

/** The words for a machine code alone, for places that keep the code rather than the error. */
export const messageForCode = (code: string | null | undefined): string => messages[code ?? ''] ?? fallback;

const fallback = 'Something went wrong. Try again.';

export function messageFor(error: unknown): string {
  // The age limit is a server setting, and the server sends it along with this error.
  if (error instanceof ApiError && error.code === 'underage' && typeof error.problem.minimumAge === 'number') {
    return `You need to be ${error.problem.minimumAge} to create an account.`;
  }

  return messages[codeOf(error)] ?? fallback;
}

/** Like {@link messageFor}, but for the password reset, where the limit is per quarter of an hour rather than per minute. */
export const resetMessageFor = (error: unknown): string =>
  codeOf(error) === 'rate_limited' ? 'Too many tries. Wait about 15 minutes, then try again.' : messageFor(error);
