import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import * as wardrobe from '@/api/wardrobe';
import Wardrobe from '@/app/(app)/(tabs)/wardrobe';
import AddBasics from '@/app/(app)/basics';
import Create from '@/app/(app)/create';
import { useSession } from '@/auth/session';
import { TabBar } from '@/components/TabBar';
import { useWardrobeFilters } from '@/features/wardrobe/filters';
import { clothing, myStarterPiece, user, wardrobeDictionaries } from '@/test/fixtures';
import { expectAccent, renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothes: jest.fn(),
  fetchWardrobeStats: jest.fn(),
  fetchDictionaries: jest.fn(),
  fetchMyStarterPieces: jest.fn(),
  addStarterPieces: jest.fn(),
}));

const api = jest.mocked(wardrobe);

const piece = (code: string, name: string, added = false): wardrobe.MyStarterPiece => myStarterPiece(code, name, 'top', added, { type: 't_shirt' });
const tee = piece('white_tshirt', 'White T-shirt');
const jeans = piece('blue_jeans', 'Blue jeans');
const sneakers = piece('white_sneakers', 'White sneakers', true);

beforeEach(() => {
  jest.clearAllMocks();
  useWardrobeFilters.getState().clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  api.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
  api.fetchWardrobeStats.mockResolvedValue({ total: 1, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });
  api.fetchClothes.mockResolvedValue([clothing('g1', 'Grey hoodie', 'mid_layer')]);
  api.fetchMyStarterPieces.mockResolvedValue([tee, jeans, sneakers]);
  api.addStarterPieces.mockResolvedValue({ added: 1, alreadyThere: 0 });
});

describe('the raised plus in the tab bar', () => {
  const route = (name: string) => ({ key: `${name}-key`, name });
  const bar = {
    state: { index: 0, routes: ['index', 'wardrobe', 'outfits', 'profile'].map(route) },
    emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
    navigateToTab: jest.fn(),
    insets: { top: 0, bottom: 34, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;

  it('sits between Wardrobe and Outfits, is not a tab, and opens the menu', async () => {
    await renderScreen(<TabBar {...bar} />);

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    const add = screen.getByRole('button', { name: 'Add' });
    await fireEvent.press(add);
    expect(router.push).toHaveBeenCalledWith('/create');
    expect(bar.navigateToTab).not.toHaveBeenCalled();
  });

  it('turns into a close mark while the menu is on top, and closes it', async () => {
    jest.mocked(usePathname).mockReturnValueOnce('/create');
    await renderScreen(<TabBar {...bar} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close menu' }));
    expect(router.back).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('the menu behind the plus', () => {
  it('offers three ways and replaces itself with the one chosen', async () => {
    await renderScreen(<Create />);

    await fireEvent.press(screen.getByTestId('create-stylist'));
    expect(router.replace).toHaveBeenLastCalledWith('/stylist');
    await fireEvent.press(screen.getByTestId('create-clothes'));
    expect(router.replace).toHaveBeenLastCalledWith('/add');
    await fireEvent.press(screen.getByTestId('create-build'));
    expect(router.replace).toHaveBeenLastCalledWith('/builder');
    expect(screen.queryByTestId('create-outfits')).toBeNull();
    expect(screen.queryByTestId('create-basics')).toBeNull();
  });
});

describe('the basics picker', () => {
  it('lists only the pieces not added yet and sends the ticked ones', async () => {
    await renderScreen(<AddBasics />);

    expect(screen.getByRole('header', { name: 'Pieces you might own' })).toBeOnTheScreen();
    expectAccent('drop', 'Pieces');
    expect(await screen.findByTestId('starter-white_tshirt')).toBeOnTheScreen();
    expect(screen.getByTestId('starter-blue_jeans')).toBeOnTheScreen();
    expect(screen.queryByTestId('starter-white_sneakers')).toBeNull();
    expect(screen.getByTestId('basics-count')).toHaveTextContent('0 of 2 selected');
    expect(screen.getByTestId('basics-add')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('starter-blue_jeans'));
    expect(screen.getByText('Add 1 piece')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('basics-all'));
    expect(screen.getByTestId('basics-count')).toHaveTextContent('2 of 2 selected');
    await fireEvent.press(screen.getByTestId('basics-add'));

    await waitFor(() => expect(api.addStarterPieces).toHaveBeenCalledWith(['white_tshirt', 'blue_jeans']));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });
});

describe('the basics picker by the gender in the profile', () => {
  const mixed = [
    myStarterPiece('white_tshirt', 'White T-shirt', 'top'),
    myStarterPiece('little_black_dress', 'Little black dress', 'one_piece', false, { type: 'dress', audience: 'women' }),
    myStarterPiece('black_midi_skirt', 'Black midi skirt', 'bottom', false, { type: 'skirt', group: 'skirts', audience: 'women' }),
    myStarterPiece('navy_blazer', 'Navy blazer', 'mid_layer', false, { type: 'blazer', group: 'suits_and_blazers', audience: 'men' }),
  ];
  const tiles = () => screen.getAllByTestId(/^starter-/).map((tile) => tile.props.testID as string);

  beforeEach(() => {
    api.fetchMyStarterPieces.mockResolvedValue(mixed);
  });

  it.each([
    ['female', ['starter-white_tshirt', 'starter-little_black_dress', 'starter-black_midi_skirt']],
    ['male', ['starter-white_tshirt', 'starter-navy_blazer']],
    ['non_binary', ['starter-white_tshirt', 'starter-little_black_dress', 'starter-black_midi_skirt', 'starter-navy_blazer']],
    ['unspecified', ['starter-white_tshirt', 'starter-little_black_dress', 'starter-black_midi_skirt', 'starter-navy_blazer']],
  ] as const)('shows %s only what suits them, with the count and the tabs to match', async (gender, expected) => {
    useSession.setState({ user: user({ gender }) });
    await renderScreen(<AddBasics />);

    await screen.findByTestId('starter-white_tshirt');
    expect(tiles()).toEqual(expected);
    expect(screen.getByTestId('basics-count')).toHaveTextContent(`0 of ${expected.length} selected`);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel);
    expect(tabs.includes('Suits and blazers')).toBe(gender !== 'female');
    expect(tabs.includes('Dresses and jumpsuits')).toBe(gender !== 'male');
  });

  it('narrows the strip in the wardrobe the same way', async () => {
    useSession.setState({ user: user({ gender: 'male' }) });
    await renderScreen(<Wardrobe />);

    expect(await screen.findByTestId('starter-tile-navy_blazer')).toBeOnTheScreen();
    expect(screen.queryByTestId('starter-tile-little_black_dress')).toBeNull();
  });
});

describe('the starter strip in the wardrobe', () => {
  it('sits at the end of the list and adds a piece with one tap', async () => {
    await renderScreen(<Wardrobe />);

    expect(await screen.findByTestId('wardrobe-starters')).toBeOnTheScreen();
    expect(screen.getByTestId('starter-tile-white_tshirt')).toBeOnTheScreen();
    expect(screen.queryByTestId('starter-tile-white_sneakers')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add White T-shirt' }));
    await waitFor(() => expect(api.addStarterPieces).toHaveBeenCalledWith(['white_tshirt']));

    await fireEvent.press(screen.getByTestId('starters-see-all'));
    expect(router.push).toHaveBeenCalledWith('/basics');
  });

  it('stays under the empty state too', async () => {
    api.fetchClothes.mockResolvedValue([]);
    await renderScreen(<Wardrobe />);

    expect(await screen.findByTestId('wardrobe-empty')).toBeOnTheScreen();
    expect(await screen.findByTestId('wardrobe-starters')).toBeOnTheScreen();
  });

  it('is hidden while a filter is set, and when nothing is left to add', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByTestId('wardrobe-starters');

    await act(async () => {
      useWardrobeFilters.getState().toggleColor('navy');
    });
    await waitFor(() => expect(screen.queryByTestId('wardrobe-starters')).toBeNull());
  });

  it('does not appear once every piece is added', async () => {
    api.fetchMyStarterPieces.mockResolvedValue([piece('white_tshirt', 'White T-shirt', true), sneakers]);
    await renderScreen(<Wardrobe />);

    expect(await screen.findByText('1 piece')).toBeOnTheScreen();
    await waitFor(() => expect(api.fetchMyStarterPieces).toHaveBeenCalled());
    expect(screen.queryByTestId('wardrobe-starters')).toBeNull();
  });

  it('refreshes with the wardrobe, so deleting a garment brings its piece back', () => {
    expect(wardrobe.wardrobeKeys.starterMine.slice(0, 1)).toEqual(wardrobe.wardrobeKeys.all);
  });
});
