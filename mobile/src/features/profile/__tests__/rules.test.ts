import { consentLine } from '@/features/profile/consent';
import { deletionSummary, isDeletionConfirmed } from '@/features/profile/deletion';
import { privacyPolicyUrl } from '@/features/profile/legal';
import { digitsOnly, messages, resetCodeError } from '@/features/registration/validation';

describe('resetCodeError', () => {
  it('wants all six digits', () => {
    expect(resetCodeError('')).toBe(messages.codeMissing);
    expect(resetCodeError('12345')).toBe(messages.codeInvalid);
    expect(resetCodeError('123456')).toBeNull();
  });
});

describe('digitsOnly', () => {
  it('keeps a pasted code usable', () => {
    expect(digitsOnly('123 456')).toBe('123456');
    expect(digitsOnly('kod: 123-456')).toBe('123456');
  });

  it('never keeps more than the six digits of a code', () => {
    expect(digitsOnly('1234567890')).toBe('123456');
  });
});

describe('isDeletionConfirmed', () => {
  it.each(['USUŃ', 'usuń', ' Usuń ', 'USUN', 'usun'])('accepts %p', (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(true);
  });

  it('accepts the accent typed as a base letter and a combining mark', () => {
    expect(isDeletionConfirmed('usuń')).toBe(true);
  });

  it.each(['', 'USU', 'usuń konto', 'tak', 'USUŃX'])('refuses %p', (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(false);
  });
});

describe('deletionSummary', () => {
  it('names the garments that will go, in the right form', () => {
    expect(deletionSummary(1)).toBe('Usuniemy konto, 1 ubranie, zapisane zestawy i obrazy. Tego nie da się cofnąć.');
    expect(deletionSummary(3)).toContain('3 ubrania');
    expect(deletionSummary(62)).toBe('Usuniemy konto, 62 ubrania, zapisane zestawy i obrazy. Tego nie da się cofnąć.');
    expect(deletionSummary(12)).toContain('12 ubrań');
  });

  it('does not invent a number while the count is unknown or zero', () => {
    expect(deletionSummary(undefined)).toBe('Usuniemy konto, wszystkie ubrania, zapisane zestawy i obrazy. Tego nie da się cofnąć.');
    expect(deletionSummary(0)).toContain('wszystkie ubrania');
  });
});

describe('consentLine', () => {
  it('says since when consent stands', () => {
    expect(consentLine('2026-10-02T12:00:00Z')).toBe('Zgoda z 2 października 2026.');
  });

  it('says what stops working once it is withdrawn', () => {
    expect(consentLine(null)).toBe('Zgoda wycofana. Bez niej nie dodasz nowych ubrań ani nie zobaczysz zestawu na sylwetce.');
  });

  it('does not print a date it cannot read', () => {
    expect(consentLine('wczoraj')).toBe('Zgoda udzielona.');
  });
});

describe('privacyPolicyUrl', () => {
  const before = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  afterEach(() => {
    if (before === undefined) {
      delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    } else {
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = before;
    }
  });

  it('is absent until the address is set, so there is no dead row', () => {
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    expect(privacyPolicyUrl()).toBeNull();
  });

  it('takes a secure address and nothing else', () => {
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = ' https://fitit.test/prywatnosc ';
    expect(privacyPolicyUrl()).toBe('https://fitit.test/prywatnosc');
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'http://fitit.test/prywatnosc';
    expect(privacyPolicyUrl()).toBeNull();
  });
});
