import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import RegisterAccount from '@/app/(auth)/register/index';
import RegisterWeather from '@/app/(auth)/register/weather';
import { useSession } from '@/auth/session';
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
}));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn() }));

const api = jest.mocked(account);
const findDevicePlace = jest.mocked(location.findDevicePlace);

const complete = {
  email: ' ola@poczta.pl ',
  password: 'tajnehaslo1',
  displayName: ' Ola ',
  birthDate: '14.03.1999',
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

    await fill('ola@poczta.pl', 'tajnehaslo1');

    expect(await screen.findByText(messages.emailTaken)).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('moves on when the address is free, keeping what was typed for the last step', async () => {
    api.checkEmail.mockResolvedValue(true);
    await renderScreen(<RegisterAccount />);

    await fill(' ola@poczta.pl ', 'tajnehaslo1');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/register/about'));
    expect(api.checkEmail).toHaveBeenCalledWith('ola@poczta.pl');
    expect(useRegistrationDraft.getState()).toMatchObject({ email: ' ola@poczta.pl ', password: 'tajnehaslo1' });
  });

  it('explains a missing connection instead of pretending the address is taken', async () => {
    api.checkEmail.mockRejectedValue(new ApiError(networkProblem));
    await renderScreen(<RegisterAccount />);

    await fill('ola@poczta.pl', 'tajnehaslo1');

    expect(await screen.findByText('Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('step 5: weather', () => {
  const auth = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', displayName: 'Ola' } as account.User };

  it('creates the account with the rounded place of the phone and starts the session', async () => {
    useRegistrationDraft.getState().set(complete);
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    api.register.mockResolvedValue(auth);
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(api.register).toHaveBeenCalledWith({
      email: 'ola@poczta.pl',
      password: 'tajnehaslo1',
      displayName: 'Ola',
      birthDate: '1999-03-14',
      gender: 'female',
      avatarId: 'avatar-1',
      styles: ['casual'],
      thermalPreference: 'runs_cold',
      location: { source: 'device', name: 'Gliwice', lat: 50.3, lon: 18.7 },
    });
    // Nothing typed during registration (a password among it) outlives the registration.
    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '' });
  });

  it('offers the city instead when the person refuses the location, without creating anything yet', async () => {
    useRegistrationDraft.getState().set(complete);
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/register/city'));
    expect(api.register).not.toHaveBeenCalled();
  });

  it('says so when the phone cannot tell where it is', async () => {
    useRegistrationDraft.getState().set(complete);
    findDevicePlace.mockResolvedValue({ kind: 'unavailable' });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(await screen.findByText('Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wpisz miasto.')).toBeOnTheScreen();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('goes back to the first unfinished step before asking for the location', async () => {
    useRegistrationDraft.getState().set({ ...complete, avatarId: null });
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(router.dismissTo).toHaveBeenCalledWith('/register/silhouette');
    expect(findDevicePlace).not.toHaveBeenCalled();
  });

  it('shows the reason in its own words when the server refuses', async () => {
    useRegistrationDraft.getState().set(complete);
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    api.register.mockRejectedValue(new ApiError({ status: 409, code: 'email_taken' }));
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(await screen.findByText('Ten adres ma już konto. Zaloguj się albo podaj inny.')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedOut');
    expect(useRegistrationDraft.getState().email).toBe(complete.email);
  });

  it('remembers how the person feels the temperature', async () => {
    useRegistrationDraft.getState().set(complete);
    await renderScreen(<RegisterWeather />);

    await fireEvent.press(screen.getByLabelText('Jest mi ciepło'));

    expect(useRegistrationDraft.getState().thermalPreference).toBe('runs_warm');
  });
});
