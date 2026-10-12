import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as account from '@/api/account';
import EditGender from '@/app/(app)/account/gender';
import Profile from '@/app/(app)/(tabs)/profile';
import EditSilhouette from '@/app/(app)/account/silhouette';
import { useSession } from '@/auth/session';
import { user } from '@/test/fixtures';
import { expectAccent, renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn(), fetchAvatars: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(), fetchWardrobeStats: jest.fn() }));

const api = jest.mocked(account);

const male = { id: 'm1', gender: 'male' as const, bodyType: 'oval', label: 'Oval', imageUrl: 'https://images.test/m1.jpg', thumbUrl: 'https://images.test/m1.jpg', figureUrl: 'https://images.test/m1.png' };
const female = { id: 'a1', gender: 'female' as const, bodyType: 'hourglass', label: 'Hourglass', imageUrl: 'https://images.test/a1.jpg', thumbUrl: 'https://images.test/a1.jpg', figureUrl: 'https://images.test/a1.png' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
});

describe('the gender screen', () => {
  it('offers four choices', async () => {
    await renderScreen(<EditGender />);

    for (const label of ['Woman', 'Man', 'Non-binary', 'Prefer not to say']) {
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByRole('radio', { name: 'Woman' })).toBeChecked();
  });

  it('keeps the current body shape and saves at once when it is still offered', async () => {
    api.updateProfile.mockResolvedValue(user({ gender: 'non_binary' }));
    await renderScreen(<EditGender />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Non-binary' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ gender: 'non_binary' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useSession.getState().user?.gender).toBe('non_binary');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sends the person to pick another body shape when the current one is for the other set', async () => {
    await renderScreen(<EditGender />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Man' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/account/silhouette', params: { gender: 'male' } });
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('keeps a male shape too when moving from an open gender to a man, and asks again for a woman', async () => {
    useSession.setState({ user: user({ gender: 'unspecified', avatar: male }) });
    api.updateProfile.mockResolvedValue(user({ gender: 'male', avatar: male }));
    await renderScreen(<EditGender />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Woman' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Man' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ gender: 'male' }));
  });

  it('just goes back when nothing changed', async () => {
    await renderScreen(<EditGender />);

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(router.back).toHaveBeenCalled();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });
});

describe('the body shape screen for the open genders', () => {
  it('stretches the word "shape" in its title', async () => {
    api.fetchAvatars.mockResolvedValue([female, male]);
    await renderScreen(<EditSilhouette />);

    expect(screen.getByRole('header', { name: 'Body shape' })).toBeOnTheScreen();
    expectAccent('stretch', 'shape');
  });

  it('asks the server for every shape when the gender being changed to is an open one', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ gender: 'unspecified' });
    api.fetchAvatars.mockResolvedValue([female, male]);
    api.updateProfile.mockResolvedValue(user({ gender: 'unspecified', avatar: male }));
    await renderScreen(<EditSilhouette />);

    await fireEvent.press(await screen.findByTestId('silhouette-oval'));
    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(api.fetchAvatars).toHaveBeenCalledWith('unspecified');
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ gender: 'unspecified', avatarId: 'm1' }));
  });
});

describe('the profile row', () => {
  it('names the gender in plain words', async () => {
    useSession.setState({ user: user({ gender: 'unspecified' }) });
    await renderScreen(<Profile />);

    expect(screen.getByRole('button', { name: 'Gender, Prefer not to say' })).toBeOnTheScreen();
  });
});
