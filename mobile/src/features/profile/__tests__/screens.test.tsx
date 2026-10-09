import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import DeleteAccount from '@/app/(app)/account/delete';
import Profile from '@/app/(app)/(tabs)/profile';
import Login from '@/app/(auth)/login';
import ResetCode from '@/app/(auth)/reset/code';
import ResetRequest from '@/app/(auth)/reset/index';
import * as session from '@/auth/session';
import { useSession } from '@/auth/session';
import { useResetDraft } from '@/features/profile/passwordReset';
import { messages } from '@/features/registration/validation';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/auth/session', () => ({ ...jest.requireActual('@/auth/session'), signOut: jest.fn(async () => undefined) }));
jest.mock('@/api/account', () => ({
  ...jest.requireActual('@/api/account'),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  deleteAccount: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(), fetchWardrobeStats: jest.fn() }));

const api = jest.mocked(account);
const shop = jest.mocked(wardrobe);

const refused = (status: number, code: string) => new ApiError({ status, code });
const offline = () => new ApiError(networkProblem);
/** A request that never answers: for the tests that are not about it, so nothing updates after they end. */
const unanswered = () => new Promise<never>(() => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useResetDraft.getState().reset();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
});

describe('forgotten password: asking for the code', () => {
  const ask = async (email: string) => {
    await fireEvent.changeText(screen.getByTestId('reset-email'), email);
    await fireEvent.press(screen.getByTestId('reset-send'));
  };

  it('says what is wrong with the address and sends nothing', async () => {
    await renderScreen(<ResetRequest />);

    await ask('ola');

    expect(screen.getByText(messages.emailInvalid)).toBeOnTheScreen();
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('moves on to the code with the trimmed address kept for the next screen', async () => {
    api.requestPasswordReset.mockResolvedValue(undefined);
    await renderScreen(<ResetRequest />);

    await ask(' ola@example.com ');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/reset/code'));
    expect(api.requestPasswordReset).toHaveBeenCalledWith('ola@example.com');
    expect(useResetDraft.getState().email).toBe(' ola@example.com ');
  });

  it('does not say whether the address has an account, not even in what it promises', async () => {
    await renderScreen(<ResetRequest />);

    expect(screen.getByText('Enter the email you signed up with. If there’s an account, we’ll send it a six-digit code.')).toBeOnTheScreen();
  });

  it('explains a missing connection and stays where it is', async () => {
    api.requestPasswordReset.mockRejectedValue(offline());
    await renderScreen(<ResetRequest />);

    await ask('ola@example.com');

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('says how long to wait when too many codes were asked for', async () => {
    api.requestPasswordReset.mockRejectedValue(refused(429, 'rate_limited'));
    await renderScreen(<ResetRequest />);

    await ask('ola@example.com');

    expect(await screen.findByText('Too many tries. Wait about 15 minutes, then try again.')).toBeOnTheScreen();
  });
});

describe('forgotten password: using the code', () => {
  const enter = async (code: string, password: string) => {
    await fireEvent.changeText(screen.getByTestId('reset-code-field'), code);
    await fireEvent.changeText(screen.getByTestId('reset-password'), password);
    await fireEvent.press(screen.getByTestId('reset-confirm'));
  };

  beforeEach(() => useResetDraft.getState().set('ola@example.com'));

  it('goes back to asking for the address when there is none to reset', async () => {
    useResetDraft.getState().reset();
    await renderScreen(<ResetCode />);

    expect(screen.queryByTestId('reset-code-field')).not.toBeOnTheScreen();
  });

  it('says what is missing and asks the server nothing', async () => {
    await renderScreen(<ResetCode />);

    await fireEvent.press(screen.getByTestId('reset-confirm'));

    expect(screen.getByText(messages.codeMissing)).toBeOnTheScreen();
    expect(screen.getByText(messages.passwordMissing)).toBeOnTheScreen();
    expect(api.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('refuses a short code and a short password before asking', async () => {
    await renderScreen(<ResetCode />);

    await enter('12345', 'krotkie');

    expect(screen.getByText(messages.codeInvalid)).toBeOnTheScreen();
    expect(screen.getByText(messages.passwordShort)).toBeOnTheScreen();
    expect(api.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('takes a pasted code with a space in it', async () => {
    api.confirmPasswordReset.mockResolvedValue(undefined);
    await renderScreen(<ResetCode />);

    await enter('123 456', 'newpass123');

    await waitFor(() => expect(api.confirmPasswordReset).toHaveBeenCalledWith({ email: 'ola@example.com', code: '123456', newPassword: 'newpass123' }));
  });

  it('sends the person to sign in, as the server ends every session and gives no new one', async () => {
    api.confirmPasswordReset.mockResolvedValue(undefined);
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/login', params: { reset: '1' } }));
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('says a code that does not work does not work, and offers a new one', async () => {
    api.confirmPasswordReset.mockRejectedValue(refused(400, 'invalid_reset_code'));
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');

    expect(await screen.findByText('That code didn’t work. It may be wrong, expired or already used. Check it, or ask for a new one.')).toBeOnTheScreen();
    expect(router.dismissTo).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('reset-again'));
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps what was typed when the code fails, so the password need not be typed again', async () => {
    api.confirmPasswordReset.mockRejectedValue(refused(400, 'invalid_reset_code'));
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');
    await screen.findByText(/That code didn’t work/);

    expect(screen.getByTestId('reset-code-field').props.value).toBe('123456');
    expect(screen.getByTestId('reset-password').props.value).toBe('newpass123');
  });

  it('clears the message as soon as the code is edited', async () => {
    api.confirmPasswordReset.mockRejectedValue(refused(400, 'invalid_reset_code'));
    await renderScreen(<ResetCode />);
    await enter('123456', 'newpass123');
    await screen.findByText(/That code didn’t work/);

    await fireEvent.changeText(screen.getByTestId('reset-code-field'), '654321');

    expect(screen.queryByText(/That code didn’t work/)).not.toBeOnTheScreen();
  });

  it('explains a missing connection', async () => {
    api.confirmPasswordReset.mockRejectedValue(offline());
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
  });

  it('says how long to wait after too many tries', async () => {
    api.confirmPasswordReset.mockRejectedValue(refused(429, 'rate_limited'));
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');

    expect(await screen.findByText('Too many tries. Wait about 15 minutes, then try again.')).toBeOnTheScreen();
  });

  it('passes on what the server says about the new password', async () => {
    api.confirmPasswordReset.mockRejectedValue(refused(400, 'password_invalid'));
    await renderScreen(<ResetCode />);

    await enter('123456', 'newpass123');

    expect(await screen.findByText('Use at least 8 characters for your password.')).toBeOnTheScreen();
  });
});

describe('login', () => {
  it('offers the reset and takes the typed address along', async () => {
    await renderScreen(<Login />);
    await fireEvent.changeText(screen.getByTestId('login-email'), ' ola@example.com ');

    await fireEvent.press(screen.getByTestId('login-forgot'));

    expect(router.push).toHaveBeenCalledWith('/reset');
    expect(useResetDraft.getState().email).toBe(' ola@example.com ');
  });

  it('says the password changed, with the address already in place, after a reset', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ reset: '1' });
    useResetDraft.getState().set('ola@example.com');
    await renderScreen(<Login />);

    expect(screen.getByText('Your password is updated. Log in with the new one.')).toBeOnTheScreen();
    expect(screen.getByTestId('login-email').props.value).toBe('ola@example.com');
  });
});

describe('deleting the account', () => {
  const type = async (word: string, password: string) => {
    await fireEvent.changeText(screen.getByTestId('delete-word'), word);
    await fireEvent.changeText(screen.getByTestId('delete-password'), password);
  };
  const disabled = () => screen.getByTestId('delete-confirm').props.accessibilityState.disabled;

  beforeEach(() => shop.fetchWardrobeStats.mockReturnValue(unanswered()));

  it('names what will be removed, with the number of garments', async () => {
    shop.fetchWardrobeStats.mockResolvedValue({ total: 62, wornLast30Days: 10, forgotten: 5, processing: 0, needsTags: 0 });
    await renderScreen(<DeleteAccount />);

    expect(await screen.findByText('We’ll delete your account, 62 items, saved outfits and images. This can’t be undone.')).toBeOnTheScreen();
    expect(screen.getByText('Type DELETE to confirm')).toBeOnTheScreen();
  });

  it('still names what will be removed while the count is not known', async () => {
    await renderScreen(<DeleteAccount />);

    expect(screen.getByText('We’ll delete your account, all your clothes, saved outfits and images. This can’t be undone.')).toBeOnTheScreen();
  });

  it('cannot be used until the word and the password are both there', async () => {
    await renderScreen(<DeleteAccount />);
    expect(disabled()).toBe(true);

    await type('DELETE', '');
    expect(disabled()).toBe(true);

    await type('DEL', 'secretpass1');
    expect(disabled()).toBe(true);

    await type('delete', 'secretpass1');
    expect(disabled()).toBe(false);
  });

  it('does nothing when pressed before it is ready', async () => {
    await renderScreen(<DeleteAccount />);

    await fireEvent.press(screen.getByTestId('delete-confirm'));

    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes with the password and ends the session', async () => {
    api.deleteAccount.mockResolvedValue(undefined);
    await renderScreen(<DeleteAccount />);
    await type('DELETE', 'secretpass1');

    await fireEvent.press(screen.getByTestId('delete-confirm'));

    await waitFor(() => expect(session.signOut).toHaveBeenCalled());
    expect(api.deleteAccount).toHaveBeenCalledWith('secretpass1');
  });

  it('keeps the account and the session when the password is wrong', async () => {
    api.deleteAccount.mockRejectedValue(refused(400, 'wrong_password'));
    await renderScreen(<DeleteAccount />);
    await type('DELETE', 'wrongpass1');

    await fireEvent.press(screen.getByTestId('delete-confirm'));

    expect(await screen.findByText('That password doesn’t match. Check it and try again.')).toBeOnTheScreen();
    expect(session.signOut).not.toHaveBeenCalled();
  });

  it('says so when the account is locked after too many wrong passwords', async () => {
    api.deleteAccount.mockRejectedValue(refused(429, 'locked_out'));
    await renderScreen(<DeleteAccount />);
    await type('DELETE', 'wrongpass1');

    await fireEvent.press(screen.getByTestId('delete-confirm'));

    expect(await screen.findByText('Too many sign-in attempts. Try again in a few minutes.')).toBeOnTheScreen();
  });

  it('explains a missing connection and deletes nothing', async () => {
    api.deleteAccount.mockRejectedValue(offline());
    await renderScreen(<DeleteAccount />);
    await type('DELETE', 'secretpass1');

    await fireEvent.press(screen.getByTestId('delete-confirm'));

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(session.signOut).not.toHaveBeenCalled();
  });

  it('leaves the account alone when the person keeps it', async () => {
    await renderScreen(<DeleteAccount />);

    await fireEvent.press(screen.getByTestId('delete-cancel'));

    expect(router.back).toHaveBeenCalled();
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });
});

describe('profile', () => {
  const usage = { items: { used: 12, limit: 50 }, suggestions: { used: 3, limit: 20 }, visualizations: { used: 1, limit: 5 }, resetsAt: '2026-10-08T00:00:00Z' };
  const consentSwitch = () => screen.getByLabelText('Send clothing photos to AI services');
  // The switch is locked while the change is on its way; waiting for it to open lets the screen finish updating.
  const saved = () => waitFor(() => expect(consentSwitch().props.disabled).toBeFalsy());

  beforeEach(() => shop.fetchUsage.mockReturnValue(unanswered()));

  it('shows the consent with its date, and the limits including visualizations', async () => {
    shop.fetchUsage.mockResolvedValue(usage);
    await renderScreen(<Profile />);

    expect(screen.getByText(/^Used to describe your clothes and show outfits on you\. You agreed on October 2, 2026\.$/)).toBeOnTheScreen();
    expect(consentSwitch().props.value).toBe(true);
    expect(await screen.findByText('1 of 5')).toBeOnTheScreen();
    expect(screen.getByText('casual')).toBeOnTheScreen();
  });

  it('writes the birth date with the month as a word, and the labels in plain English', async () => {
    await renderScreen(<Profile />);

    expect(screen.getByText('March 14, 1999')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Birth date, March 14, 1999' })).toBeOnTheScreen();
    expect(screen.getByText('Send clothing photos to AI services')).toBeOnTheScreen();
    expect(screen.getByText('Feel the cold')).toBeOnTheScreen();
  });

  it('opens the styles screen from the row that shows the chosen styles', async () => {
    useSession.setState({ user: user({ styles: ['casual', 'sporty'] }) });
    await renderScreen(<Profile />);

    await fireEvent.press(screen.getByRole('button', { name: 'Favorite styles, casual, sporty' }));

    expect(router.push).toHaveBeenCalledWith('/account/styles');
  });

  it('shows a plain avatar with the initial of the name, next to the name and the email', async () => {
    useSession.setState({ user: user({ displayName: 'ola' }) });
    await renderScreen(<Profile />);

    expect(screen.getByTestId('profile-avatar-initial')).toHaveTextContent('O');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('ola');
    expect(screen.getByTestId('profile-email')).toHaveTextContent('ola@example.com');
    expect(screen.queryByTestId('profile-change-silhouette')).toBeNull();
    expect(screen.queryByTestId('profile-silhouette')).toBeNull();
  });

  it('falls back to a person icon when the name has no letter', async () => {
    useSession.setState({ user: user({ displayName: '123' }) });
    await renderScreen(<Profile />);

    expect(screen.getByTestId('profile-avatar')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-avatar-initial')).toBeNull();
  });

  it('keeps the body shape among the account rows and opens its screen', async () => {
    await renderScreen(<Profile />);

    expect(screen.getByRole('button', { name: 'Body shape, Hourglass' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-row-silhouette'));

    expect(router.push).toHaveBeenCalledWith('/account/silhouette');
    expect(screen.getByTestId('profile-row-name')).toBeOnTheScreen();
  });

  it('withdraws consent at once and says what stops working', async () => {
    api.updateProfile.mockResolvedValue(user({ aiConsentAt: null }));
    await renderScreen(<Profile />);

    await fireEvent(consentSwitch(), 'valueChange', false);

    expect(await screen.findByText('Off. Without it, you can’t add clothes or try outfits on.')).toBeOnTheScreen();
    expect(api.updateProfile).toHaveBeenCalledWith({ aiConsent: false });
    await saved();
    expect(consentSwitch().props.value).toBe(false);
  });

  it('gives consent again from the same switch', async () => {
    useSession.setState({ user: user({ aiConsentAt: null }) });
    api.updateProfile.mockResolvedValue(user());
    await renderScreen(<Profile />);

    await fireEvent(consentSwitch(), 'valueChange', true);

    await waitFor(() => expect(consentSwitch().props.value).toBe(true));
    await saved();
    expect(api.updateProfile).toHaveBeenCalledWith({ aiConsent: true });
  });

  it('leaves the switch as it was and says why when the change is not saved', async () => {
    api.updateProfile.mockRejectedValue(offline());
    await renderScreen(<Profile />);

    await fireEvent(consentSwitch(), 'valueChange', false);

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    await saved();
    expect(consentSwitch().props.value).toBe(true);
  });

  it('opens the confirmation from the last section', async () => {
    await renderScreen(<Profile />);

    expect(screen.getByText('We’ll delete your account, clothes, outfits and images. This can’t be undone.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-delete-account'));

    expect(router.push).toHaveBeenCalledWith('/account/delete');
  });

  describe('privacy policy', () => {
    const before = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    afterEach(() => {
      if (before === undefined) {
        delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
      } else {
        process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = before;
      }
    });

    it('has no row until the published address is known', async () => {
      delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
      await renderScreen(<Profile />);

      expect(screen.queryByTestId('profile-row-privacy')).not.toBeOnTheScreen();
    });

    it('opens the published document', async () => {
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://fitit.test/privacy';
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      await renderScreen(<Profile />);

      await fireEvent.press(screen.getByTestId('profile-row-privacy'));

      expect(open).toHaveBeenCalledWith('https://fitit.test/privacy');
    });
  });
});
