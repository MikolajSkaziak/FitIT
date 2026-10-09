import { addYears, isAfter, isBlankDate, readDateParts, today as currentDay, type CalendarDate, type DateParts } from '@/lib/dates';

import type { RegistrationDraft } from './draft';

/** Mirrors the server's limits (AccountContracts.cs). The server stays the judge; this only saves a round trip. */
export const limits = { email: 254, passwordMin: 8, passwordMax: 128, name: 40, oldestAge: 120, resetCode: 6 } as const;

/** The server sends its own value with the `underage` error; this one is used before asking the server. */
export const minimumAge = 16;

export const messages = {
  emailMissing: 'Enter your email.',
  emailInvalid: 'That email doesn’t look right. It should look like name@example.com.',
  emailTaken: 'There’s already an account with this email. Log in, or use a different email.',
  passwordMissing: 'Enter your password.',
  passwordShort: `Use at least ${limits.passwordMin} characters for your password.`,
  passwordLong: `Use ${limits.passwordMax} characters or fewer for your password.`,
  codeMissing: 'Enter the code we sent you.',
  codeInvalid: 'The code has six digits. Make sure you entered all of them.',
  nameMissing: 'Enter your name.',
  birthDateMissing: 'Enter your birth date.',
  birthDateInvalid: 'That date doesn’t look right. Check the month, day and year.',
  birthDateImplausible: 'Check the year you were born.',
  underage: (age: number) => `You need to be ${age} to create an account.`,
  genderMissing: 'Choose one to continue.',
  avatarMissing: 'Choose a body shape to continue.',
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

/** What the email's code field keeps: digits only, so a pasted "123 456" still works. */
export const digitsOnly = (text: string): string => text.replace(/\D/g, '').slice(0, limits.resetCode);

export function resetCodeError(code: string): string | null {
  if (code.length === 0) {
    return messages.codeMissing;
  }

  return code.length === limits.resetCode ? null : messages.codeInvalid;
}

export const nameError = (name: string): string | null => (name.trim().length === 0 ? messages.nameMissing : null);

export type BirthDateCheck = { date: CalendarDate; error: null } | { date: null; error: string };

/** Reads the entered birth date and applies the same rules as the server: a real day, not in the future, old enough. */
export function checkBirthDate(parts: DateParts, today: CalendarDate = currentDay(), requiredAge: number = minimumAge): BirthDateCheck {
  if (isBlankDate(parts)) {
    return { date: null, error: messages.birthDateMissing };
  }

  const date = readDateParts(parts);
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
