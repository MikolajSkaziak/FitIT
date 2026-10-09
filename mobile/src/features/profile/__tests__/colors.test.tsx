import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as colors from '@/api/colors';
import Profile from '@/app/(app)/(tabs)/profile';
import YourColors from '@/app/(app)/account/colors';
import { useSession } from '@/auth/session';
import { colorAnalysis, user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/colors', () => ({ createSelfieUpload: jest.fn(), analyzeColors: jest.fn(), deleteColorAnalysis: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(), fetchWardrobeStats: jest.fn() }));

const api = jest.mocked(colors);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile: Your colors', () => {
  it('has a row under Weather and style that shows the type and opens the screen', async () => {
    useSession.setState({ status: 'signedIn', user: user({ colorAnalysis }), accessToken: 'a', refreshToken: 'r' });
    await renderScreen(<Profile />);

    expect(screen.getByTestId('profile-row-colors')).toHaveTextContent('Your colorsSoft autumn');
    await fireEvent.press(screen.getByTestId('profile-row-colors'));

    expect(router.push).toHaveBeenCalledWith('/account/colors');
  });

  it('says "Not set" before an analysis', async () => {
    useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
    await renderScreen(<Profile />);

    expect(screen.getByTestId('profile-row-colors')).toHaveTextContent('Your colorsNot set');
  });
});

describe('the Your colors screen', () => {
  it('shows the same result view, and Redo starts the analysis again', async () => {
    useSession.setState({ status: 'signedIn', user: user({ colorAnalysis }), accessToken: 'a', refreshToken: 'r' });
    await renderScreen(<YourColors />);

    expect(screen.getByTestId('color-result-name')).toHaveTextContent('Soft autumn');
    expect(screen.getByText('Sage green')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Redo' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/colors', params: { redo: '1' } });
  });

  it('removes the palette from the profile, on the server and here, and goes back', async () => {
    useSession.setState({ status: 'signedIn', user: user({ colorAnalysis }), accessToken: 'a', refreshToken: 'r' });
    api.deleteColorAnalysis.mockResolvedValue(undefined);
    await renderScreen(<YourColors />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove my colors' }));

    await waitFor(() => expect(api.deleteColorAnalysis).toHaveBeenCalled());
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useSession.getState().user?.colorAnalysis).toBeNull();
  });

  it('invites the person to find their colors when there is nothing yet', async () => {
    useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
    await renderScreen(<YourColors />);

    expect(screen.getByText('No palette yet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Find my colors' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/colors', params: { redo: '1' } });
  });
});
