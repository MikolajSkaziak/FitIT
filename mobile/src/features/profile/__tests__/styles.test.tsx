import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/api/account';
import { ApiError } from '@/api/problem';
import EditStyles from '@/app/(app)/account/styles';
import { useSession } from '@/auth/session';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));

const updateProfile = jest.mocked(account.updateProfile);

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user({ styles: ['casual'] }), accessToken: 'a', refreshToken: 'r' });
});

describe('the styles screen', () => {
  it('starts with the styles already chosen', async () => {
    await renderScreen(<EditStyles />);

    expect(screen.getByRole('checkbox', { name: 'Casual' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sporty' })).not.toBeChecked();
  });

  it('saves the chosen styles, keeps the new profile and goes back', async () => {
    updateProfile.mockResolvedValue(user({ styles: ['casual', 'sporty'] }));
    await renderScreen(<EditStyles />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sporty' }));
    await fireEvent.press(screen.getByTestId('edit-save'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ styles: ['casual', 'sporty'] }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(useSession.getState().user?.styles).toEqual(['casual', 'sporty']);
  });

  it('lets the person choose none at all, as in registration', async () => {
    updateProfile.mockResolvedValue(user({ styles: [] }));
    await renderScreen(<EditStyles />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Casual' }));
    await fireEvent.press(screen.getByTestId('edit-save'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ styles: [] }));
    await waitFor(() => expect(useSession.getState().user?.styles).toEqual([]));
  });

  it('goes back without asking the server when nothing changed', async () => {
    await renderScreen(<EditStyles />);

    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(updateProfile).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('stays, and says what to do, when the server refuses', async () => {
    updateProfile.mockRejectedValue(new ApiError({ status: 400, code: 'styles_invalid' }));
    await renderScreen(<EditStyles />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Elegant' }));
    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(await screen.findByText('One of those styles isn’t available. Pick again.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(useSession.getState().user?.styles).toEqual(['casual']);
  });
});
