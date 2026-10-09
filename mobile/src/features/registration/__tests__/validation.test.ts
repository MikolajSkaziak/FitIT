import type { RegistrationDraft } from '@/features/registration/draft';
import { useRegistrationDraft } from '@/features/registration/draft';
import { emptyDateParts } from '@/lib/dates';
import { checkBirthDate, emailError, firstIncompleteStep, messages, nameError, passwordError } from '@/features/registration/validation';

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

describe('firstIncompleteStep', () => {
  const complete: RegistrationDraft = {
    email: 'ola@example.com',
    password: 'secretpass1',
    displayName: 'Ola',
    birthDate: born(3, 14, 1999),
    gender: 'female',
    avatarId: 'a1',
    avatarGender: 'female',
    clothingSize: null,
    legLength: null,
    styles: [],
    thermalPreference: 'normal',
  };

  it('is null when everything needed is there (styles are optional)', () => {
    expect(firstIncompleteStep(complete, today)).toBeNull();
  });

  it.each([
    [{ email: 'ola' }, '/register'],
    [{ password: 'krotkie' }, '/register'],
    [{ displayName: ' ' }, '/register/about'],
    [{ birthDate: born(3, 14, 2020) }, '/register/about'],
    [{ birthDate: emptyDateParts }, '/register/about'],
    [{ gender: null }, '/register/about'],
    [{ avatarId: null }, '/register/silhouette'],
    [{ email: '', avatarId: null }, '/register'],
  ] as const)('points at the earliest step with a gap: %p', (change, step) => {
    expect(firstIncompleteStep({ ...complete, ...change }, today)).toBe(step);
  });
});

describe('the registration draft', () => {
  beforeEach(() => useRegistrationDraft.getState().reset());

  it('drops the chosen silhouette when the gender changes, because silhouettes belong to a gender', () => {
    const draft = useRegistrationDraft.getState();
    draft.set({ gender: 'female' });
    draft.set({ avatarId: 'klepsydra' });
    expect(useRegistrationDraft.getState().avatarId).toBe('klepsydra');

    draft.set({ gender: 'female' });
    expect(useRegistrationDraft.getState().avatarId).toBe('klepsydra');

    draft.set({ gender: 'male' });
    expect(useRegistrationDraft.getState()).toMatchObject({ gender: 'male', avatarId: null });
  });

  it.each([
    ['female', 'female', 'non_binary'],
    ['male', 'male', 'unspecified'],
    ['non_binary', 'male', 'unspecified'],
    ['non_binary', 'female', 'female'],
  ] as const)('keeps the chosen silhouette while it is still offered: %#', (from, shape, to) => {
    const draft = useRegistrationDraft.getState();
    draft.set({ gender: from });
    draft.set({ avatarId: 'shape', avatarGender: shape });

    draft.set({ gender: to });

    expect(useRegistrationDraft.getState()).toMatchObject({ gender: to, avatarId: 'shape', avatarGender: shape });
  });

  it.each([
    ['non_binary', 'male', 'female'],
    ['non_binary', 'female', 'male'],
    ['unspecified', 'male', 'female'],
  ] as const)('drops a silhouette of the other set when the gender narrows down: %#', (from, shape, to) => {
    const draft = useRegistrationDraft.getState();
    draft.set({ gender: from });
    draft.set({ avatarId: 'shape', avatarGender: shape });

    draft.set({ gender: to });

    expect(useRegistrationDraft.getState()).toMatchObject({ gender: to, avatarId: null, avatarGender: null });
  });

  it('forgets everything on reset, the password included', () => {
    useRegistrationDraft.getState().set({ email: 'ola@example.com', password: 'secretpass1', styles: ['casual'], thermalPreference: 'runs_cold' });

    useRegistrationDraft.getState().reset();

    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '', styles: [], thermalPreference: 'normal', gender: null });
  });
});
