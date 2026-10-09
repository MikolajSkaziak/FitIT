import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import RegisterAbout from '@/app/(auth)/register/about';
import RegisterFit from '@/app/(auth)/register/fit';
import RegisterAccount from '@/app/(auth)/register/index';
import RegisterSilhouette from '@/app/(auth)/register/silhouette';
import RegisterWeather from '@/app/(auth)/register/weather';
import { useSession } from '@/auth/session';
import { legDetails, legsNotSet } from '@/copy/labels';
import { useRegistrationDraft } from '@/features/registration/draft';
import { messages } from '@/features/registration/validation';
import * as location from '@/lib/location';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({
  ...jest.requireActual('@/api/account'),
  checkEmail: jest.fn(),
  register: jest.fn(),
  searchPlaces: jest.fn(),
  fetchAvatars: jest.fn(),
}));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn() }));

const api = jest.mocked(account);
const findDevicePlace = jest.mocked(location.findDevicePlace);

const complete = {
  email: ' ola@example.com ',
  password: 'secretpass1',
  displayName: ' Ola ',
  birthDate: { month: 3, day: '14', year: '1999' },
  gender: 'female' as const,
  avatarId: 'avatar-1',
  styles: ['casual' as const],
  thermalPreference: 'runs_cold' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  useRegistrationDraft.getState().reset();
  useSession.setState({ status: 'signedOut', user: null, accessToken: null, refreshToken: null });
});

describe('step 1: account', () => {
  const fill = async (email: string, password: string) => {
    await fireEvent.changeText(screen.getByTestId('register-email'), email);
    await fireEvent.changeText(screen.getByTestId('register-password'), password);
    await fireEvent.press(screen.getByTestId('register-next'));
  };

  it('says what is missing and asks the server nothing', async () => {
    await renderScreen(<RegisterAccount />);

    await fireEvent.press(screen.getByTestId('register-next'));

    expect(screen.getByText(messages.emailMissing)).toBeOnTheScreen();
    expect(screen.getByText(messages.passwordMissing)).toBeOnTheScreen();
    expect(api.checkEmail).not.toHaveBeenCalled();
  });

  it('stops at an address that already has an account', async () => {
    api.checkEmail.mockResolvedValue(false);
    await renderScreen(<RegisterAccount />);

    await fill('ola@example.com', 'secretpass1');

    expect(await screen.findByText(messages.emailTaken)).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('moves on when the address is free, keeping what was typed for the last step', async () => {
    api.checkEmail.mockResolvedValue(true);
    await renderScreen(<RegisterAccount />);

    await fill(' ola@example.com ', 'secretpass1');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/register/about'));
    expect(api.checkEmail).toHaveBeenCalledWith('ola@example.com');
    expect(useRegistrationDraft.getState()).toMatchObject({ email: ' ola@example.com ', password: 'secretpass1' });
  });

  it('explains a missing connection instead of pretending the address is taken', async () => {
    api.checkEmail.mockRejectedValue(new ApiError(networkProblem));
    await renderScreen(<RegisterAccount />);

    await fill('ola@example.com', 'secretpass1');

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('step 6: weather and place, on one screen', () => {
  const auth = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', displayName: 'Ola' } as account.User };
  const gliwice = { name: 'Gliwice', lat: 50.3, lon: 18.7 };
  const draftBody = {
    email: 'ola@example.com',
    password: 'secretpass1',
    displayName: 'Ola',
    birthDate: '1999-03-14',
    gender: 'female',
    avatarId: 'avatar-1',
    styles: ['casual'],
    thermalPreference: 'runs_cold',
  };

  beforeEach(() => {
    useRegistrationDraft.getState().set(complete);
    api.register.mockResolvedValue(auth);
  });

  it('offers both ways to set the place and no search until it is needed', async () => {
    await renderScreen(<RegisterWeather />);

    expect(screen.getByRole('radio', { name: 'Use my location' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Choose a city instead' })).toBeOnTheScreen();
    expect(screen.queryByTestId('place-search')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('creates the account with the rounded place of the phone and starts the session', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('register-found')).toHaveTextContent('Gliwice');
    expect(screen.queryByTestId('place-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(api.register).toHaveBeenCalledWith({ ...draftBody, location: { source: 'device', ...gliwice } });
    // Nothing typed during registration (a password among it) outlives the registration.
    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '' });
  });

  it('sends the size and leg length when they were given, and leaves them out when not', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    useRegistrationDraft.getState().set({ clothingSize: 'm', legLength: 'shorter' });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(api.register).toHaveBeenCalledWith({ ...draftBody, clothingSize: 'm', legLength: 'shorter', location: { source: 'device', ...gliwice } }));
  });

  it('shows the city search right there when the person refuses the location, and creates nothing yet', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('place-search')).toBeOnTheScreen();
    expect(screen.getByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Choose a city instead' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
    expect(api.register).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('link', { name: 'Open phone settings' }));
    expect(settings).toHaveBeenCalled();
    settings.mockRestore();
  });

  it('shows the search too when the phone cannot tell where it is', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'unavailable' });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByText('We couldn’t find your location. Try again, or choose a city.')).toBeOnTheScreen();
    expect(screen.getByTestId('place-search')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Open phone settings' })).toBeNull();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('creates the account with a city picked from the search, rounded to a tenth of a degree', async () => {
    api.searchPlaces.mockResolvedValue([{ name: 'Osaka', region: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023 }]);
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-choose-city'));
    await fireEvent.changeText(screen.getByTestId('place-search'), 'Osaka');
    await fireEvent.press(await screen.findByTestId('place-0'));
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(findDevicePlace).not.toHaveBeenCalled();
    expect(api.register).toHaveBeenCalledWith({ ...draftBody, location: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 } });
  });

  it('switches back to the phone location after a refusal, without asking the city search for anything', async () => {
    findDevicePlace.mockResolvedValueOnce({ kind: 'denied' }).mockResolvedValueOnce({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterWeather />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    expect(await screen.findByTestId('place-search')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('register-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('place-search')).toBeNull();
    expect(screen.queryByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeNull();
    await fireEvent.press(screen.getByTestId('register-submit'));
    await waitFor(() => expect(api.register).toHaveBeenCalledWith({ ...draftBody, location: { source: 'device', ...gliwice } }));
  });

  it('keeps the place of the phone when the person looks at the city search and comes back', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterWeather />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');

    await fireEvent.press(screen.getByTestId('register-choose-city'));
    expect(screen.getByTestId('place-search')).toBeOnTheScreen();
    expect(screen.queryByTestId('register-found')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(screen.getByTestId('register-found')).toHaveTextContent('Gliwice');
    expect(findDevicePlace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('lets the person skip the place: the account is created without one', async () => {
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-skip-place'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(api.register).toHaveBeenCalledWith({ ...draftBody, location: null });
    expect(findDevicePlace).not.toHaveBeenCalled();
  });

  it('goes back to the first unfinished step before creating anything', async () => {
    useRegistrationDraft.getState().set({ ...complete, avatarId: null });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-skip-place'));

    expect(router.dismissTo).toHaveBeenCalledWith('/register/silhouette');
    expect(api.register).not.toHaveBeenCalled();
  });

  it('shows the reason in its own words when the server refuses', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    api.register.mockRejectedValue(new ApiError({ status: 409, code: 'email_taken' }));
    await renderScreen(<RegisterWeather />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(await screen.findByText('There’s already an account with this email. Log in, or use a different email.')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedOut');
    expect(useRegistrationDraft.getState().email).toBe(complete.email);
  });

  it('remembers how the person feels the temperature', async () => {
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByLabelText('I run warm'));

    expect(useRegistrationDraft.getState().thermalPreference).toBe('runs_warm');
  });
});

describe('step 2: gender', () => {
  it('offers four choices and remembers the one chosen', async () => {
    await renderScreen(<RegisterAbout />);

    for (const label of ['Woman', 'Man', 'Non-binary', 'Prefer not to say']) {
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByRole('radio', { name: 'Non-binary' }));

    expect(useRegistrationDraft.getState().gender).toBe('non_binary');
    expect(screen.getByRole('radio', { name: 'Non-binary' })).toBeChecked();
  });
});

describe('step 3: body shape', () => {
  it('needs a shape before the person can go on, and says what it is used for in neutral words', async () => {
    api.fetchAvatars.mockResolvedValue([]);
    useRegistrationDraft.getState().set({ gender: 'female' });
    const view = await renderScreen(<RegisterSilhouette />);

    expect(view.getByText('Pick a body shape')).toBeOnTheScreen();
    expect(view.getByText(/only used for the try-on picture/)).toBeOnTheScreen();
    expect(view.getByText(/change it any time in Profile/)).toBeOnTheScreen();
    expect(view.queryByText(/rather not/i)).toBeNull();
    await fireEvent.press(view.getByTestId('register-next'));

    expect(view.getByText(messages.avatarMissing)).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('asks for the shape alone: size and legs have a step of their own, right after it', async () => {
    api.fetchAvatars.mockResolvedValue([]);
    useRegistrationDraft.getState().set({ gender: 'female', avatarId: 'a1', avatarGender: 'female' });
    const view = await renderScreen(<RegisterSilhouette />);

    expect(view.queryByText('Your usual size')).toBeNull();
    expect(view.queryByText('Your legs')).toBeNull();
    expect(view.queryByRole('radio', { name: 'Medium' })).toBeNull();
    expect(view.queryByTestId('register-build-note')).toBeNull();

    await fireEvent.press(view.getByTestId('register-next'));

    expect(router.push).toHaveBeenCalledWith('/register/fit');
  });

  describe('the shapes on offer', () => {
    const avatar = (id: string, gender: 'female' | 'male', bodyType: string, label: string): account.Avatar => ({
      id,
      gender,
      bodyType,
      label,
      imageUrl: `https://images.test/${id}.jpg`,
      thumbUrl: `https://images.test/${id}.jpg`,
      figureUrl: `https://images.test/${id}.png`,
    });
    const women = ['hourglass', 'pear', 'apple', 'column', 'goblet'].map((type, index) => avatar(`f${index}`, 'female', type, type));
    const men = ['triangle', 'rectangle', 'oval', 'trapezoid', 'inverted_triangle'].map((type, index) => avatar(`m${index}`, 'male', type, type));

    beforeEach(() => {
      api.fetchAvatars.mockImplementation(async (gender) => (gender === 'female' ? women : gender === 'male' ? men : [...women, ...men]));
    });

    it('shows all ten shapes in one list for the open genders', async () => {
      useRegistrationDraft.getState().set({ gender: 'non_binary' });
      await renderScreen(<RegisterSilhouette />);
      await screen.findByTestId('silhouette-oval');
      expect(screen.getAllByRole('radio')).toHaveLength(10);
      expect(screen.queryByText(/female|male|woman|man's/i)).toBeNull();
      await fireEvent.press(screen.getByTestId('silhouette-oval'));
      expect(useRegistrationDraft.getState()).toMatchObject({ avatarId: 'm2', avatarGender: 'male' });
    });

    it('shows the five of one set for the others', async () => {
      useRegistrationDraft.getState().set({ gender: 'male' });
      await renderScreen(<RegisterSilhouette />);
      await screen.findByTestId('silhouette-oval');
      expect(screen.getAllByRole('radio')).toHaveLength(5);
    });
  });
});

describe('step 4: your fit', () => {
  it('asks for the usual size and the legs with the full controls of Profile, both unset, and goes on with nothing chosen', async () => {
    const view = await renderScreen(<RegisterFit />);

    expect(view.getByText('Your fit')).toBeOnTheScreen();
    expect(view.getByText('Step 4 of 9')).toBeOnTheScreen();
    expect(view.getByText('Your usual size')).toBeOnTheScreen();
    expect(view.getByText('Your legs')).toBeOnTheScreen();
    expect(view.getByTestId('size-label')).toBeOnTheScreen();
    expect(view.getByTestId('size-letter')).toHaveTextContent('–');
    for (const label of ['Extra small', 'Small', 'Medium', 'Large', 'Extra large', 'Double extra large', 'Shorter', 'Average', 'Longer']) {
      expect(view.getByRole('radio', { name: label })).toBeOnTheScreen();
    }
    expect(view.getByTestId('size').props.accessibilityRole).toBe('radiogroup');
    expect(view.getByTestId('legs').props.accessibilityRole).toBe('radiogroup');
    expect(view.queryByRole('radio', { checked: true })).toBeNull();
    expect(view.getAllByRole('button', { name: 'Not set for now' })).toHaveLength(2);
    expect(view.getByTestId('legs-card')).toHaveTextContent(`${legsNotSet.title}${legsNotSet.hint}`);
    expect(view.getByTestId('register-build-note')).toHaveTextContent(/only help try-on pictures look right/);
    expect(view.getByTestId('register-build-note')).toHaveTextContent(/change them any time/);
    expect(view.getByRole('button', { name: 'Next' })).toBeEnabled();

    await fireEvent.press(view.getByTestId('register-next'));

    expect(router.push).toHaveBeenCalledWith('/register/style');
    expect(useRegistrationDraft.getState()).toMatchObject({ clothingSize: null, legLength: null });
  });

  it('keeps the chosen size and leg length in the draft, describes the legs, and lets either be taken back', async () => {
    const view = await renderScreen(<RegisterFit />);

    await fireEvent.press(view.getByRole('radio', { name: 'Extra large' }));
    await fireEvent.press(view.getByRole('radio', { name: 'Longer' }));
    expect(useRegistrationDraft.getState()).toMatchObject({ clothingSize: 'xl', legLength: 'longer' });
    expect(view.getByRole('radio', { name: 'Extra large', checked: true })).toBeOnTheScreen();
    expect(view.getByRole('radio', { name: 'Longer', checked: true })).toBeOnTheScreen();
    expect(view.getByTestId('size-letter')).toHaveTextContent('XL');
    expect(view.getByTestId('legs-card')).toHaveTextContent(`${legDetails.longer.title}${legDetails.longer.hint}`);

    const rather = view.getAllByRole('button', { name: 'I’d rather not say' });
    expect(rather).toHaveLength(2);
    await fireEvent.press(view.getByTestId('size-none'));
    expect(useRegistrationDraft.getState()).toMatchObject({ clothingSize: null, legLength: 'longer' });
    await fireEvent.press(view.getByTestId('legs-none'));
    expect(useRegistrationDraft.getState()).toMatchObject({ clothingSize: null, legLength: null });
    expect(view.queryByRole('radio', { checked: true })).toBeNull();
    expect(view.queryByText(/ideal|normal|big|small|fat|thin|slim/i)).toBeNull();
  });

  it('sends what was chosen here with the registration, unchanged', async () => {
    const auth = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', displayName: 'Ola' } as account.User };
    api.register.mockResolvedValue(auth);
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    useRegistrationDraft.getState().set(complete);

    const fit = await renderScreen(<RegisterFit />);
    await fireEvent.press(fit.getByRole('radio', { name: 'Large' }));
    await fireEvent.press(fit.getByRole('radio', { name: 'Shorter' }));
    fit.unmount();

    await renderScreen(<RegisterWeather />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ clothingSize: 'l', legLength: 'shorter' })));
  });
});
