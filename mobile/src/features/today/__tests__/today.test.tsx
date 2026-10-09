import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import * as account from '@/api/account';
import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import * as weatherApi from '@/api/weather';
import Today from '@/app/(app)/(tabs)/index';
import { useSession } from '@/auth/session';
import * as location from '@/lib/location';
import { clothing, outfit, user, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchClothes: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
jest.mock('@/api/outfits', () => ({ ...jest.requireActual('@/api/outfits'), fetchTodaysOutfits: jest.fn() }));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn() }));

const fetchWeather = jest.mocked(weatherApi.fetchWeatherToday);
const fetchStats = jest.mocked(wardrobe.fetchWardrobeStats);
const fetchClothes = jest.mocked(wardrobe.fetchClothes);
const fetchPicks = jest.mocked(outfits.fetchTodaysOutfits);
const updateProfile = jest.mocked(account.updateProfile);
const findDevicePlace = jest.mocked(location.findDevicePlace);

const stats = (total: number, forgotten = 0): wardrobe.WardrobeStats => ({ total, wornLast30Days: 3, forgotten, processing: 0, needsTags: 0 });

const answer = (list: outfits.Outfit[], change: Partial<outfits.Suggestions> = {}): outfits.Suggestions => ({
  status: 'proposed',
  missing: [],
  missingEither: [],
  fallback: false,
  occasion: 'everyday',
  weather,
  relaxations: [],
  umbrella: false,
  outfits: list,
  ...change,
});

const three = [
  outfit('o1', { kind: 'sure_bet', reasoning: 'Light enough for a mild day. Add a layer if you stay out late.' }),
  outfit('o2', { kind: 'new_pairing', reasoning: 'The chinos and the coat have not met yet.' }),
  outfit('o3', { kind: null, reasoning: 'Simple and warm.', items: [{ slot: 'top', clothing: clothing('g9', 'Cream sweater', 'top') }] }),
];

const workPicks = [outfit('w1', { requestId: 'request-work', occasion: 'work', kind: 'sure_bet', reasoning: 'Smart enough for the office.' })];

const jacket = clothing('f1', 'Navy jacket', 'outerwear', { isForgotten: true });

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  fetchWeather.mockResolvedValue(weather);
  fetchStats.mockResolvedValue(stats(12));
  fetchClothes.mockResolvedValue([]);
  fetchPicks.mockImplementation(async (occasion) => (occasion === 'work' ? answer(workPicks, { occasion: 'work' }) : answer(three)));
});

const noPlace = () => fetchWeather.mockRejectedValue(new ApiError({ status: 409, code: 'location_missing' }));

/** Scrolls the row of cards as a swipe would, on a 390 wide phone with three cards. */
const swipeTo = (x: number) =>
  fireEvent.scroll(screen.getByTestId('today-picks'), {
    nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 842, height: 367 }, layoutMeasurement: { width: 390, height: 367 } },
  });

describe('the greeting', () => {
  it('says the date of the place, greets by the hour there and by name, and leads to the profile', async () => {
    await renderScreen(<Today />);

    await screen.findByTestId('weather-row');
    expect(screen.getByTestId('today-date')).toHaveTextContent(/^\w+, October 5$/);
    expect(screen.getByTestId('today-greeting')).toHaveTextContent('Good morning, Ola');
    expect(screen.getByRole('header', { name: 'Good morning, Ola' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(router.navigate).toHaveBeenCalledWith('/profile');
    expect(within(screen.getByTestId('today-profile')).getByText('O')).toBeOnTheScreen();
  });

  it.each([
    ['2026-10-05T13:00:00+02:00', 'Good afternoon, Ola'],
    ['2026-10-05T19:00:00+02:00', 'Good evening, Ola'],
    ['2026-10-05T02:00:00+02:00', 'Good evening, Ola'],
  ])('follows the clock of the place: %s', async (from, greeting) => {
    fetchWeather.mockResolvedValue({ ...weather, from });

    await renderScreen(<Today />);

    await screen.findByTestId('weather-row');
    expect(screen.getByTestId('today-greeting')).toHaveTextContent(greeting);
  });
});

describe('the weather card', () => {
  it('shows the place, how it feels now, the sky, the advice and the hours to the evening', async () => {
    await renderScreen(<Today />);

    expect(await screen.findByText('Gliwice')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-now')).toHaveTextContent('7°');
    expect(screen.getByText('Sunny, no rain')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-range')).toHaveTextContent('Feels like 7-18°C. It’ll be cool in the morning. Wear a layer you can take off.');

    const hours = within(screen.getByTestId('weather-hours'));
    expect(hours.getByText('Now')).toBeOnTheScreen();
    expect(hours.getByText('7°')).toBeOnTheScreen();
    expect(hours.getByText('1 pm')).toBeOnTheScreen();
    expect(hours.getByText('16°')).toBeOnTheScreen();
    expect(hours.getByText('6 pm')).toBeOnTheScreen();
    expect(hours.getByText('14° rain')).toBeOnTheScreen();
    expect(hours.getByText('10 pm')).toBeOnTheScreen();
    expect(hours.getByText('9°')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-row').props.accessibilityLabel).toBe(
      'Gliwice. 7° now, feels like 7-18°C today. Sunny, no rain. It’ll be cool in the morning. Wear a layer you can take off. 1 pm: 16°. 6 pm: 14° rain. 10 pm: 9°.',
    );
  });

  it('shows the hours there are when the day is nearly over', async () => {
    fetchWeather.mockResolvedValue({ ...weather, hours: [{ time: '2026-10-05T22:00:00+02:00', feels: -2, sky: 'snow' }, { time: '2026-10-05T23:00:00+02:00', feels: -3, sky: 'cloud' }] });

    await renderScreen(<Today />);

    const hours = within(await screen.findByTestId('weather-hours'));
    expect(hours.getByText('−2° snow')).toBeOnTheScreen();
    expect(hours.getByText('11 pm')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-now')).toHaveTextContent('−2°');
  });

  it('leaves the strip out when the server sent no hours, and shows the coldest it will feel', async () => {
    fetchWeather.mockResolvedValue({ ...weather, hours: [] });

    await renderScreen(<Today />);

    await screen.findByTestId('weather-row');
    expect(screen.queryByTestId('weather-hours')).toBeNull();
    expect(screen.getByTestId('weather-now')).toHaveTextContent('7°');
  });

  it('holds the place of the forecast with a skeleton while it is on its way', async () => {
    fetchWeather.mockReturnValue(new Promise(() => undefined));

    await renderScreen(<Today />);

    expect(screen.getByTestId('weather-loading')).toBeOnTheScreen();
  });

  it('says what happened when the forecast is not available, and tries again on request', async () => {
    fetchWeather.mockRejectedValueOnce(new ApiError({ status: 503, code: 'weather_unavailable' }));

    await renderScreen(<Today />);

    expect(await screen.findByText('We couldn’t get the forecast. Try again in a moment.')).toBeOnTheScreen();

    await fireEvent.press(within(screen.getByTestId('weather-problem')).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Gliwice')).toBeOnTheScreen();
    expect(fetchWeather).toHaveBeenCalledTimes(2);
  });

  it('says there is no connection, and offers the same way out', async () => {
    fetchWeather.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));

    await renderScreen(<Today />);

    const problem = within(await screen.findByTestId('weather-problem'));
    expect(problem.getByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(problem.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});

describe('without a place', () => {
  it('asks for the location or a city, and asks for no outfits until there is one', async () => {
    noPlace();

    await renderScreen(<Today />);

    expect(await screen.findByText('Where should we check the weather?')).toBeOnTheScreen();
    expect(screen.getByTestId('today-picks-place')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Suggest new outfits' })).toBeNull();
    expect(fetchPicks).not.toHaveBeenCalled();
  });

  it('takes the place from the phone, asks for the weather again and then for the picks', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    updateProfile.mockResolvedValue(user());
    await renderScreen(<Today />);

    fetchWeather.mockResolvedValue(weather);
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on location' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ location: { source: 'device', name: 'Gliwice', lat: 50.3, lon: 18.7 } }));
    expect(await screen.findByTestId('weather-row')).toBeOnTheScreen();
    expect(await screen.findByTestId('today-picks')).toBeOnTheScreen();
  });

  it('says what to do when the phone refuses, and keeps the city as the way out', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    await renderScreen(<Today />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on location' }));

    expect(await screen.findByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeOnTheScreen();
    expect(updateProfile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('link', { name: 'Choose a city' }));
    expect(router.push).toHaveBeenCalledWith('/account/place');
  });

  it('says so when the phone could not tell where it is', async () => {
    noPlace();
    findDevicePlace.mockResolvedValue({ kind: 'unavailable' });
    await renderScreen(<Today />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on location' }));

    expect(await screen.findByText('We couldn’t find your location. Try again, or choose a city.')).toBeOnTheScreen();
  });
});

describe('today’s picks', () => {
  it('are there without pressing anything: everyday outfits on the figure, the first one in front', async () => {
    await renderScreen(<Today />);

    expect(await screen.findByTestId('today-picks')).toBeOnTheScreen();
    expect(fetchPicks).toHaveBeenCalledTimes(1);
    expect(fetchPicks).toHaveBeenCalledWith('everyday');
    expect(screen.getByRole('header', { name: 'Today’s picks' })).toBeOnTheScreen();
    expect(screen.getByTestId('today-picks-line')).toHaveTextContent('Three outfits from your wardrobe, for this weather');

    // Each card is a button named by the outfit and its place, with the kind and the count on it and the figure inside.
    const first = screen.getByRole('button', { name: 'Your sure bet, 1 of 3' });
    expect(within(first).getByText('Sure bet')).toBeOnTheScreen();
    expect(within(first).getByText('1 of 3')).toBeOnTheScreen();
    expect(within(first).getByTestId('today-figure-o1', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'A new pairing, 2 of 3' })).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: 'Outfit 3, 3 of 3' })).getByText('Outfit 3')).toBeOnTheScreen();

    // Under the row: the name, one sentence of the reason, and the pieces of the card in front.
    expect(screen.getByTestId('today-pick-name')).toHaveTextContent('Your sure bet');
    expect(screen.getByTestId('today-pick-reason')).toHaveTextContent('Light enough for a mild day.');
    const pieces = within(screen.getByTestId('today-pieces'));
    expect(pieces.getByText('Navy shirt')).toBeOnTheScreen();
    expect(pieces.getByText('Gray coat')).toBeOnTheScreen();
    expect(pieces.getByText('Beige chinos')).toBeOnTheScreen();
    expect(pieces.getByText('White sneakers')).toBeOnTheScreen();

    // Nothing to act with under the outfit: the actions live on its own page.
    expect(screen.queryByRole('button', { name: 'Wear this' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Suggest outfits' })).toBeNull();
    expect(screen.queryByTestId('occasion-note')).toBeNull();
  });

  it('follows the swipe: the card in front changes what is said under the row', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');

    await swipeTo(274);
    expect(screen.getByTestId('today-pick-name')).toHaveTextContent('A new pairing');
    expect(screen.getByTestId('today-pick-reason')).toHaveTextContent('The chinos and the coat have not met yet.');

    // The last card cannot travel a whole step; the end of the row is the last card.
    await swipeTo(452);
    expect(screen.getByTestId('today-pick-name')).toHaveTextContent('Outfit 3');
    const pieces = within(screen.getByTestId('today-pieces'));
    expect(pieces.getByText('Cream sweater')).toBeOnTheScreen();
    expect(pieces.queryByText('Navy shirt')).toBeNull();

    await swipeTo(0);
    expect(screen.getByTestId('today-pick-name')).toHaveTextContent('Your sure bet');
  });

  it('opens the proposal’s own page when a card is pressed', async () => {
    await renderScreen(<Today />);

    await fireEvent.press(await screen.findByRole('button', { name: 'A new pairing, 2 of 3' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'o2' } });
  });

  it('shows cards of the same size while the stylist is at work', async () => {
    fetchPicks.mockReturnValue(new Promise(() => undefined));

    await renderScreen(<Today />);

    expect(await screen.findByTestId('weather-row')).toBeOnTheScreen();
    expect(screen.getByTestId('today-picks-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-picks')).toBeNull();
    expect(screen.getByRole('button', { name: 'Suggest new outfits' }).props.accessibilityState.disabled).toBe(true);
  });

  it('says what happened when the picks could not be had, and tries again on request', async () => {
    fetchPicks.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' }));

    await renderScreen(<Today />);

    const problem = within(await screen.findByTestId('today-picks-problem'));
    expect(problem.getByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();

    await fireEvent.press(problem.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('today-picks')).toBeOnTheScreen();
    expect(fetchPicks).toHaveBeenCalledTimes(2);
  });

  it('says the day’s limit is used up when there are no picks to show, with nothing to retry', async () => {
    fetchPicks.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));

    await renderScreen(<Today />);

    const problem = within(await screen.findByTestId('today-picks-problem'));
    expect(problem.getByText('You’ve hit today’s limit. More tomorrow.')).toBeOnTheScreen();
    expect(problem.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('counts one outfit as one', async () => {
    fetchPicks.mockResolvedValue(answer([three[0]!]));

    await renderScreen(<Today />);

    expect(await screen.findByRole('button', { name: 'Your sure bet, 1 of 1' })).toBeOnTheScreen();
    expect(screen.getByTestId('today-picks-line')).toHaveTextContent('One outfit from your wardrobe, for this weather');
  });
});

describe('asking for a fresh set', () => {
  it('replaces the picks with new ones and starts from the first card again', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');
    await swipeTo(274);
    fetchPicks.mockResolvedValue(answer([outfit('n1', { requestId: 'request-2', kind: 'discovery', reasoning: 'Something you have not worn in a while.' })]));

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest new outfits' }));

    expect(await screen.findByRole('button', { name: 'Something rediscovered, 1 of 1' })).toBeOnTheScreen();
    expect(fetchPicks).toHaveBeenLastCalledWith('everyday', true);
    expect(screen.getByTestId('today-pick-name')).toHaveTextContent('Something rediscovered');
    expect(screen.queryByTestId('today-limit')).toBeNull();
  });

  it('keeps the picks and says the limit is reached when the server refuses', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');
    fetchPicks.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest new outfits' }));

    expect(await screen.findByTestId('today-limit')).toHaveTextContent('You’ve hit today’s limit. More tomorrow.');
    expect(screen.getByRole('button', { name: 'Your sure bet, 1 of 3' })).toBeOnTheScreen();
  });
});

describe('dressing for something else', () => {
  it('offers all six occasions as one radio group, everyday first and chosen', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');

    expect(screen.getByRole('header', { name: 'Dressing for something else?' })).toBeOnTheScreen();
    const group = screen.getByTestId('today-occasions');
    expect([group.props.accessibilityRole, group.props.accessibilityLabel]).toEqual(['radiogroup', 'Occasion']);
    expect(within(group).getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(['Everyday', 'Work', 'Business', 'Date night', 'Friends', 'Workout']);
    expect(screen.getByRole('radio', { name: 'Everyday' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Work' }).props.accessibilityState.checked).toBe(false);
  });

  it('loads the picks of the chosen occasion into the row, and those of the first one on the way back', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');

    await fireEvent.press(screen.getByRole('radio', { name: 'Work' }));

    expect(await screen.findByTestId('today-pick-w1')).toBeOnTheScreen();
    expect(fetchPicks).toHaveBeenLastCalledWith('work');
    expect(screen.getByRole('radio', { name: 'Work' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('today-pick-reason')).toHaveTextContent('Smart enough for the office.');
    expect(screen.queryByTestId('today-pick-o1')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Everyday' }));

    expect(await screen.findByTestId('today-pick-o1')).toBeOnTheScreen();
    expect(fetchPicks).toHaveBeenLastCalledWith('everyday');
    expect(screen.queryByTestId('today-pick-w1')).toBeNull();
  });

  it('asks for a fresh set of the occasion that is chosen', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-picks');
    await fireEvent.press(screen.getByRole('radio', { name: 'Work' }));
    await screen.findByTestId('today-pick-w1');

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest new outfits' }));

    await waitFor(() => expect(fetchPicks).toHaveBeenLastCalledWith('work', true));
  });
});

describe('too few clothes', () => {
  it('with an empty wardrobe the picks give way to the first step: add clothes', async () => {
    fetchStats.mockResolvedValue(stats(0));

    await renderScreen(<Today />);

    const empty = within(await screen.findByTestId('today-empty'));
    expect(empty.getByRole('header', { name: 'Start with your wardrobe' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Today’s picks' })).toBeNull();
    expect(screen.queryByTestId('today-occasions')).toBeNull();
    expect(screen.queryByTestId('today-nudge')).toBeNull();
    expect(fetchPicks).not.toHaveBeenCalled();
    // The weather is still told.
    expect(await screen.findByTestId('weather-row')).toBeOnTheScreen();

    await fireEvent.press(empty.getByRole('button', { name: 'Add clothes' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });

  it('with a wardrobe that cannot make an outfit yet, says what is missing and keeps the occasions', async () => {
    fetchStats.mockResolvedValue(stats(12));
    fetchPicks.mockResolvedValue(answer([], { status: 'missing_garments', missing: ['shoes'] }));

    await renderScreen(<Today />);

    const empty = within(await screen.findByTestId('today-empty'));
    expect(empty.getByRole('header')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-picks')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Suggest new outfits' })).toBeNull();
    expect(screen.getByTestId('today-occasions')).toBeOnTheScreen();

    await fireEvent.press(empty.getByRole('button', { name: 'Add clothes' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });
});

describe('the wardrobe nudge', () => {
  it('counts the pieces, shows the newest three and how far ten is, and leads to adding more', async () => {
    fetchStats.mockResolvedValue(stats(5));
    fetchClothes.mockImplementation(async (filter) =>
      filter.forgotten ? [] : [clothing('c1', 'Tee', 'top'), clothing('c2', 'Jeans', 'bottom'), clothing('c3', 'Boots', 'shoes'), clothing('c4', 'Coat', 'outerwear')],
    );

    await renderScreen(<Today />);

    const nudge = within(await screen.findByTestId('today-nudge'));
    expect(nudge.getByRole('header', { name: '5 pieces in your wardrobe' })).toBeOnTheScreen();
    expect(nudge.getByText('Add 5 more and your picks get far more varied.')).toBeOnTheScreen();
    const bar = nudge.getByRole('progressbar', { name: '5 of 10 pieces' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 10, now: 5 });

    await fireEvent.press(nudge.getByRole('button', { name: 'Add clothes' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });

  it('speaks of one piece as one', async () => {
    fetchStats.mockResolvedValue(stats(1));
    fetchPicks.mockResolvedValue(answer([], { status: 'missing_garments', missing: ['bottom', 'shoes'] }));

    await renderScreen(<Today />);

    const nudge = within(await screen.findByTestId('today-nudge'));
    expect(nudge.getByText('1 piece in your wardrobe')).toBeOnTheScreen();
    expect(nudge.getByText('Add 9 more and your picks get far more varied.')).toBeOnTheScreen();
    expect(nudge.getByRole('progressbar', { name: '1 of 10 pieces' })).toBeOnTheScreen();
  });

  it.each([10, 12])('is gone once the wardrobe has %i pieces, and the list is not fetched for it', async (total) => {
    fetchStats.mockResolvedValue(stats(total));

    await renderScreen(<Today />);

    await screen.findByTestId('today-picks');
    expect(screen.queryByTestId('today-nudge')).toBeNull();
    expect(fetchClothes).not.toHaveBeenCalled();
  });
});

describe('not worn lately', () => {
  it('shows one forgotten garment and opens "Style this" for it', async () => {
    fetchStats.mockResolvedValue(stats(12, 2));
    fetchClothes.mockResolvedValue([clothing('p1', 'Still describing', 'top', { status: 'processing', name: null }), jacket, clothing('f2', 'Old scarf', 'accessory')]);

    await renderScreen(<Today />);

    const card = within(await screen.findByTestId('today-forgotten'));
    expect(fetchClothes).toHaveBeenCalledWith(expect.objectContaining({ forgotten: true }), expect.anything());
    expect(card.getByText('Not worn lately')).toBeOnTheScreen();
    expect(card.getByText('Give your navy jacket a turn')).toBeOnTheScreen();

    await fireEvent.press(card.getByRole('button', { name: 'Style it' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/occasion', params: { base: 'f1' } });
  });

  it('is absent when nothing is forgotten, and nothing is fetched for it', async () => {
    fetchStats.mockResolvedValue(stats(12, 0));

    await renderScreen(<Today />);

    await screen.findByTestId('today-picks');
    expect(screen.queryByTestId('today-forgotten')).toBeNull();
    expect(fetchClothes).not.toHaveBeenCalled();
  });
});
