import { screen } from '@testing-library/react-native';

import AddClothes from '@/app/(app)/add';
import { useSession } from '@/auth/session';
import { user } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/features/wardrobe/photos', () => ({ takePhoto: jest.fn(), pickFromGallery: jest.fn(), preparePhoto: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(() => new Promise(() => undefined)) }));

describe('the add sheet', () => {
  it.each([
    ['who agreed when creating the account', user()],
    ['who withdrew the consent in Profile (the server answers that)', user({ aiConsentAt: null })],
  ])('opens straight on its two sources for somebody %s', async (_who, person) => {
    useSession.setState({ status: 'signedIn', user: person, accessToken: 'a', refreshToken: 'r' });

    await renderScreen(<AddClothes />);

    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeOnTheScreen();
    expect(screen.queryByText('Before you add your first photo')).toBeNull();
    expect(screen.queryByTestId('consent-agree')).toBeNull();
  });
});
