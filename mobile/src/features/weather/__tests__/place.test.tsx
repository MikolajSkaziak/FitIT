import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { withTiming } from 'react-native-reanimated';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import EditPlace from '@/app/(app)/account/place';
import EditThermalPreference from '@/app/(app)/account/thermal';
import { useSession } from '@/auth/session';
import { hasMoved, useKeepPlaceCurrent } from '@/features/weather/place';
import * as location from '@/lib/location';
import { motion } from '@/theme';
import { user } from '@/test/fixtures';
import { expectAccent, renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn(), searchPlaces: jest.fn() }));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn(), hasLocationAccess: jest.fn() }));

const updateProfile = jest.mocked(account.updateProfile);
const searchPlaces = jest.mocked(account.searchPlaces);
const findDevicePlace = jest.mocked(location.findDevicePlace);
const hasLocationAccess = jest.mocked(location.hasLocationAccess);

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
});

describe('hasMoved', () => {
  it('compares the rounded coordinates, and counts a missing place as moved', () => {
    expect(hasMoved({ lat: 50.3, lon: 18.7 }, { lat: 50.3, lon: 18.7 })).toBe(false);
    expect(hasMoved({ lat: 50.3, lon: 18.7 }, { lat: 50.4, lon: 18.7 })).toBe(true);
    expect(hasMoved({ lat: 50.3, lon: 18.7 }, { lat: 50.3, lon: 18.8 })).toBe(true);
    expect(hasMoved(null, { lat: 50.3, lon: 18.7 })).toBe(true);
  });
});

describe('the place screen', () => {
  it('says where the weather is checked now', async () => {
    await renderScreen(<EditPlace />);

    expect(screen.getByTestId('place-current')).toHaveTextContent('Now: Gliwice, from your phone’s location.');
  });

  it('takes the place from the phone and goes back', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Krakow', lat: 50.1, lon: 19.9 } });
    updateProfile.mockResolvedValue(user({ location: { source: 'device', name: 'Krakow', lat: 50.1, lon: 19.9 } }));
    await renderScreen(<EditPlace />);

    await fireEvent.press(screen.getByRole('button', { name: 'Use phone location' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'device', name: 'Krakow', lat: 50.1, lon: 19.9 } });
    expect(useSession.getState().user?.location?.name).toBe('Krakow');
  });

  it('stays, and says why, when the phone will not tell where it is', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    await renderScreen(<EditPlace />);

    await fireEvent.press(screen.getByRole('button', { name: 'Use phone location' }));

    expect(await screen.findByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('points to the settings of the phone when permission was refused', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(<EditPlace />);

    await fireEvent.press(screen.getByRole('button', { name: 'Use phone location' }));
    await fireEvent.press(await screen.findByRole('link', { name: 'Open phone settings' }));

    expect(settings).toHaveBeenCalled();
    settings.mockRestore();
  });

  it('saves a city picked from the search, rounded to a tenth of a degree like the phone location', async () => {
    searchPlaces.mockResolvedValue([{ name: 'Osaka', region: 'Osaka', country: 'Japonia', lat: 34.6937, lon: 135.5023 }]);
    updateProfile.mockResolvedValue(user({ location: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 } }));
    await renderScreen(<EditPlace />);

    await fireEvent.changeText(screen.getByTestId('place-search'), 'Osaka');
    await fireEvent.press(await screen.findByTestId('place-0'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 } });
  });

  it('asks for a city from the list instead of saving nothing', async () => {
    await renderScreen(<EditPlace />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Pick a place from the list.')).toBeOnTheScreen();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('the thermal preference screen', () => {
  it('starts on what is saved, with Save waiting until something changes', async () => {
    await renderScreen(<EditThermalPreference />);

    expect(screen.getByRole('radio', { name: 'About average' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Profile')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'How you feel the cold' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(updateProfile).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  describe('the word "cold" in its title', () => {
    // How many steps of a given size were timed since the last clear: 1.5 is a shiver (two of the five steps), a move of 1 over the exit duration is the out-step of a rise.
    const shivers = () => jest.mocked(withTiming).mock.calls.filter(([to]) => to === 1.5).length;
    const rises = () => jest.mocked(withTiming).mock.calls.filter(([to, config]) => to === 1 && (config as { duration: number }).duration === motion.exit).length;

    it('is the green italic accent, and shivers when the screen has arrived', async () => {
      await renderScreen(<EditThermalPreference />);

      expectAccent('shiver', 'cold');
      expect(screen.getByRole('header', { name: 'How you feel the cold' })).toBeOnTheScreen();
      expect(shivers()).toBe(2);
    });

    it('shivers again when Cold is chosen: the word, the care label and the sentence', async () => {
      await renderScreen(<EditThermalPreference />);
      jest.mocked(withTiming).mockClear();

      await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));

      expect(shivers()).toBe(6);
      expect(rises()).toBe(0);
    });

    it('rises when Warm is chosen (the word, the care label and the sentence), and does not shiver', async () => {
      await renderScreen(<EditThermalPreference />);
      jest.mocked(withTiming).mockClear();

      await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));

      expect(shivers()).toBe(0);
      expect(rises()).toBe(3);
    });

    it('does nothing for About average, whatever was chosen before, other than the thermometer of its own stop', async () => {
      await renderScreen(<EditThermalPreference />);
      await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));
      jest.mocked(withTiming).mockClear();

      await fireEvent.press(screen.getByRole('radio', { name: 'About average' }));

      expect(shivers()).toBe(0);
      expect(rises()).toBe(1);
    });

    it('does not play again for the answer already chosen when the screen opened', async () => {
      useSession.setState({ user: user({ thermalPreference: 'runs_cold' }) });
      await renderScreen(<EditThermalPreference />);

      expect(shivers()).toBe(2);
      jest.mocked(withTiming).mockClear();
      await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
      expect(shivers()).toBe(0);
    });
  });

  it('saves the new preference and goes back', async () => {
    updateProfile.mockResolvedValue(user({ thermalPreference: 'runs_cold' }));
    await renderScreen(<EditThermalPreference />);

    await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ thermalPreference: 'runs_cold' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(useSession.getState().user?.thermalPreference).toBe('runs_cold');
  });

  it('puts the answer back to disabled when the person returns to what was saved', async () => {
    await renderScreen(<EditThermalPreference />);

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'About average' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps the saved preference and the person’s choice when saving fails, says so, and can try again', async () => {
    updateProfile.mockRejectedValueOnce(new ApiError(networkProblem));
    await renderScreen(<EditThermalPreference />);

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(useSession.getState().user?.thermalPreference).toBe('normal');
    expect(screen.getByRole('radio', { name: 'I run warm' })).toBeChecked();
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('keeping the place current', () => {
  function Keeper() {
    useKeepPlaceCurrent();
    return null;
  }

  const open = async () => {
    let onChange: (state: string) => void = () => undefined;
    const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: string) => void) => {
      onChange = handler;
      return { remove: jest.fn() };
    }) as never);
    await renderScreen(<Keeper />);
    expect(listen).toHaveBeenCalledWith('change', expect.any(Function));
    return { comeForward: () => act(async () => onChange('active')) };
  };

  afterEach(() => jest.restoreAllMocks());

  it('replaces a place taken from the phone when the phone has moved', async () => {
    hasLocationAccess.mockResolvedValue(true);
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Krakow', lat: 50.1, lon: 19.9 } });
    updateProfile.mockResolvedValue(user({ location: { source: 'device', name: 'Krakow', lat: 50.1, lon: 19.9 } }));

    await open();

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'device', name: 'Krakow', lat: 50.1, lon: 19.9 } }));
    expect(useSession.getState().user?.location?.name).toBe('Krakow');
  });

  it('does it again when the app comes back to the foreground', async () => {
    hasLocationAccess.mockResolvedValue(true);
    findDevicePlace.mockResolvedValueOnce({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    const { comeForward } = await open();
    await waitFor(() => expect(findDevicePlace).toHaveBeenCalledTimes(1));
    findDevicePlace.mockResolvedValueOnce({ kind: 'found', place: { name: 'Vienna', lat: 48.2, lon: 16.4 } });
    updateProfile.mockResolvedValue(user({ location: { source: 'device', name: 'Vienna', lat: 48.2, lon: 16.4 } }));

    await comeForward();

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'device', name: 'Vienna', lat: 48.2, lon: 16.4 } }));
  });

  it('leaves the profile alone when the phone is where it was', async () => {
    hasLocationAccess.mockResolvedValue(true);
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });

    await open();

    await waitFor(() => expect(findDevicePlace).toHaveBeenCalled());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('never touches a city the person typed in', async () => {
    useSession.setState({ user: user({ location: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 } }) });
    hasLocationAccess.mockResolvedValue(true);

    await open();

    expect(findDevicePlace).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('asks nothing of the person: without permission already given, it does nothing', async () => {
    hasLocationAccess.mockResolvedValue(false);

    await open();

    await waitFor(() => expect(hasLocationAccess).toHaveBeenCalled());
    expect(findDevicePlace).not.toHaveBeenCalled();
  });

  it('keeps the old place when the phone cannot say where it is or the server refuses', async () => {
    hasLocationAccess.mockResolvedValue(true);
    findDevicePlace.mockResolvedValueOnce({ kind: 'unavailable' });
    const { comeForward } = await open();
    await waitFor(() => expect(findDevicePlace).toHaveBeenCalledTimes(1));

    findDevicePlace.mockResolvedValueOnce({ kind: 'found', place: { name: 'Vienna', lat: 48.2, lon: 16.4 } });
    updateProfile.mockRejectedValue(new Error('offline'));
    await comeForward();

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(useSession.getState().user?.location?.name).toBe('Gliwice');
  });
});
