import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as weatherApi from '@/api/weather';
import Proposals from '@/app/(app)/proposals';
import { outfit, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/outfits', () => ({
  ...jest.requireActual('@/api/outfits'),
  suggestOutfits: jest.fn(),
  updateOutfit: jest.fn(),
}));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));

const api = jest.mocked(outfits);
const suggest = api.suggestOutfits;
const update = api.updateOutfit;

const answer = (change: Partial<outfits.Suggestions> = {}): outfits.Suggestions => ({
  status: 'proposed',
  date: '2026-10-05',
  missing: [],
  missingEither: [],
  fallback: false,
  occasion: 'everyday',
  weather,
  relaxations: [],
  umbrella: false,
  outfits: [outfit('o1'), outfit('o2', { kind: 'discovery' }), outfit('o3', { kind: 'new_pairing' })],
  ...change,
});

let request = 0;
beforeEach(() => {
  jest.clearAllMocks();
  request += 1;
  // Each test is its own request, as each press of the button on Today is.
  jest.mocked(useLocalSearchParams).mockReturnValue({ request: `r${request}`, occasion: 'everyday' });
  jest.mocked(weatherApi.fetchWeatherToday).mockResolvedValue(weather);
});

/** A promise that is settled by the test, so nothing is left waiting when the test ends. */
function later<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, settle: (value: T) => act(async () => resolve(value)) };
}

const stateOf = (name: string) => screen.getByRole('button', { name }).props.accessibilityState;

describe('while the stylist works', () => {
  it('shows the shape of the answer and says what is going on, then asks the server once', async () => {
    const pending = later<outfits.Suggestions>();
    suggest.mockReturnValue(pending.promise);

    await renderScreen(<Proposals />);

    expect(screen.getByLabelText('Styling your outfits')).toBeOnTheScreen();
    expect(screen.getByText('Styling three outfits from your wardrobe.')).toBeOnTheScreen();
    expect(screen.getByText('Looks for today')).toBeOnTheScreen();
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith({ occasion: 'everyday', note: undefined, baseItemId: undefined });

    await pending.settle(answer());
    expect(await screen.findByTestId('proposals-screen')).toBeOnTheScreen();
  });

  it('passes the note and the garment to build around', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ request: 'with-base', occasion: 'work', note: 'prezentacja', base: 'garment-9' });
    suggest.mockResolvedValue(answer());

    await renderScreen(<Proposals />);

    await screen.findByTestId('proposals-screen');
    expect(suggest).toHaveBeenCalledWith({ occasion: 'work', note: 'prezentacja', baseItemId: 'garment-9' });
  });
});

describe('three proposals', () => {
  it('names the occasion and the weather, and one pill per proposal with the label of its kind', async () => {
    suggest.mockResolvedValue(answer());

    await renderScreen(<Proposals />);

    expect(await screen.findByTestId('proposals-screen')).toBeOnTheScreen();
    expect(screen.getByText('Everyday, 7-18°C')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Sure bet, 1 of 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Discovery, 2 of 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'New pairing, 3 of 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Sure bet, 1 of 3' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Reasoning for outfit o1.')).toBeOnTheScreen();
  });

  it('labels a proposal that earned no kind by its place, never with a made-up one', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1', { kind: null }), outfit('o2', { kind: null })] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByRole('tab', { name: 'Outfit 1, 1 of 2' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Outfit 2, 2 of 2' })).toBeOnTheScreen();
  });

  it('shows no pills for a single proposal, only the kind it earned', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Sure bet')).toBeOnTheScreen();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('moves to another proposal when its pill is pressed, and the buttons then act on that one', async () => {
    suggest.mockResolvedValue(answer());
    update.mockResolvedValue(outfit('o2', { kind: 'discovery', wornOn: '2026-10-05' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('tab', { name: 'Discovery, 2 of 3' }));
    await fireEvent.press(screen.getByTestId('proposals-wear'));

    expect(screen.getByRole('tab', { name: 'Discovery, 2 of 3' }).props.accessibilityState.selected).toBe(true);
    await waitFor(() => expect(update).toHaveBeenCalledWith('o2', { worn: true }));
  });

  it('follows a swipe: the pill of the page that came to the front is selected', async () => {
    suggest.mockResolvedValue(answer());
    await renderScreen(<Proposals />);

    const pages = await screen.findByTestId('proposals-pages');
    // The screen is 750 wide in the test renderer; a swipe that ends on the second page.
    await fireEvent(pages, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 750 } } });

    expect(screen.getByRole('tab', { name: 'Discovery, 2 of 3' }).props.accessibilityState.selected).toBe(true);
  });

  it('puts the umbrella and the note about the rules in words a person can read, and keeps quiet about rules that gave way', async () => {
    suggest.mockResolvedValue(
      answer({
        outfits: [outfit('o1', { umbrella: true, source: 'rules', relaxations: [{ role: 'outerwear', rule: 'warmth' }] })],
      }),
    );

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Rain is possible and you don’t have a rainproof jacket, so bring an umbrella.')).toBeOnTheScreen();
    expect(screen.getByText('Our AI stylist isn’t available right now, so we put this outfit together with simple style rules.')).toBeOnTheScreen();
    expect(screen.getByText('Morning 7°C, afternoon 18°C.')).toBeOnTheScreen();
    expect(screen.queryByText(/closest match/)).toBeNull();
  });

  it('says nothing about rules, umbrellas or relaxed rules when there is nothing to say', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));

    await renderScreen(<Proposals />);

    await screen.findByTestId('proposals-screen');
    expect(screen.queryByText(/parasol/)).toBeNull();
    expect(screen.queryByText(/simple rules/)).toBeNull();
    expect(screen.queryByText(/You don’t have/)).toBeNull();
  });
});

describe('keeping and wearing', () => {
  it('keeps an outfit, and lets it go again', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockResolvedValueOnce(outfit('o1', { isSaved: true })).mockResolvedValueOnce(outfit('o1', { isSaved: false }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save outfit' }));
    expect(update).toHaveBeenLastCalledWith('o1', { saved: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Remove from saved' }));
    expect(update).toHaveBeenLastCalledWith('o1', { saved: false });
  });

  it('wears an outfit and says so, so the person knows it was recorded', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockResolvedValue(outfit('o1', { wornOn: '2026-10-05' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Wear this today' }));

    expect(update).toHaveBeenCalledWith('o1', { worn: true });
    expect(await screen.findByRole('button', { name: 'Worn' })).toBeOnTheScreen();
    expect(stateOf('Worn').busy).toBeFalsy();
  });

  it('holds the pages and the page still while a board is arranged, and keeps the arrangement with that proposal', async () => {
    suggest.mockResolvedValue(answer());
    update.mockImplementation(async (_id, change) => outfit('o1', { layout: change.layout as outfits.OutfitPlacement[] }));
    await renderScreen(<Proposals />);
    const pages = await screen.findByTestId('proposals-pages');
    expect(pages.props.scrollEnabled).toBe(true);

    await fireEvent.press((await screen.findAllByRole('button', { name: 'Arrange' }))[0]);
    expect(screen.getByTestId('proposals-pages').props.scrollEnabled).toBe(false);
    await fireEvent(screen.getByTestId('board-o1-g2-handle'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByTestId('proposals-pages').props.scrollEnabled).toBe(true);
    await waitFor(() => expect(update).toHaveBeenCalledWith('o1', { layout: expect.arrayContaining([expect.objectContaining({ clothingId: 'g2' })]) }));
  });

  it('does not say it was worn when the server refused', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Wear this today' }));

    expect(await screen.findByText('Something went wrong on our end. Try again in a moment.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wear this today' })).toBeOnTheScreen();
  });
});

describe('when the wardrobe cannot dress the person', () => {
  it('says what is missing, as in the mock-up, and offers to add clothes', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: ['outerwear'], outfits: [], weather: { ...weather, feelsMin: 1, feelsMax: 4 } }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('You’re missing jackets and coats')).toBeOnTheScreen();
    expect(screen.getByText('At 1°C, you need jackets and coats. Add a jacket or a coat and we’ll put an outfit together.')).toBeOnTheScreen();
    expect(screen.queryByRole('tablist')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add clothes' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });

  it('words "any one of these would do" as an alternative', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: [], missingEither: ['mid_layer', 'outerwear'], outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('You’re missing warm layers or jackets and coats')).toBeOnTheScreen();
  });

  it('copes with a server that does not send the alternatives yet', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: ['shoes'], outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('You’re missing shoes')).toBeOnTheScreen();
  });
});

describe('when asking fails', () => {
  it('says the limit is used up and goes back to Today', async () => {
    suggest.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached', limit: 20 }));
    await renderScreen(<Proposals />);

    expect(await screen.findByText('You’ve hit today’s limit. More tomorrow.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));

    expect(router.back).toHaveBeenCalled();
  });

  it('sends a person with no place to the place screen', async () => {
    suggest.mockRejectedValue(new ApiError({ status: 409, code: 'location_missing' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a city' }));

    expect(router.push).toHaveBeenCalledWith('/account/place');
  });

  it('asks again when the weather could not be fetched, and shows the answer', async () => {
    suggest.mockRejectedValueOnce(new ApiError({ status: 503, code: 'weather_unavailable' })).mockResolvedValueOnce(answer());
    await renderScreen(<Proposals />);

    expect(await screen.findByText('We couldn’t get the forecast. Try again in a moment.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('proposals-screen')).toBeOnTheScreen();
    expect(suggest).toHaveBeenCalledTimes(2);
  });

  it('says so when the stylist found nothing to propose', async () => {
    suggest.mockResolvedValue(answer({ outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText(/We couldn’t put together an outfit/)).toBeOnTheScreen();
  });
});
