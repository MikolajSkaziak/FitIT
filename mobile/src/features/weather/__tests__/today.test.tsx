import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/api/account';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import * as weatherApi from '@/api/weather';
import Today from '@/app/(app)/(tabs)/index';
import { useSession } from '@/auth/session';
import * as location from '@/lib/location';
import { user, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchUsage: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn() }));

const fetchWeather = jest.mocked(weatherApi.fetchWeatherToday);
const fetchStats = jest.mocked(wardrobe.fetchWardrobeStats);
const fetchUsage = jest.mocked(wardrobe.fetchUsage);
const updateProfile = jest.mocked(account.updateProfile);
const findDevicePlace = jest.mocked(location.findDevicePlace);

const usage = (used: number, limit = 20): wardrobe.Usage => ({
  items: { used: 2, limit: 50 },
  suggestions: { used, limit },
  visualizations: { used: 0, limit: 5 },
  resetsAt: '2026-10-06T00:00:00+02:00',
});

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  fetchWeather.mockResolvedValue(weather);
  fetchStats.mockResolvedValue({ total: 12, wornLast30Days: 3, forgotten: 1, processing: 0, needsTags: 0 });
  fetchUsage.mockResolvedValue(usage(3));
});

const noPlace = () => fetchWeather.mockRejectedValue(new ApiError({ status: 409, code: 'location_missing' }));

describe('the weather', () => {
  it('shows the place, the range, the sky and what to do about it, as in the mock-up', async () => {
    await renderScreen(<Today />);

    expect(await screen.findByText('Gliwice')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-range')).toHaveTextContent('7-18°C');
    expect(screen.getByText('Słonecznie, bez opadów')).toBeOnTheScreen();
    expect(screen.getByText('Rano chłodno, przyda się warstwa do zdjęcia.')).toBeOnTheScreen();
    expect(screen.getByText(/Cześć, Ola\. Dziś .+, 5 października\./)).toBeOnTheScreen();
    expect(screen.getByText('Co dziś', { exact: false })).toBeOnTheScreen();
  });

  it('says it is about tomorrow once the evening has come, with the date of the place', async () => {
    fetchWeather.mockResolvedValue({ ...weather, forTomorrow: true, from: '2026-10-06T07:00:00+02:00', to: '2026-10-06T22:00:00+02:00' });

    await renderScreen(<Today />);

    expect(await screen.findByText('Gliwice, jutro')).toBeOnTheScreen();
    expect(screen.getByText(/Jutro .+, 6 października\./)).toBeOnTheScreen();
    expect(screen.getByText('Co jutro', { exact: false })).toBeOnTheScreen();
  });

  it('holds the place of the forecast with a skeleton while it is on its way', async () => {
    fetchWeather.mockReturnValue(new Promise(() => undefined));

    await renderScreen(<Today />);

    expect(screen.getByTestId('weather-loading')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zaproponuj zestawy' }).props.accessibilityState.disabled).toBe(true);
  });

  it('says what happened when the forecast is not available, and tries again on request', async () => {
    fetchWeather.mockRejectedValueOnce(new ApiError({ status: 503, code: 'weather_unavailable' }));

    await renderScreen(<Today />);

    expect(await screen.findByText('Nie udało się pobrać prognozy pogody. Spróbuj ponownie za chwilę.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zaproponuj zestawy' }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByText('Gliwice')).toBeOnTheScreen();
    expect(fetchWeather).toHaveBeenCalledTimes(2);
  });

  it('says there is no connection, and offers the same way out', async () => {
    fetchWeather.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));

    await renderScreen(<Today />);

    expect(await screen.findByText('Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeOnTheScreen();
  });
});

describe('without a place', () => {
  it('asks for the location or a city, and leaves the proposals button disabled next to that reason', async () => {
    noPlace();

    await renderScreen(<Today />);

    expect(await screen.findByText('Nie wiemy, gdzie sprawdzić pogodę')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zaproponuj zestawy' }).props.accessibilityState.disabled).toBe(true);
  });

  it('takes the place from the phone and asks for the weather again', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    updateProfile.mockResolvedValue(user());
    await renderScreen(<Today />);

    fetchWeather.mockResolvedValue(weather);
    await fireEvent.press(await screen.findByRole('button', { name: 'Włącz lokalizację' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'device', name: 'Gliwice', lat: 50.3, lon: 18.7 } }));
    expect(await screen.findByTestId('weather-row')).toBeOnTheScreen();
  });

  it('says what to do when the phone refuses, and keeps the city as the way out', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    await renderScreen(<Today />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Włącz lokalizację' }));

    expect(await screen.findByText('Nie masz zgody na lokalizację. Wpisz miasto albo włącz ją w ustawieniach telefonu.')).toBeOnTheScreen();
    expect(updateProfile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('link', { name: 'Wpisz miasto' }));
    expect(router.push).toHaveBeenCalledWith('/account/place');
  });

  it('says so when the phone could not tell where it is', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'unavailable' });
    await renderScreen(<Today />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Włącz lokalizację' }));

    expect(await screen.findByText('Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wpisz miasto.')).toBeOnTheScreen();
  });
});

describe('asking for proposals', () => {
  it('opens the proposals for the chosen occasion with the note, trimmed', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('weather-row');

    await fireEvent.press(screen.getByRole('radio', { name: 'Praca lub uczelnia' }));
    await fireEvent.changeText(screen.getByTestId('occasion-note'), '  prezentacja przed klientem  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Zaproponuj zestawy' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/proposals',
      params: { request: expect.any(String), occasion: 'work', note: 'prezentacja przed klientem' },
    });
  });

  it('starts with everyday and sends no note when there is none', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('weather-row');

    expect(screen.getByRole('radio', { name: 'Na co dzień' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Zaproponuj zestawy' }));

    const [route] = router.push.mock.calls[0] as [{ params: Record<string, string> }];
    expect(route.params).toEqual({ request: expect.any(String), occasion: 'everyday' });
  });

  it('asks again with a new request each time, so that going back never repeats an old answer', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('weather-row');

    await fireEvent.press(screen.getByRole('button', { name: 'Zaproponuj zestawy' }));
    await new Promise((done) => setTimeout(done, 2));
    await fireEvent.press(screen.getByRole('button', { name: 'Zaproponuj zestawy' }));

    const ids = router.push.mock.calls.map(([route]) => (route as { params: { request: string } }).params.request);
    expect(new Set(ids).size).toBe(2);
  });

  it('says how many proposals are left for today', async () => {
    await renderScreen(<Today />);

    expect(await screen.findByText('Zostało 17 z 20 propozycji na dziś.')).toBeOnTheScreen();
  });

  it('says the limit is used up, next to the disabled button', async () => {
    fetchUsage.mockResolvedValue(usage(20));

    await renderScreen(<Today />);

    expect(await screen.findByText('Dzisiejszy limit propozycji jest wykorzystany. Wróć jutro.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zaproponuj zestawy' }).props.accessibilityState.disabled).toBe(true);
  });
});

describe('an empty wardrobe', () => {
  it('keeps the first screen of the app: add clothes, nothing to propose from yet', async () => {
    fetchStats.mockResolvedValue({ total: 0, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });

    await renderScreen(<Today />);

    expect(await screen.findByTestId('today-empty')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Zaproponuj zestawy' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj ubrania' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });
});
