import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as wardrobe from '@/api/wardrobe';
import GarmentDetail from '@/app/(app)/clothes/[id]/index';
import EditGarment from '@/app/(app)/clothes/[id]/edit';
import WardrobeFilters from '@/app/(app)/filters';
import { useSession } from '@/auth/session';
import { useWardrobeFilters } from '@/features/wardrobe/filters';
import { categoryOfType, groupLabel, kindLine } from '@/features/wardrobe/useDictionaries';
import { clothing, user, wardrobeDictionaries } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothing: jest.fn(),
  fetchDictionaries: jest.fn(),
  updateClothing: jest.fn(),
}));

const api = jest.mocked(wardrobe);

const dictionaries = wardrobeDictionaries;

beforeEach(() => {
  jest.clearAllMocks();
  useWardrobeFilters.getState().clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  api.fetchDictionaries.mockResolvedValue(dictionaries);
});

describe('what the dictionaries say about a garment', () => {
  it('names the group and the type, and derives the role from the type', () => {
    expect(groupLabel(dictionaries, 'sweaters_and_hoodies')).toBe('Sweaters and hoodies');
    expect(kindLine(dictionaries, { group: 'sweaters_and_hoodies', subcategory: 'hoodie' })).toBe('Sweaters and hoodies, hoodie');
    expect(kindLine(dictionaries, { group: null, subcategory: null })).toBeNull();
    expect(categoryOfType(dictionaries, 'blazer')).toBe('mid_layer');
    expect(categoryOfType(dictionaries, null)).toBeNull();
  });
});

describe('the filters sheet', () => {
  it('offers all and every group, and several groups can be chosen at once', async () => {
    await renderScreen(<WardrobeFilters />);

    expect(await screen.findByRole('checkbox', { name: 'Sweaters and hoodies' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'All' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Warm layers' })).toBeNull();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Pants' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sweaters and hoodies' }));
    expect(useWardrobeFilters.getState().groups).toEqual(['pants', 'sweaters_and_hoodies']);
    expect(screen.getByRole('checkbox', { name: 'All' })).not.toBeChecked();

    // Pressing a chosen group again takes it out.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Pants' }));
    expect(useWardrobeFilters.getState().groups).toEqual(['sweaters_and_hoodies']);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'All' }));
    expect(useWardrobeFilters.getState().groups).toEqual([]);
  });
});

describe('the garment details', () => {
  it('shows the group and the type under the name', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
    api.fetchClothing.mockResolvedValue(clothing('g1', 'Grey hoodie', 'mid_layer', { group: 'sweaters_and_hoodies', subcategory: 'hoodie' }));

    await renderScreen(<GarmentDetail />);

    expect(await screen.findByText('Sweaters and hoodies, hoodie')).toBeOnTheScreen();
  });
});

describe('the seasons of a garment', () => {
  it('are listed on the garment details', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
    api.fetchClothing.mockResolvedValue(clothing('g1', 'Grey hoodie', 'mid_layer', { group: 'sweaters_and_hoodies', subcategory: 'hoodie', seasons: ['fall', 'winter'] }));

    await renderScreen(<GarmentDetail />);

    expect(await screen.findByText('Seasons')).toBeOnTheScreen();
    expect(screen.getByText('Fall, Winter')).toBeOnTheScreen();
  });

  it('are picked on the edit screen, with the garment’s own seasons already chosen, and sent with the rest', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g5' });
    const hoodie = clothing('g5', 'Grey hoodie', 'mid_layer', { group: 'sweaters_and_hoodies', subcategory: 'hoodie', seasons: ['fall', 'winter'] });
    api.fetchClothing.mockResolvedValue(hoodie);
    api.updateClothing.mockResolvedValue(hoodie);
    await renderScreen(<EditGarment />);

    expect(await screen.findByRole('checkbox', { name: 'Fall' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Winter' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Spring' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Summer' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Winter' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Spring' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(api.updateClothing).toHaveBeenCalled());
    expect(api.updateClothing.mock.calls[0]?.[1]).toMatchObject({ seasons: ['fall', 'spring'] });
  });

  it('may be left empty to complete a garment by hand: they are not among the things still to fill in', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g6' });
    const waitingForTags = clothing('g6', 'Item', 'top', { status: 'failed', category: null, group: null, subcategory: null, colors: [], pattern: null, material: null, formality: null, warmth: null, seasons: [] });
    api.fetchClothing.mockResolvedValue(waitingForTags);
    await renderScreen(<EditGarment />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Still to fill in: group, type, color, pattern, material, formality, warmth.')).toBeOnTheScreen();
    expect(api.updateClothing).not.toHaveBeenCalled();
  });
});

describe('editing the details', () => {
  const waiting = clothing('g2', 'Item', 'top', { status: 'failed', category: null, group: null, colors: [], pattern: null, material: null, formality: null, warmth: null });

  it('picks the group first, then a type of that group, and sends the role the type belongs to', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g2' });
    api.fetchClothing.mockResolvedValue(waiting);
    api.updateClothing.mockResolvedValue(clothing('g2', 'Item', 'mid_layer'));
    await renderScreen(<EditGarment />);

    expect(await screen.findByRole('radio', { name: 'Suits and blazers' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Blazer' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Warm layers' })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Suits and blazers' }));
    expect(screen.getByRole('radio', { name: 'Blazer' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Hoodie' })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Blazer' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'navy' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'plain' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'cotton' }));
    await fireEvent.press(screen.getAllByRole('radio', { name: '3' })[0] as never);
    await fireEvent.press(screen.getAllByRole('radio', { name: '2' })[1] as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(api.updateClothing).toHaveBeenCalled());
    expect(api.updateClothing.mock.calls[0]?.[1]).toMatchObject({ category: 'mid_layer', subcategory: 'blazer' });
  });

  it('drops the type when another group is chosen and asks for the group before saving', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g2' });
    api.fetchClothing.mockResolvedValue({ ...waiting, group: 'sweaters_and_hoodies', subcategory: 'hoodie' });
    await renderScreen(<EditGarment />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Pants' }));
    expect(screen.getByRole('radio', { name: 'Jeans' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Jeans' })).not.toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText(/Still to fill in: type, color/)).toBeOnTheScreen();
    expect(api.updateClothing).not.toHaveBeenCalled();
  });
});
