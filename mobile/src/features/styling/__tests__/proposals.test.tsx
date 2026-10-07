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
  // Each test is its own request, as each press of the button on Dziś is.
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

    expect(screen.getByLabelText('Układamy zestawy')).toBeOnTheScreen();
    expect(screen.getByText('Układamy trzy zestawy z Twojej szafy.')).toBeOnTheScreen();
    expect(screen.getByText('Propozycje na dziś')).toBeOnTheScreen();
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
    expect(screen.getByText('Na co dzień, 7-18°C')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Pewniak, 1 z 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Odkrycie, 2 z 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Nowe połączenie, 3 z 3' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Pewniak, 1 z 3' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Uzasadnienie zestawu o1.')).toBeOnTheScreen();
  });

  it('labels a proposal that earned no kind by its place, never with a made-up one', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1', { kind: null }), outfit('o2', { kind: null })] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByRole('tab', { name: 'Zestaw 1, 1 z 2' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Zestaw 2, 2 z 2' })).toBeOnTheScreen();
  });

  it('shows no pills for a single proposal, only the kind it earned', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Pewniak')).toBeOnTheScreen();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('moves to another proposal when its pill is pressed, and the buttons then act on that one', async () => {
    suggest.mockResolvedValue(answer());
    update.mockResolvedValue(outfit('o2', { kind: 'discovery', wornOn: '2026-10-05' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('tab', { name: 'Odkrycie, 2 z 3' }));
    await fireEvent.press(screen.getByTestId('proposals-wear'));

    expect(screen.getByRole('tab', { name: 'Odkrycie, 2 z 3' }).props.accessibilityState.selected).toBe(true);
    await waitFor(() => expect(update).toHaveBeenCalledWith('o2', { worn: true }));
  });

  it('follows a swipe: the pill of the page that came to the front is selected', async () => {
    suggest.mockResolvedValue(answer());
    await renderScreen(<Proposals />);

    const pages = await screen.findByTestId('proposals-pages');
    // The screen is 750 wide in the test renderer; a swipe that ends on the second page.
    await fireEvent(pages, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 750 } } });

    expect(screen.getByRole('tab', { name: 'Odkrycie, 2 z 3' }).props.accessibilityState.selected).toBe(true);
  });

  it('puts the umbrella, the relaxed rules and the note about the rules in words a person can read', async () => {
    suggest.mockResolvedValue(
      answer({
        outfits: [outfit('o1', { umbrella: true, source: 'rules', relaxations: [{ role: 'outerwear', rule: 'warmth' }] })],
      }),
    );

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Nie masz okrycia wierzchniego na tę temperaturę, więc proponuję to, co jest najbliżej.')).toBeOnTheScreen();
    expect(screen.getByText('Może padać, a w szafie nie ma okrycia na deszcz, więc weź parasol.')).toBeOnTheScreen();
    expect(screen.getByText('Ten zestaw ułożyliśmy według prostych reguł, bo stylista AI jest teraz niedostępny.')).toBeOnTheScreen();
    expect(screen.getByText('Rano 7°C, po południu 18°C.')).toBeOnTheScreen();
  });

  it('says nothing about rules, umbrellas or relaxed rules when there is nothing to say', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));

    await renderScreen(<Proposals />);

    await screen.findByTestId('proposals-screen');
    expect(screen.queryByText(/parasol/)).toBeNull();
    expect(screen.queryByText(/proste reguły|prostych reguł/)).toBeNull();
    expect(screen.queryByText(/Nie masz/)).toBeNull();
  });
});

describe('rating, keeping and wearing', () => {
  it('shows a thumb at once, and keeps it when the server agrees', async () => {
    suggest.mockResolvedValue(answer());
    const confirmed = later<outfits.Outfit>();
    update.mockReturnValue(confirmed.promise);
    await renderScreen(<Proposals />);
    await screen.findByTestId('proposals-screen');

    await fireEvent.press(screen.getAllByTestId('outfit-like')[0] as never);

    // Not confirmed yet, and already on.
    await waitFor(() => expect(screen.getAllByTestId('outfit-like')[0]?.props.accessibilityState.selected).toBe(true));
    expect(update).toHaveBeenCalledWith('o1', { rating: 'like' });

    await confirmed.settle(outfit('o1', { rating: 'like' }));
    expect(screen.getAllByTestId('outfit-like')[0]?.props.accessibilityState.selected).toBe(true);
  });

  it('takes the thumb back and says why when the server refuses', async () => {
    suggest.mockResolvedValue(answer());
    update.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));
    await renderScreen(<Proposals />);
    await screen.findByTestId('proposals-screen');

    await fireEvent.press(screen.getAllByTestId('outfit-dislike')[0] as never);

    expect(await screen.findByText('Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.')).toBeOnTheScreen();
    expect(screen.getAllByTestId('outfit-dislike')[0]?.props.accessibilityState.selected).toBe(false);
  });

  it('clears a rating when the same thumb is pressed again', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1', { rating: 'like' })] }));
    update.mockResolvedValue(outfit('o1', { rating: 'none' }));
    await renderScreen(<Proposals />);
    await screen.findByTestId('proposals-screen');

    await fireEvent.press(screen.getByTestId('outfit-like'));

    expect(update).toHaveBeenCalledWith('o1', { rating: 'none' });
  });

  it('keeps an outfit, and lets it go again', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockResolvedValueOnce(outfit('o1', { isSaved: true })).mockResolvedValueOnce(outfit('o1', { isSaved: false }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Zapisz zestaw' }));
    expect(update).toHaveBeenLastCalledWith('o1', { saved: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Usuń z zapisanych' }));
    expect(update).toHaveBeenLastCalledWith('o1', { saved: false });
  });

  it('wears an outfit and says so, so the person knows it was recorded', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockResolvedValue(outfit('o1', { wornOn: '2026-10-05' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Zakładam to' }));

    expect(update).toHaveBeenCalledWith('o1', { worn: true });
    expect(await screen.findByRole('button', { name: 'Założony' })).toBeOnTheScreen();
    expect(stateOf('Założony').busy).toBeFalsy();
  });

  it('does not say it was worn when the server refused', async () => {
    suggest.mockResolvedValue(answer({ outfits: [outfit('o1')] }));
    update.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Zakładam to' }));

    expect(await screen.findByText('Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zakładam to' })).toBeOnTheScreen();
  });
});

describe('when the wardrobe cannot dress the person', () => {
  it('says what is missing, as in the mock-up, and offers to add clothes', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: ['outerwear'], outfits: [], weather: { ...weather, feelsMin: 1, feelsMax: 4 } }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Brakuje okrycia wierzchniego')).toBeOnTheScreen();
    expect(screen.getByText('Przy 1°C potrzebne jest okrycie wierzchnie. Dodaj kurtkę albo płaszcz, a ułożymy zestaw.')).toBeOnTheScreen();
    expect(screen.queryByRole('tablist')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj ubrania' }));
    expect(router.push).toHaveBeenCalledWith('/add');
  });

  it('words "any one of these would do" as an alternative', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: [], missingEither: ['mid_layer', 'outerwear'], outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Brakuje warstwy pośredniej albo okrycia wierzchniego')).toBeOnTheScreen();
  });

  it('copes with a server that does not send the alternatives yet', async () => {
    suggest.mockResolvedValue(answer({ status: 'missing_garments', missing: ['shoes'], outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText('Brakuje butów')).toBeOnTheScreen();
  });
});

describe('when asking fails', () => {
  it('says the limit is used up and goes back to Dziś', async () => {
    suggest.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached', limit: 20 }));
    await renderScreen(<Proposals />);

    expect(await screen.findByText('Dzisiejszy limit jest wykorzystany. Wróć jutro.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Wróć do Dziś' }));

    expect(router.back).toHaveBeenCalled();
  });

  it('sends a person with no place to the place screen', async () => {
    suggest.mockRejectedValue(new ApiError({ status: 409, code: 'location_missing' }));
    await renderScreen(<Proposals />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Wybierz miejsce' }));

    expect(router.push).toHaveBeenCalledWith('/account/place');
  });

  it('asks again when the weather could not be fetched, and shows the answer', async () => {
    suggest.mockRejectedValueOnce(new ApiError({ status: 503, code: 'weather_unavailable' })).mockResolvedValueOnce(answer());
    await renderScreen(<Proposals />);

    expect(await screen.findByText('Nie udało się pobrać prognozy pogody. Spróbuj ponownie za chwilę.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByTestId('proposals-screen')).toBeOnTheScreen();
    expect(suggest).toHaveBeenCalledTimes(2);
  });

  it('says so when the stylist found nothing to propose', async () => {
    suggest.mockResolvedValue(answer({ outfits: [] }));

    await renderScreen(<Proposals />);

    expect(await screen.findByText(/Nie udało się ułożyć zestawów/)).toBeOnTheScreen();
  });
});
