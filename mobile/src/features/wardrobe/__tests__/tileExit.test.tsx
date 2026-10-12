import { act, fireEvent, screen } from '@testing-library/react-native';

import * as outfits from '@/api/outfits';
import * as wardrobe from '@/api/wardrobe';
import Outfits from '@/app/(app)/(tabs)/outfits';
import Wardrobe from '@/app/(app)/(tabs)/wardrobe';
import { useSession } from '@/auth/session';
import { Fade, stagger } from '@/components/motion';
import { useWardrobeFilters } from '@/features/wardrobe/filters';
import { clothing, outfit, user, wardrobeDictionaries } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';
import { motion } from '@/theme';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/outfits', () => ({ ...jest.requireActual('@/api/outfits'), fetchSavedOutfits: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchClothes: jest.fn(), fetchWardrobeStats: jest.fn(), fetchDictionaries: jest.fn() }));
// The Fade around every tile, as it was given to the tile: whether it enters, and whether it fades and shrinks on its way out.
jest.mock('@/components/motion', () => {
  const actual = jest.requireActual<typeof import('@/components/motion')>('@/components/motion');
  return { ...actual, Fade: jest.fn(actual.Fade) };
});

const api = jest.mocked(wardrobe);
const saved = jest.mocked(outfits);
const tiles = () => jest.mocked(Fade).mock.calls.map(([props]) => props).filter((props) => props.shrink);
const introSpan = stagger.limit * stagger.step + motion.enter;
const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

const jeans = clothing('g1', 'Blue jeans', 'bottom', { group: 'jeans', subcategory: 'jeans' });
const chinos = clothing('g2', 'Beige chinos', 'bottom', { group: 'pants', subcategory: 'chinos' });
const hoodie = clothing('g3', 'Grey hoodie', 'mid_layer', { group: 'sweaters_and_hoodies', subcategory: 'hoodie' });

beforeEach(() => {
  jest.clearAllMocks();
  useWardrobeFilters.getState().clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  api.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
  api.fetchWardrobeStats.mockResolvedValue({ total: 3, wornLast30Days: 1, forgotten: 0, processing: 0, needsTags: 0 });
});

describe('a removed garment tile', () => {
  it('fades and shrinks on its way out, and the tiles that stay are not introduced again', async () => {
    api.fetchClothes.mockResolvedValue([jeans, chinos, hoodie]);
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 pieces');

    expect(tiles().length).toBeGreaterThanOrEqual(3);
    expect(tiles().every((props) => props.exit === true)).toBe(true);
    // The first arrival is staggered.
    expect(tiles().slice(0, 3).map((props) => props.enter)).toEqual([true, true, true]);

    await wait(introSpan + 50);
    jest.mocked(Fade).mockClear();
    api.fetchClothes.mockResolvedValue([jeans, hoodie]);
    await act(async () => useWardrobeFilters.getState().setUsage('used'));
    await screen.findByText('2 pieces');

    expect(tiles().length).toBeGreaterThanOrEqual(2);
    expect(tiles().every((props) => props.enter === false && props.exit === true)).toBe(true);
  });
});

describe('a removed outfit tile', () => {
  it('fades and shrinks on its way out, and the tiles that stay are not introduced again', async () => {
    saved.fetchSavedOutfits.mockResolvedValue([outfit('s1', { isSaved: true, occasion: 'everyday' }), outfit('s2', { isSaved: true, occasion: 'work' })]);
    await renderScreen(<Outfits />);
    await screen.findByTestId('outfit-s1');

    expect(tiles().length).toBeGreaterThanOrEqual(2);
    expect(tiles().slice(0, 2).map((props) => props.enter)).toEqual([true, true]);
    expect(tiles().every((props) => props.exit === true)).toBe(true);

    await wait(introSpan + 50);
    jest.mocked(Fade).mockClear();
    // Typing a search takes the first one out; the other moves up to the first place.
    await fireEvent.changeText(screen.getByTestId('outfits-search'), 'work');
    expect(screen.queryByTestId('outfit-s1')).toBeNull();

    expect(tiles().length).toBeGreaterThanOrEqual(1);
    // It stays as it was and does not arrive again.
    expect(tiles().every((props) => props.enter === false)).toBe(true);
  });
});
