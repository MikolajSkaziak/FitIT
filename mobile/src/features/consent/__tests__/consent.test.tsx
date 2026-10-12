import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import ConsentSheet from '@/app/(app)/consent';
import { useSession } from '@/auth/session';
import { consentLine } from '@/features/consent/copy';
import { finishConsent, useAiConsent } from '@/features/consent/session';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));

const api = jest.mocked(account);
const open = (kind: 'clothes' | 'selfie') => jest.mocked(useLocalSearchParams).mockReturnValue({ kind });

/** Somebody waiting for the answer, the way a screen that is about to send a photo does. */
function asker(kind: 'clothes' | 'selfie', options?: { force?: boolean }) {
  const answer = jest.fn();
  function Asker() {
    const ask = useAiConsent();
    return <AskButton onPress={() => void ask(kind, options).then(answer)} />;
  }
  return { Asker, answer };
}

function AskButton({ onPress }: { onPress: () => void }) {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return (
    <Pressable onPress={onPress} testID="ask">
      <Text>ask</Text>
    </Pressable>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  finishConsent(false);
  useSession.setState({ status: 'signedIn', user: user({ aiConsentAt: null }), accessToken: 'a', refreshToken: 'r' });
});

describe('the consent sheet', () => {
  it('says, for clothes, what is sent, who receives it and what happens to it', async () => {
    open('clothes');
    await renderScreen(<ConsentSheet />);

    expect(screen.getByText('Before your photos leave your phone')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'AI helps with your clothes' })).toBeOnTheScreen();
    expect(screen.getByTestId('consent-sent')).toHaveTextContent(/Photos of your clothes/);
    expect(screen.getByTestId('consent-who')).toHaveTextContent(/Google and fal\.ai/);
    expect(screen.getByTestId('consent-what')).toHaveTextContent(/The photos stay in your wardrobe until you delete the piece or your account\./);
    expect(screen.getByRole('button', { name: 'Allow and continue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeOnTheScreen();
  });

  it('has its own words for the selfie: one photo of the face, Google only, deleted right after', async () => {
    open('selfie');
    await renderScreen(<ConsentSheet />);

    expect(screen.getByTestId('consent-sent')).toHaveTextContent(/One photo of your face/);
    expect(screen.getByTestId('consent-who')).toHaveTextContent(/Google/);
    expect(screen.getByTestId('consent-who')).not.toHaveTextContent(/fal\.ai/);
    expect(screen.getByTestId('consent-what')).toHaveTextContent(/We delete the selfie from our storage right after the analysis and keep only your palette\./);
  });

  describe('the Privacy Policy link', () => {
    const before = process.env.EXPO_PUBLIC_SITE_URL;
    afterEach(() => {
      if (before === undefined) {
        delete process.env.EXPO_PUBLIC_SITE_URL;
      } else {
        process.env.EXPO_PUBLIC_SITE_URL = before;
      }
    });

    it('opens the policy in the in-app browser', async () => {
      process.env.EXPO_PUBLIC_SITE_URL = 'https://fitit.test';
      const browser = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
      open('clothes');
      await renderScreen(<ConsentSheet />);

      await fireEvent.press(screen.getByRole('link', { name: 'Privacy Policy' }));

      expect(browser).toHaveBeenCalledWith('https://fitit.test/privacy', expect.anything());
    });

    it('is left out rather than dead while no address is known', async () => {
      delete process.env.EXPO_PUBLIC_SITE_URL;
      open('clothes');
      await renderScreen(<ConsentSheet />);

      expect(screen.queryByTestId('consent-privacy')).toBeNull();
    });
  });

  it('saves the consent on Allow, then closes and lets the action go on', async () => {
    open('clothes');
    api.updateProfile.mockResolvedValue(user({ aiConsentAt: '2026-10-11T08:00:00Z' }));
    const { Asker, answer } = asker('clothes');
    await renderScreen(<Asker />);
    await fireEvent.press(screen.getByTestId('ask'));
    await renderScreen(<ConsentSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow and continue' }));

    await waitFor(() => expect(answer).toHaveBeenCalledWith(true));
    expect(api.updateProfile).toHaveBeenCalledWith({ aiConsent: true });
    expect(useSession.getState().user?.aiConsentAt).toBe('2026-10-11T08:00:00Z');
    expect(router.back).toHaveBeenCalled();
  });

  it('closes on Not now, sends nothing and does not let the action go on', async () => {
    open('clothes');
    const { Asker, answer } = asker('clothes');
    await renderScreen(<Asker />);
    await fireEvent.press(screen.getByTestId('ask'));
    await renderScreen(<ConsentSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(answer).toHaveBeenCalledWith(false));
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
    expect(useSession.getState().user?.aiConsentAt).toBeNull();
  });

  it('counts a sheet swiped away as a no', async () => {
    open('clothes');
    const { Asker, answer } = asker('clothes');
    await renderScreen(<Asker />);
    await fireEvent.press(screen.getByTestId('ask'));
    const sheet = await renderScreen(<ConsentSheet />);

    sheet.unmount();

    await waitFor(() => expect(answer).toHaveBeenCalledWith(false));
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('stays, with the usual error, when saving fails, and the action waits', async () => {
    open('clothes');
    api.updateProfile.mockRejectedValue(new ApiError(networkProblem));
    const { Asker, answer } = asker('clothes');
    await renderScreen(<Asker />);
    await fireEvent.press(screen.getByTestId('ask'));
    await renderScreen(<ConsentSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow and continue' }));

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
    expect(useSession.getState().user?.aiConsentAt).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    // The person can try again, or give up.
    api.updateProfile.mockResolvedValue(user({ aiConsentAt: '2026-10-11T08:00:00Z' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Allow and continue' }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith(true));
  });
});

describe('asking for the consent', () => {
  it('answers yes at once, and shows no sheet, when it was given', async () => {
    useSession.setState({ user: user({ aiConsentAt: '2026-10-02T08:00:00Z' }) });
    const { Asker, answer } = asker('clothes');
    await renderScreen(<Asker />);

    await fireEvent.press(screen.getByTestId('ask'));

    await waitFor(() => expect(answer).toHaveBeenCalledWith(true));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the sheet for the kind of photo, and waits for the answer, when it was not given', async () => {
    const { Asker, answer } = asker('selfie');
    await renderScreen(<Asker />);

    await fireEvent.press(screen.getByTestId('ask'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'selfie' } });
    expect(answer).not.toHaveBeenCalled();
    await act(async () => finishConsent(true));
    await waitFor(() => expect(answer).toHaveBeenCalledWith(true));
  });

  it('opens the sheet although this phone thinks the consent stands, when the server said otherwise', async () => {
    useSession.setState({ user: user({ aiConsentAt: '2026-10-02T08:00:00Z' }) });
    const { Asker } = asker('clothes', { force: true });
    await renderScreen(<Asker />);

    await fireEvent.press(screen.getByTestId('ask'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'clothes' } });
  });
});

describe('the words under the switch in Profile', () => {
  it('say since when it is on, and what stops working when it is off', () => {
    expect(consentLine('2026-10-02T08:00:00Z')).toBe('Used to cut out and describe your clothes, make try-on pictures and read a selfie. Since October 2, 2026.');
    expect(consentLine('not a date')).toBe('Used to cut out and describe your clothes, make try-on pictures and read a selfie.');
    expect(consentLine(null)).toContain('Off. You can’t add clothes by photo, try outfits on');
  });
});
