import { groupClothes, sortClothes, toRows, undescribed } from '@/features/wardrobe/arrange';
import { clothing, wardrobeDictionaries } from '@/test/fixtures';

const make = (id: string, change: Parameters<typeof clothing>[3], created: string) => clothing(id, id, 'top', { createdAt: `2026-10-0${created}T08:00:00Z`, ...change });

const shirt = make('shirt', { group: 'shirts_and_blouses', subcategory: 'shirt', colors: ['navy'], seasons: ['spring', 'fall'], wearCount: 2, lastWornOn: '2026-10-01' }, '1');
const hoodie = make('hoodie', { group: 'sweaters_and_hoodies', subcategory: 'hoodie', colors: ['light_blue', 'white'], seasons: ['fall', 'winter'], wearCount: 5, lastWornOn: '2026-09-20' }, '2');
const jeans = make('jeans', { group: 'jeans', subcategory: 'jeans', colors: ['navy'], seasons: ['spring', 'summer', 'fall'], wearCount: 5, lastWornOn: '2026-10-05' }, '3');
const chinos = make('chinos', { group: 'pants', subcategory: 'chinos', colors: ['white'], seasons: ['summer'], wearCount: 0, lastWornOn: null }, '4');
const fresh = make('fresh', { status: 'processing', group: null, subcategory: null, colors: [], seasons: [], wearCount: 0, lastWornOn: null }, '5');
const all = [chinos, shirt, fresh, jeans, hoodie];
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe('sorting the wardrobe', () => {
  it('puts the newest first by default and leaves the array it was given alone', () => {
    const before = ids(all);

    expect(ids(sortClothes(all, 'added', wardrobeDictionaries))).toEqual(['fresh', 'chinos', 'jeans', 'hoodie', 'shirt']);
    expect(ids(all)).toEqual(before);
  });

  it('follows the order of the groups in the dictionary, then of the types, with undescribed garments last', () => {
    expect(ids(sortClothes(all, 'group', wardrobeDictionaries))).toEqual(['shirt', 'hoodie', 'jeans', 'chinos', 'fresh']);
  });

  it('follows the order of the colors by the main color, newest first among equals', () => {
    // white (chinos), navy (jeans, shirt), light blue (hoodie, main color light blue), none (fresh)
    expect(ids(sortClothes(all, 'color', wardrobeDictionaries))).toEqual(['chinos', 'jeans', 'shirt', 'hoodie', 'fresh']);
  });

  it('puts the most worn first, then the most recently worn, and never worn last', () => {
    expect(ids(sortClothes(all, 'worn', wardrobeDictionaries))).toEqual(['jeans', 'hoodie', 'shirt', 'fresh', 'chinos']);
  });

  it('falls back to newest first while the dictionaries have not arrived', () => {
    expect(ids(sortClothes(all, 'group', undefined))).toEqual(['fresh', 'chinos', 'jeans', 'hoodie', 'shirt']);
  });
});

describe('grouping the wardrobe', () => {
  it('is one list without headings when not grouped, and nothing at all for an empty wardrobe', () => {
    expect(groupClothes(all, 'none', wardrobeDictionaries)).toEqual([{ key: 'all', title: null, data: all }]);
    expect(groupClothes([], 'group', wardrobeDictionaries)).toEqual([]);
  });

  it('puts a heading over each group in dictionary order, leaves out empty ones and puts the undescribed last', () => {
    const sections = groupClothes(sortClothes(all, 'added', wardrobeDictionaries), 'group', wardrobeDictionaries);

    expect(sections.map((section) => section.title)).toEqual(['Shirts and blouses', 'Sweaters and hoodies', 'Jeans', 'Pants', undescribed]);
    expect(sections.map((section) => ids(section.data))).toEqual([['shirt'], ['hoodie'], ['jeans'], ['chinos'], ['fresh']]);
  });

  it('puts a garment with two colors under its main one', () => {
    const sections = groupClothes(all, 'color', wardrobeDictionaries);

    expect(sections.map((section) => section.title)).toEqual(['white', 'navy', 'light blue', undescribed]);
    expect(ids(sections[2]?.data ?? [])).toEqual(['hoodie']);
    expect(ids(sections[0]?.data ?? [])).toEqual(['chinos']);
  });

  it('puts a garment for several seasons under the first of them: spring, summer, fall, winter', () => {
    const sections = groupClothes(all, 'season', wardrobeDictionaries);

    expect(sections.map((section) => section.title)).toEqual(['Spring', 'Summer', 'Fall', undescribed]);
    expect(sections.map((section) => ids(section.data))).toEqual([['shirt', 'jeans'], ['chinos'], ['hoodie'], ['fresh']]);
  });

  it('lays sections out as rows of two tiles under heading rows, numbering the tiles through the whole list', () => {
    const rows = toRows(groupClothes([shirt, hoodie, jeans, chinos], 'group', wardrobeDictionaries));

    expect(rows.map((row) => (row.kind === 'heading' ? `${row.title} (${row.count})` : ids(row.items).join('+')))).toEqual([
      'Shirts and blouses (1)',
      'shirt',
      'Sweaters and hoodies (1)',
      'hoodie',
      'Jeans (1)',
      'jeans',
      'Pants (1)',
      'chinos',
    ]);
    expect(rows.filter((row) => row.kind === 'tiles').map((row) => row.firstIndex)).toEqual([0, 1, 2, 3]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(toRows(groupClothes([shirt, hoodie, jeans], 'none', wardrobeDictionaries)).map((row) => row.kind)).toEqual(['tiles', 'tiles']);
  });
});
