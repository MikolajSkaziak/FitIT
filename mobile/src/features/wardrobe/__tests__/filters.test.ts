import { fetchClothes, noFilter, wardrobeKeys } from '@/api/wardrobe';
import { signOut } from '@/auth/session';
import { filterCount, isFiltered, subFilterTypes, useWardrobeFilters } from '@/features/wardrobe/filters';
import { json, serveWith } from '@/test/http';
import { wardrobeDictionaries } from '@/test/fixtures';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));

const store = () => useWardrobeFilters.getState();

beforeEach(() => store().clear());

describe('the filter store', () => {
  it('starts with the whole wardrobe, newest first and not grouped', () => {
    expect(store()).toMatchObject({ ...noFilter, sort: 'added', groupBy: 'none' });
    expect(isFiltered(store())).toBe(false);
  });

  it('adds a value to its list and takes it out when it is chosen again', () => {
    store().toggleColor('navy');
    store().toggleColor('white');
    store().toggleSeason('fall');
    store().toggleMaterial('wool');
    store().toggleColor('navy');

    expect(store()).toMatchObject({ colors: ['white'], seasons: ['fall'], materials: ['wool'] });
  });

  it('forgets the chosen types whenever the chosen groups change', () => {
    store().toggleGroup('pants');
    store().toggleType('trousers');
    store().toggleType('chinos');
    expect(store().types).toEqual(['trousers', 'chinos']);

    store().toggleGroup('sweaters_and_hoodies');
    expect(store().groups).toEqual(['pants', 'sweaters_and_hoodies']);
    expect(store().types).toEqual([]);

    store().toggleType('hoodie');
    store().clearGroups();
    expect(store()).toMatchObject({ groups: [], types: [] });
  });

  it('counts only real filters: sorting and grouping do not, and neither does the search in the count of the sheet', () => {
    store().setSort('worn');
    store().setGroupBy('season');
    expect(isFiltered(store())).toBe(false);
    expect(filterCount(store())).toBe(0);

    store().setSearch('  ');
    expect(isFiltered(store())).toBe(false);
    store().setSearch('shirt');
    expect(isFiltered(store())).toBe(true);
    expect(filterCount(store())).toBe(0);

    store().toggleGroup('pants');
    store().toggleGroup('suits_and_blazers');
    store().toggleColor('navy');
    store().toggleColor('white');
    store().setUsage('used');
    store().setForgotten(true);
    // One for each section with a choice in it, however many values it holds.
    expect(filterCount(store())).toBe(4);
  });

  it('puts everything back with one call, sorting and grouping included', () => {
    store().setSearch('shirt');
    store().toggleGroup('pants');
    store().toggleType('chinos');
    store().toggleSeason('winter');
    store().setUsage('unused');
    store().setSort('color');
    store().setGroupBy('group');

    store().clear();

    expect(store()).toMatchObject({ ...noFilter, sort: 'added', groupBy: 'none' });
  });

  it('is cleared when the person signs out', async () => {
    store().toggleColor('navy');
    store().setSort('worn');
    store().setGroupBy('color');

    await signOut();

    expect(store()).toMatchObject({ ...noFilter, sort: 'added', groupBy: 'none' });
  });
});

describe('the types row', () => {
  it('offers the types of the one chosen group, and nothing for no group or several', () => {
    expect(subFilterTypes(wardrobeDictionaries, [])).toBeNull();
    expect(subFilterTypes(wardrobeDictionaries, ['pants', 'suits_and_blazers'])).toBeNull();
    expect(subFilterTypes(undefined, ['pants'])).toBeNull();
    expect(subFilterTypes(wardrobeDictionaries, ['pants'])?.map((type) => type.label)).toEqual(['Trousers', 'Chinos']);
  });
});

describe('asking the server', () => {
  it('names every filter that is set, and none that is not', async () => {
    const seen = serveWith(() => json(200, []));

    await fetchClothes({ ...noFilter, search: ' tee ', groups: ['pants'], types: ['trousers', 'chinos'], colors: ['navy'], seasons: ['fall', 'winter'], materials: ['wool'], usage: 'unused', forgotten: true });
    await fetchClothes(noFilter);

    const query = (path: string) => Object.fromEntries(new URL(`http://x${path}`).searchParams);
    expect(query(seen[0]?.path ?? '')).toEqual({
      q: 'tee',
      group: 'pants',
      types: 'trousers,chinos',
      colors: 'navy',
      seasons: 'fall,winter',
      materials: 'wool',
      usage: 'unused',
      forgotten: 'true',
    });
    expect(seen[1]?.path).toBe('/api/clothes');
  });

  it('keeps one query key for the same choice made in another order, and tells different choices apart', () => {
    const base = { ...noFilter, colors: ['navy', 'white'] as const, seasons: ['winter', 'fall'] as const };

    expect(wardrobeKeys.list(base)).toEqual(wardrobeKeys.list({ ...base, colors: ['white', 'navy'], seasons: ['fall', 'winter'] }));
    for (const other of [
      { ...base, types: ['jeans'] as const },
      { ...base, materials: ['wool'] as const },
      { ...base, usage: 'used' as const },
      { ...base, forgotten: true },
      { ...base, search: 'a' },
      { ...base, colors: ['navy'] as const },
    ]) {
      expect(wardrobeKeys.list(other)).not.toEqual(wardrobeKeys.list(base));
    }
  });
});
