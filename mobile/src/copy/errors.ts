import { ApiError, codeOf } from '@/api/problem';

/** What the person reads for each error code of the API. Says what happened and what to do next; never blames. */
const messages: Record<string, string> = {
  network: 'Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.',
  server_error: 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.',
  rate_limited: 'Za dużo prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
  invalid_credentials: 'E-mail lub hasło się nie zgadza. Sprawdź je i spróbuj ponownie.',
  locked_out: 'Za dużo nieudanych prób. Spróbuj ponownie za kilka minut.',
  email_taken: 'Ten adres ma już konto. Zaloguj się albo podaj inny.',
  underage: 'Konto można założyć po ukończeniu 16 lat.',
  birth_date_invalid: 'Sprawdź datę urodzenia. Wpisz ją jako dzień, miesiąc i rok.',
  avatar_invalid: 'Tej sylwetki nie ma już na liście. Wybierz inną.',
  avatar_gender_mismatch: 'Ta sylwetka należy do innej płci. Wybierz jedną z pokazanych.',
  password_invalid: 'Hasło musi mieć co najmniej 8 znaków.',
  location_invalid: 'Nie udało się zapisać miejsca. Wybierz je jeszcze raz.',
  location_search_unavailable: 'Wyszukiwanie miejscowości nie odpowiada. Spróbuj ponownie za chwilę.',
  validation_failed: 'Sprawdź wpisane dane i spróbuj ponownie.',
};

const fallback = 'Coś poszło nie tak. Spróbuj ponownie.';

export function messageFor(error: unknown): string {
  // The age limit is a server setting, and the server sends it along with this error.
  if (error instanceof ApiError && error.code === 'underage' && typeof error.problem.minimumAge === 'number') {
    return `Konto można założyć po ukończeniu ${error.problem.minimumAge} lat.`;
  }

  return messages[codeOf(error)] ?? fallback;
}
