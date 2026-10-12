import { useRegistrationDraft } from '@/features/registration/draft';
import { emptyDateParts } from '@/lib/dates';
import { checkBirthDate, emailError, messages, nameError, passwordError } from '@/features/registration/validation';

const today = { day: 6, month: 10, year: 2026 };

/** What the three boxes of the birth date hold: a chosen month, a typed day and a typed year. */
const born = (month: number, day: number, year: number) => ({ month, day: String(day), year: String(year) });

describe('emailError', () => {
  it.each(['ola@example.com', ' ola@example.com ', 'o.l+a@sub.domain.com'])('accepts %p', (email) => {
    expect(emailError(email)).toBeNull();
  });

  it('asks for an address when there is none', () => {
    expect(emailError('  ')).toBe(messages.emailMissing);
  });

  it.each(['ola', 'ola@', 'ola@example', '@example.com', 'ola @example.com', `${'a'.repeat(250)}@b.pl`])('refuses %p', (email) => {
    expect(emailError(email)).toBe(messages.emailInvalid);
  });
});

describe('passwordError', () => {
  it('follows the server: eight characters, no rules about what they are', () => {
    expect(passwordError('')).toBe(messages.passwordMissing);
    expect(passwordError('1234567')).toBe(messages.passwordShort);
    expect(passwordError('12345678')).toBeNull();
    expect(passwordError('a'.repeat(128))).toBeNull();
    expect(passwordError('a'.repeat(129))).toBe(messages.passwordLong);
  });
});

describe('nameError', () => {
  it('needs something other than spaces', () => {
    expect(nameError('Ola')).toBeNull();
    expect(nameError('   ')).toBe(messages.nameMissing);
  });
});

describe('checkBirthDate', () => {
  it('accepts somebody who turns sixteen today', () => {
    expect(checkBirthDate(born(10, 6, 2010), today)).toEqual({ date: { day: 6, month: 10, year: 2010 }, error: null });
  });

  it('refuses somebody who turns sixteen tomorrow', () => {
    expect(checkBirthDate(born(10, 7, 2010), today)).toEqual({ date: null, error: 'You need to be 16 to create an account.' });
  });

  it('counts a 29 February birthday the way the server does', () => {
    // Born on a leap day, sixteen on 29 February 2024; seventeen on 28 February 2025 because there is no 29th.
    expect(checkBirthDate(born(2, 29, 2008), { day: 28, month: 2, year: 2024 }).error).toBe(messages.underage(16));
    expect(checkBirthDate(born(2, 29, 2008), { day: 29, month: 2, year: 2024 }).error).toBeNull();
    expect(checkBirthDate(born(2, 29, 2008), { day: 28, month: 2, year: 2025 }, 17).error).toBeNull();
  });

  it('uses the age limit it is given', () => {
    expect(checkBirthDate(born(10, 6, 2010), today, 18).error).toBe('You need to be 18 to create an account.');
  });

  it('tells apart nothing typed, something unreadable and an impossible year', () => {
    expect(checkBirthDate(emptyDateParts, today).error).toBe(messages.birthDateMissing);
    expect(checkBirthDate({ month: 3, day: '14', year: '' }, today).error).toBe(messages.birthDateInvalid);
    expect(checkBirthDate(born(2, 31, 1999), today).error).toBe(messages.birthDateInvalid);
    expect(checkBirthDate(born(10, 7, 2026), today).error).toBe(messages.birthDateImplausible);
    expect(checkBirthDate(born(10, 5, 1906), today).error).toBe(messages.birthDateImplausible);
    expect(checkBirthDate(born(10, 6, 1906), today).error).toBeNull();
  });
});

describe('the registration draft', () => {
  beforeEach(() => useRegistrationDraft.getState().reset());

  it('holds what was picked before the account, and nothing about the body shape: that is asked after sign-up', () => {
    expect(Object.keys(useRegistrationDraft.getState()).sort()).toEqual(['birthDate', 'displayName', 'email', 'gender', 'password', 'place', 'reset', 'set', 'starters', 'styles', 'thermalPreference']);
  });

  it('forgets everything on reset, the password included', () => {
    useRegistrationDraft.getState().set({
      email: 'ola@example.com',
      password: 'secretpass1',
      styles: ['casual'],
      starters: ['white_tshirt'],
      place: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 },
    });

    useRegistrationDraft.getState().reset();

    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '', styles: [], starters: [], place: null, birthDate: emptyDateParts });
  });
});
