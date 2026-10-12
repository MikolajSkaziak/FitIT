import { initialOf } from '@/features/profile/avatar';
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
    expect(digitsOnly('code: 123-456')).toBe('123456');
  });

  it('never keeps more than the six digits of a code', () => {
    expect(digitsOnly('1234567890')).toBe('123456');
  });
});

describe('isDeletionConfirmed', () => {
  it.each(['DELETE', 'delete', ' Delete '])('accepts %p', (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(true);
  });

  it.each(['', 'DEL', 'delete account', 'yes', 'DELETEX'])('refuses %p', (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(false);
  });
});

describe('deletionSummary', () => {
  it('names the garments that will go, in the right form', () => {
    expect(deletionSummary(1)).toBe('We’ll delete your account, 1 item, saved outfits and images. This can’t be undone.');
    expect(deletionSummary(3)).toContain('3 items');
    expect(deletionSummary(62)).toBe('We’ll delete your account, 62 items, saved outfits and images. This can’t be undone.');
  });

  it('does not invent a number while the count is unknown or zero', () => {
    expect(deletionSummary(undefined)).toBe('We’ll delete your account, all your clothes, saved outfits and images. This can’t be undone.');
    expect(deletionSummary(0)).toContain('all your clothes');
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
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = ' https://fitit.test/privacy ';
    expect(privacyPolicyUrl()).toBe('https://fitit.test/privacy');
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'http://fitit.test/privacy';
    expect(privacyPolicyUrl()).toBeNull();
  });
});

describe('initialOf', () => {
  it('takes the first letter of the name, in upper case', () => {
    expect(initialOf('Ola')).toBe('O');
    expect(initialOf('ola')).toBe('O');
    expect(initialOf('  anna maria ')).toBe('A');
    expect(initialOf('Émile')).toBe('É');
    expect(initialOf('\u0142ukasz')).toBe('\u0141');
  });

  it('skips what is not a letter', () => {
    expect(initialOf('"Ola"')).toBe('O');
    expect(initialOf('3po')).toBe('P');
  });

  it('has nothing to show without a letter, so the avatar falls back to an icon', () => {
    expect(initialOf('')).toBeNull();
    expect(initialOf('   ')).toBeNull();
    expect(initialOf('123')).toBeNull();
    expect(initialOf(null)).toBeNull();
    expect(initialOf(undefined)).toBeNull();
  });
});
