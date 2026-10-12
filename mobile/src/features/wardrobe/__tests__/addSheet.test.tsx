import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import AddClothes from '@/app/(app)/add';
import * as wardrobe from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { finishConsent } from '@/features/consent/session';
import { pickFromGallery } from '@/features/wardrobe/photos';
import { uploads } from '@/features/wardrobe/queue';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
const mockOpenCamera = jest.fn();
jest.mock('@/features/camera/session', () => ({ useCamera: () => mockOpenCamera }));
jest.mock('@/features/wardrobe/photos', () => ({ batch: 20, pickFromGallery: jest.fn(), preparePhoto: jest.fn() }));
jest.mock('@/features/wardrobe/queue', () => ({ uploads: { ...jest.requireActual('@/features/wardrobe/queue').uploads, add: jest.fn() } }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(() => new Promise(() => undefined)) }));

describe('the add sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    finishConsent(false);
  });

  it.each([
    ['who allowed AI processing', user()],
    ['who has not allowed it yet (the sheet comes with the first photo)', user({ aiConsentAt: null })],
  ])('opens straight on its two sources for somebody %s', async (_who, person) => {
    useSession.setState({ status: 'signedIn', user: person, accessToken: 'a', refreshToken: 'r' });

    await renderScreen(<AddClothes />);

    expect(screen.getByRole('button', { name: 'Take photos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeOnTheScreen();
    expect(screen.queryByText('Before you add your first photo')).toBeNull();
    expect(screen.queryByTestId('consent-agree')).toBeNull();
  });

  it('opens the app’s own camera for what the day still allows, and queues what it brings back', async () => {
    useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
    jest.mocked(wardrobe.fetchUsage).mockResolvedValue({ items: { used: 27, limit: 30 } } as Awaited<ReturnType<typeof wardrobe.fetchUsage>>);
    const shots = [
      { uri: 'file:///1.jpg', width: 3000, height: 4000 },
      { uri: 'file:///2.jpg', width: 3000, height: 4000 },
    ];
    mockOpenCamera.mockResolvedValue(shots);
    await renderScreen(<AddClothes />);
    expect(await screen.findByText('3 of 30 left today')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('add-camera'));

    expect(mockOpenCamera).toHaveBeenCalledWith({ mode: 'clothes', limit: 3, daily: true });
    await waitFor(() => expect(uploads.add).toHaveBeenCalledWith(shots));
  });

  describe('the consent sheet before the first photo', () => {
    const shots = [{ uri: 'file:///1.jpg', width: 3000, height: 4000 }];
    beforeEach(() => {
      mockOpenCamera.mockResolvedValue(shots);
      jest.mocked(pickFromGallery).mockResolvedValue(shots);
      jest.mocked(wardrobe.fetchUsage).mockResolvedValue({ items: { used: 0, limit: 30 } } as Awaited<ReturnType<typeof wardrobe.fetchUsage>>);
    });

    it('asks first when the consent is missing, and opens the camera only once it is allowed', async () => {
      useSession.setState({ status: 'signedIn', user: user({ aiConsentAt: null }), accessToken: 'a', refreshToken: 'r' });
      await renderScreen(<AddClothes />);

      await fireEvent.press(screen.getByTestId('add-camera'));

      expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'clothes' } });
      expect(mockOpenCamera).not.toHaveBeenCalled();
      await act(async () => finishConsent(true));
      await waitFor(() => expect(mockOpenCamera).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(uploads.add).toHaveBeenCalledWith(shots));
    });

    it('asks first before the library too, and chooses nothing when the answer is Not now', async () => {
      useSession.setState({ status: 'signedIn', user: user({ aiConsentAt: null }), accessToken: 'a', refreshToken: 'r' });
      await renderScreen(<AddClothes />);

      await fireEvent.press(screen.getByTestId('add-gallery'));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'clothes' } });
      await act(async () => finishConsent(false));

      expect(pickFromGallery).not.toHaveBeenCalled();
      expect(mockOpenCamera).not.toHaveBeenCalled();
      expect(uploads.add).not.toHaveBeenCalled();
    });

    it('goes on to the library once it is allowed', async () => {
      useSession.setState({ status: 'signedIn', user: user({ aiConsentAt: null }), accessToken: 'a', refreshToken: 'r' });
      await renderScreen(<AddClothes />);

      await fireEvent.press(screen.getByTestId('add-gallery'));
      await act(async () => finishConsent(true));

      await waitFor(() => expect(uploads.add).toHaveBeenCalledWith(shots));
    });

    it('does not ask again once it was given', async () => {
      useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
      await renderScreen(<AddClothes />);

      await fireEvent.press(screen.getByTestId('add-camera'));

      expect(router.push).not.toHaveBeenCalled();
      await waitFor(() => expect(mockOpenCamera).toHaveBeenCalledTimes(1));
    });
  });
});
