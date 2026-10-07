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
  // The server gives one answer for a wrong, expired, used or exhausted code, so that guessing learns nothing.
  invalid_reset_code: 'Ten kod nie działa: jest błędny, wygasł albo został już użyty. Sprawdź go albo poproś o nowy.',
  wrong_password: 'Hasło się nie zgadza. Sprawdź je i spróbuj ponownie.',
  account_gone: 'To konto już nie istnieje.',
  location_invalid: 'Nie udało się zapisać miejsca. Wybierz je jeszcze raz.',
  location_search_unavailable: 'Wyszukiwanie miejscowości nie odpowiada. Spróbuj ponownie za chwilę.',
  validation_failed: 'Sprawdź wpisane dane i spróbuj ponownie.',
  consent_required: 'Najpierw potrzebna jest zgoda na przetwarzanie zdjęć ubrań.',
  limit_reached: 'Dzisiejszy limit jest wykorzystany. Wróć jutro.',
  upload_refused: 'Wysyłanie się nie powiodło. Spróbuj ponownie.',
  upload_missing: 'Zdjęcie nie dotarło. Spróbuj ponownie.',
  upload_too_large: 'To zdjęcie jest za duże. Wybierz inne.',
  upload_not_jpeg: 'Nie udało się odczytać tego zdjęcia. Wybierz inne.',
  photo_unreadable: 'Nie udało się odczytać tego zdjęcia. Wybierz inne.',
  not_found: 'Tego ubrania już nie ma w szafie.',
  still_processing: 'Ubranie jest jeszcze opisywane. Spróbuj za chwilę.',
  tags_incomplete: 'Uzupełnij wszystkie pola opisu.',
  subcategory_mismatch: 'Ten typ nie pasuje do wybranej kategorii. Wybierz typ jeszcze raz.',
  name_invalid: 'Podaj nazwę, najwyżej 60 znaków.',
  location_missing: 'Nie wiemy, gdzie sprawdzić pogodę. Włącz lokalizację albo wpisz miasto.',
  weather_unavailable: 'Nie udało się pobrać prognozy pogody. Spróbuj ponownie za chwilę.',
  base_item_invalid: 'Do tego ubrania nie da się teraz dobrać zestawu. Poczekaj, aż zostanie opisane, albo wybierz inne.',
  colors_invalid: 'Wybierz jeden albo dwa różne kolory.',
};

const rejections: Record<string, string> = {
  no_garment: 'Na zdjęciu nie widać ubrania.',
  several_garments: 'Na zdjęciu jest kilka ubrań. Sfotografuj je osobno.',
  underwear_or_swimwear: 'Bielizny i strojów kąpielowych nie dodajemy do szafy.',
  unclear: 'Nie udało się rozpoznać ubrania. Spróbuj z innym zdjęciem.',
};

/** Why a photo was not taken into the wardrobe, in words the person can act on. */
export const rejectionFor = (reason: string | null | undefined): string => rejections[reason ?? ''] ?? rejections.unclear!;

/** The words for a machine code alone, for places that keep the code rather than the error. */
export const messageForCode = (code: string | null | undefined): string => messages[code ?? ''] ?? fallback;

const fallback = 'Coś poszło nie tak. Spróbuj ponownie.';

export function messageFor(error: unknown): string {
  // The age limit is a server setting, and the server sends it along with this error.
  if (error instanceof ApiError && error.code === 'underage' && typeof error.problem.minimumAge === 'number') {
    return `Konto można założyć po ukończeniu ${error.problem.minimumAge} lat.`;
  }

  return messages[codeOf(error)] ?? fallback;
}

/** Like {@link messageFor}, but for the password reset, where the limit is per quarter of an hour rather than per minute. */
export const resetMessageFor = (error: unknown): string =>
  codeOf(error) === 'rate_limited' ? 'Za dużo prób. Odczekaj kilkanaście minut i spróbuj ponownie.' : messageFor(error);
