import type { RegistrationDraft } from '@/features/registration/draft';
import { useRegistrationDraft } from '@/features/registration/draft';
import { checkBirthDate, emailError, firstIncompleteStep, messages, nameError, passwordError } from '@/features/registration/validation';

const today = { day: 6, month: 10, year: 2026 };

describe('emailError', () => {
  it.each(['ola@poczta.pl', ' ola@poczta.pl ', 'o.l+a@sub.domena.com'])('accepts %p', (email) => {
    expect(emailError(email)).toBeNull();
  });

  it('asks for an address when there is none', () => {
    expect(emailError('  ')).toBe(messages.emailMissing);
  });

  it.each(['ola', 'ola@', 'ola@poczta', '@poczta.pl', 'ola @poczta.pl', `${'a'.repeat(250)}@b.pl`])('refuses %p', (email) => {
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
    expect(checkBirthDate('06.10.2010', today)).toEqual({ date: { day: 6, month: 10, year: 2010 }, error: null });
  });

  it('refuses somebody who turns sixteen tomorrow', () => {
    expect(checkBirthDate('07.10.2010', today)).toEqual({ date: null, error: 'Konto można założyć po ukończeniu 16 lat.' });
  });

  it('counts a 29 February birthday the way the server does', () => {
    // Born on a leap day, sixteen on 29 February 2024; seventeen on 28 February 2025 because there is no 29th.
    expect(checkBirthDate('29.02.2008', { day: 28, month: 2, year: 2024 }).error).toBe(messages.underage(16));
    expect(checkBirthDate('29.02.2008', { day: 29, month: 2, year: 2024 }).error).toBeNull();
    expect(checkBirthDate('29.02.2008', { day: 28, month: 2, year: 2025 }, 17).error).toBeNull();
  });

  it('uses the age limit it is given', () => {
    expect(checkBirthDate('06.10.2010', today, 18).error).toBe('Konto można założyć po ukończeniu 18 lat.');
  });

  it('tells apart nothing typed, something unreadable and an impossible year', () => {
    expect(checkBirthDate('', today).error).toBe(messages.birthDateMissing);
    expect(checkBirthDate('14.03', today).error).toBe(messages.birthDateInvalid);
    expect(checkBirthDate('31.02.1999', today).error).toBe(messages.birthDateInvalid);
    expect(checkBirthDate('07.10.2026', today).error).toBe(messages.birthDateImplausible);
    expect(checkBirthDate('05.10.1906', today).error).toBe(messages.birthDateImplausible);
    expect(checkBirthDate('06.10.1906', today).error).toBeNull();
  });
});

describe('firstIncompleteStep', () => {
  const complete: RegistrationDraft = {
    email: 'ola@poczta.pl',
    password: 'tajnehaslo1',
    displayName: 'Ola',
    birthDate: '14.03.1999',
    gender: 'female',
    avatarId: 'a1',
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
    [{ birthDate: '14.03.2020' }, '/register/about'],
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

  it('forgets everything on reset, the password included', () => {
    useRegistrationDraft.getState().set({ email: 'ola@poczta.pl', password: 'tajnehaslo1', styles: ['casual'], thermalPreference: 'runs_cold' });

    useRegistrationDraft.getState().reset();

    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '', styles: [], thermalPreference: 'normal', gender: null });
  });
});
