import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import * as wardrobe from '@/api/wardrobe';
import Wardrobe from '@/app/(app)/(tabs)/wardrobe';
import WardrobeFilters from '@/app/(app)/filters';
import { useSession } from '@/auth/session';
import { useWardrobeFilters } from '@/features/wardrobe/filters';
import { clothing, user, wardrobeDictionaries } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';

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
}));

const api = jest.mocked(wardrobe);
const store = () => useWardrobeFilters.getState();

const jeans = clothing('g1', 'Blue jeans', 'bottom', { group: 'jeans', subcategory: 'jeans', colors: ['navy'], seasons: ['spring', 'fall'] });
const chinos = clothing('g2', 'Beige chinos', 'bottom', { group: 'pants', subcategory: 'chinos', colors: ['white'], seasons: ['summer'] });
const hoodie = clothing('g3', 'Grey hoodie', 'mid_layer', { group: 'sweaters_and_hoodies', subcategory: 'hoodie', colors: ['light_blue'], seasons: ['fall', 'winter'] });

/** The filters the wardrobe last asked the server for. */
const lastAsked = () => api.fetchClothes.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  api.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
  api.fetchWardrobeStats.mockResolvedValue({ total: 3, wornLast30Days: 1, forgotten: 0, processing: 0, needsTags: 0 });
  api.fetchClothes.mockResolvedValue([jeans, chinos, hoodie]);
});

describe('the wardrobe screen', () => {
  it('has the filters button beside Add, and no chips or Filters button under the search box', async () => {
    await renderScreen(<Wardrobe />);

    expect(await screen.findByText('3 items')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add clothes' })).toBeOnTheScreen();
    expect(screen.queryByTestId('wardrobe-types-row')).toBeNull();
    expect(screen.queryByTestId('wardrobe-filter-bar')).toBeNull();
  });

  it('shows plainly that a filter is set, and how many', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 items');
    expect(screen.getByRole('button', { name: 'Filters' })).not.toBeSelected();

    await act(async () => {
      store().toggleColor('navy');
      store().setUsage('used');
    });

    expect(await screen.findByRole('button', { name: 'Filters, 2 active' })).toBeSelected();
  });

  it('shows no row of types with no group chosen, or with several', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 items');

    await act(async () => {
      store().toggleGroup('pants');
      store().toggleGroup('sweaters_and_hoodies');
    });

    expect(screen.queryByTestId('wardrobe-types-row')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Chinos' })).toBeNull();
  });

  it('shows every type of the one chosen group, and a type is applied by pressing it and taken off by pressing it again', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 items');

    await act(async () => store().toggleGroup('pants'));

    const row = await screen.findByTestId('wardrobe-types-row');
    expect(within(row).getAllByRole('checkbox').map((pill) => pill.props.accessibilityLabel)).toEqual(['Trousers', 'Chinos']);
    expect(within(row).getByRole('checkbox', { name: 'Trousers' })).not.toBeChecked();

    await fireEvent.press(within(row).getByRole('checkbox', { name: 'Chinos' }));
    await fireEvent.press(within(row).getByRole('checkbox', { name: 'Trousers' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ groups: ['pants'], types: ['chinos', 'trousers'] }));
    expect(within(row).getByRole('checkbox', { name: 'Chinos' })).toBeChecked();
    // The pill keeps its label and its place: there is no "x" to remove it.
    expect(within(row).queryByRole('button')).toBeNull();

    await fireEvent.press(within(row).getByRole('checkbox', { name: 'Chinos' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ types: ['trousers'] }));
    expect(within(row).getByRole('checkbox', { name: 'Chinos' })).not.toBeChecked();
  });

  it('drops the chosen types, and the row, when the chosen groups change', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 items');
    await act(async () => store().toggleGroup('pants'));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Chinos' }));
    expect(store().types).toEqual(['chinos']);

    await act(async () => store().toggleGroup('sweaters_and_hoodies'));
    expect(store().types).toEqual([]);
    expect(screen.queryByTestId('wardrobe-types-row')).toBeNull();

    // Back to one group: its types are all shown again, none chosen.
    await act(async () => store().toggleGroup('sweaters_and_hoodies'));
    expect((await screen.findByTestId('wardrobe-types-row')).props.accessibilityLabel).toBe('Pants: types');
    expect(screen.getByRole('checkbox', { name: 'Chinos' })).not.toBeChecked();
  });

  it('lists the clothes under a heading for each value when grouped, and sorts them', async () => {
    await renderScreen(<Wardrobe />);
    await screen.findByText('3 items');
    expect(screen.queryAllByRole('header').map((heading) => heading.props.children)).toEqual(['Wardrobe']);

    await act(async () => store().setGroupBy('group'));

    expect(screen.getAllByRole('header').map((heading) => heading.props.children)).toEqual(['Wardrobe', 'Sweaters and hoodies', 'Jeans', 'Pants']);
    expect(screen.getByText('Grey hoodie')).toBeOnTheScreen();

    await act(async () => store().setGroupBy('season'));
    expect(screen.getAllByRole('header').map((heading) => heading.props.children)).toEqual(['Wardrobe', 'Spring', 'Summer', 'Fall']);
  });

  it('says there are no matches, with a way out, when the filters leave nothing', async () => {
    api.fetchClothes.mockResolvedValue([]);
    await renderScreen(<Wardrobe />);
    await act(async () => store().toggleSeason('winter'));

    await fireEvent.press(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(store().seasons).toEqual([]);
  });
});

describe('the filters sheet', () => {
  it('has the sections in order, each with its options', async () => {
    await renderScreen(<WardrobeFilters />);

    expect(await screen.findByRole('checkbox', { name: 'Pants' })).toBeOnTheScreen();
    expect(screen.getAllByRole('header').map((heading) => heading.props.children)).toEqual([
      'Filters',
      'Groups',
      'Colors',
      'Seasons',
      'Materials',
      'Usage',
      'Sort by',
      'Group by',
    ]);
    expect(screen.getByRole('switch', { name: 'Forgotten clothes only' })).toBeOnTheScreen();
    expect(screen.getAllByRole('checkbox').map((option) => option.props.accessibilityLabel)).toEqual([
      'All',
      'Shirts and blouses',
      'Sweaters and hoodies',
      'Jeans',
      'Pants',
      'Suits and blazers',
      'White',
      'Navy',
      'Light blue',
      'Spring',
      'Summer',
      'Fall',
      'Winter',
      'Cotton',
      'Wool',
    ]);
    expect(screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel)).toEqual([
      'All',
      'Not used in outfits',
      'Used in outfits',
      'Date added',
      'Group',
      'Color',
      'Most worn',
      'None',
      'Group',
      'Season',
      'Color',
    ]);
    expect(screen.queryByText(/brand/i)).toBeNull();
  });

  it('chooses several colors, seasons and materials, each with a ring or fill that shows it', async () => {
    await renderScreen(<WardrobeFilters />);

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Navy' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Light blue' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Fall' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Winter' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Wool' }));

    expect(store()).toMatchObject({ colors: ['navy', 'light_blue'], seasons: ['fall', 'winter'], materials: ['wool'] });
    expect(screen.getByRole('checkbox', { name: 'Navy' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'White' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Navy' }));
    expect(store().colors).toEqual(['light_blue']);
  });

  it('takes one usage, one sort and one grouping at a time', async () => {
    await renderScreen(<WardrobeFilters />);
    await screen.findByRole('checkbox', { name: 'Navy' });
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Date added' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Used in outfits' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Not used in outfits' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Most worn' }));
    const [groupBy] = screen.getAllByRole('radio', { name: 'Color' }).slice(-1);
    await fireEvent.press(groupBy as never);

    expect(store()).toMatchObject({ usage: 'unused', sort: 'worn', groupBy: 'color' });
    expect(screen.getByRole('radio', { name: 'Not used in outfits' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Used in outfits' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked();
  });

  it('clears the filters, sort and grouping together, and is disabled when nothing is set', async () => {
    await renderScreen(<WardrobeFilters />);
    const clear = await screen.findByRole('button', { name: 'Clear filters' });
    expect(clear).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Most worn' }));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Spring' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));

    expect(store()).toMatchObject({ ...wardrobe.noFilter, sort: 'added', groupBy: 'none' });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });
});
