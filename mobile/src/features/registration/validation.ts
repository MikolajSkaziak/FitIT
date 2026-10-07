import { addYears, isAfter, parseDate, today as currentDay, type CalendarDate } from '@/lib/dates';

import type { RegistrationDraft } from './draft';

/** Mirrors the server's limits (AccountContracts.cs). The server stays the judge; this only saves a round trip. */
export const limits = { email: 254, passwordMin: 8, passwordMax: 128, name: 40, oldestAge: 120, resetCode: 6 } as const;

/** The server sends its own value with the `underage` error; this one is used before asking the server. */
export const minimumAge = 16;

export const messages = {
  emailMissing: 'Podaj adres e-mail.',
  emailInvalid: 'Sprawdź adres e-mail. Powinien wyglądać jak ola@poczta.pl.',
  emailTaken: 'Ten adres ma już konto. Zaloguj się albo podaj inny.',
  passwordMissing: 'Podaj hasło.',
  passwordShort: `Hasło musi mieć co najmniej ${limits.passwordMin} znaków.`,
  passwordLong: `Hasło może mieć najwyżej ${limits.passwordMax} znaków.`,
  codeMissing: 'Wpisz kod z wiadomości.',
  codeInvalid: 'Kod ma sześć cyfr. Sprawdź, czy jest wpisany w całości.',
  nameMissing: 'Podaj imię.',
  birthDateMissing: 'Podaj datę urodzenia.',
  birthDateInvalid: 'Wpisz datę jako dzień, miesiąc i rok, na przykład 14.03.1999.',
  birthDateImplausible: 'Sprawdź rok urodzenia.',
  underage: (age: number) => `Konto można założyć po ukończeniu ${age} lat.`,
  genderMissing: 'Wybierz jedną z opcji.',
  avatarMissing: 'Wybierz sylwetkę, żeby przejść dalej.',
} as const;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) {
    return messages.emailMissing;
  }

  return value.length > limits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? messages.emailInvalid : null;
}

export function passwordError(password: string): string | null {
  if (password.length === 0) {
    return messages.passwordMissing;
  }

  if (password.length < limits.passwordMin) {
    return messages.passwordShort;
  }

  return password.length > limits.passwordMax ? messages.passwordLong : null;
}

/** What the e-mail's code field keeps: digits only, so a pasted "123 456" still works. */
export const digitsOnly = (text: string): string => text.replace(/\D/g, '').slice(0, limits.resetCode);

export function resetCodeError(code: string): string | null {
  if (code.length === 0) {
    return messages.codeMissing;
  }

  return code.length === limits.resetCode ? null : messages.codeInvalid;
}

export const nameError = (name: string): string | null => (name.trim().length === 0 ? messages.nameMissing : null);

export type BirthDateCheck = { date: CalendarDate; error: null } | { date: null; error: string };

/** Reads the typed birth date and applies the same rules as the server: a real day, not in the future, old enough. */
export function checkBirthDate(text: string, today: CalendarDate = currentDay(), requiredAge: number = minimumAge): BirthDateCheck {
  if (text.trim().length === 0) {
    return { date: null, error: messages.birthDateMissing };
  }

  const date = parseDate(text);
  if (!date) {
    return { date: null, error: messages.birthDateInvalid };
  }

  if (isAfter(date, today) || isAfter(addYears(today, -limits.oldestAge), date)) {
    return { date: null, error: messages.birthDateImplausible };
  }

  if (isAfter(addYears(date, requiredAge), today)) {
    return { date: null, error: messages.underage(requiredAge) };
  }

  return { date, error: null };
}

export type RegistrationStep = '/register' | '/register/about' | '/register/silhouette';

/** The earliest step that still has something missing, or null when the draft can be sent. */
export function firstIncompleteStep(draft: RegistrationDraft, today: CalendarDate = currentDay()): RegistrationStep | null {
  if (emailError(draft.email) || passwordError(draft.password)) {
    return '/register';
  }

  if (nameError(draft.displayName) || checkBirthDate(draft.birthDate, today).error || !draft.gender) {
    return '/register/about';
  }

  return draft.avatarId ? null : '/register/silhouette';
}
