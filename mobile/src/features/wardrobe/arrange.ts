import type { Clothing, Dictionaries } from '@/api/wardrobe';

export type SortKey = 'added' | 'group' | 'color' | 'worn';
export type GroupBy = 'none' | 'group' | 'season' | 'color';

export interface Arrangement {
  sort: SortKey;
  groupBy: GroupBy;
}

export const defaultArrangement: Arrangement = { sort: 'added', groupBy: 'none' };

export const sortOptions: readonly { value: SortKey; label: string }[] = [
  { value: 'added', label: 'Date added' },
  { value: 'group', label: 'Group' },
  { value: 'color', label: 'Color' },
  { value: 'worn', label: 'Most worn' },
];

export const groupByOptions: readonly { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'group', label: 'Group' },
  { value: 'season', label: 'Season' },
  { value: 'color', label: 'Color' },
];

/** A garment that has no group, colour or season yet (it is still being described) goes last, under this heading. */
export const undescribed = 'Not described yet';

/** Position of a code in a dictionary list; what the list does not know goes last. */
const rankIn = (codes: readonly string[], code: string | null | undefined): number => {
  const at = code ? codes.indexOf(code) : -1;
  return at < 0 ? codes.length : at;
};

const newestFirst = (a: Clothing, b: Clothing): number => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/**
 * The order of the list. Never changes the array it is given, and garments that tie keep the order they came in (newest first),
 * so the list does not shuffle when something else about it changes.
 *  - added: newest first.
 *  - group: the order of the groups in the dictionary, then of the types inside the group.
 *  - color: the order of the colours in the dictionary, by the main colour.
 *  - worn: worn most often first, then worn most recently; never worn last.
 */
export function sortClothes(items: readonly Clothing[], sort: SortKey, dictionaries: Dictionaries | undefined): Clothing[] {
  const byNewest = [...items].sort(newestFirst);
  if (sort === 'added' || !dictionaries) {
    return byNewest;
  }

  const groups = dictionaries.groups.map((entry) => entry.code as string);
  const types = dictionaries.groups.flatMap((entry) => entry.types.map((type) => type.code as string));
  const colors = dictionaries.colors.map((entry) => entry.code as string);
  const order = (item: Clothing): number[] => {
    switch (sort) {
      case 'group':
        return [rankIn(groups, item.group), rankIn(types, item.subcategory)];
      case 'color':
        return [rankIn(colors, item.colors[0])];
      default:
        return [-item.wearCount, item.lastWornOn ? -Date.parse(item.lastWornOn) : 0];
    }
  };

  // Array.prototype.sort is stable: ties stay newest first.
  return byNewest.sort((a, b) => {
    const left = order(a);
    const right = order(b);
    for (let at = 0; at < left.length; at += 1) {
      const difference = (left[at] ?? 0) - (right[at] ?? 0);
      if (difference !== 0) {
        return difference;
      }
    }

    return 0;
  });
}

/** The earliest of the garment's seasons in the dictionary's order. */
const firstSeason = (item: Clothing, order: readonly string[]): string | undefined =>
  [...item.seasons].sort((a, b) => rankIn(order, a) - rankIn(order, b))[0];

export interface ClothesSection {
  key: string;
  /** Null for the one section of an ungrouped list: it has no heading. */
  title: string | null;
  data: Clothing[];
}

/**
 * Splits the list under headings, in the order of the dictionary; a heading with nothing under it is left out. Inside a section the
 * garments keep the order they came in. A garment with two colours goes under its main (first) colour, one for several seasons
 * under the first of them in the order spring, summer, fall, winter.
 */
export function groupClothes(items: readonly Clothing[], groupBy: GroupBy, dictionaries: Dictionaries | undefined): ClothesSection[] {
  if (items.length === 0) {
    return [];
  }

  const entries: readonly { code: string; label: string }[] =
    groupBy === 'group' ? (dictionaries?.groups ?? []) : groupBy === 'color' ? (dictionaries?.colors ?? []) : groupBy === 'season' ? (dictionaries?.seasons ?? []) : [];
  if (groupBy === 'none' || entries.length === 0) {
    return [{ key: 'all', title: null, data: [...items] }];
  }

  const keyOf = (item: Clothing): string | null => {
    const key = groupBy === 'group' ? item.group : groupBy === 'color' ? item.colors[0] : firstSeason(item, entries.map((entry) => entry.code));
    return key && entries.some((entry) => entry.code === key) ? key : null;
  };

  const sections: ClothesSection[] = entries.map((entry) => ({ key: entry.code, title: entry.label, data: [] }));
  const rest: ClothesSection = { key: 'undescribed', title: undescribed, data: [] };
  for (const item of items) {
    const key = keyOf(item);
    (sections.find((section) => section.key === key) ?? rest).data.push(item);
  }

  return [...sections, rest].filter((section) => section.data.length > 0);
}

export type ListRow =
  | { kind: 'heading'; key: string; title: string; count: number }
  | { kind: 'tiles'; key: string; items: Clothing[]; firstIndex: number };

/** Lays the sections out as rows of a one-column list: a heading row, then the tiles two to a row. `firstIndex` is the position of the row's first tile in the whole list. */
export function toRows(sections: readonly ClothesSection[]): ListRow[] {
  const rows: ListRow[] = [];
  let index = 0;
  for (const section of sections) {
    if (section.title) {
      rows.push({ kind: 'heading', key: `heading-${section.key}`, title: section.title, count: section.data.length });
    }

    for (let at = 0; at < section.data.length; at += 2) {
      const items = section.data.slice(at, at + 2);
      rows.push({ kind: 'tiles', key: `${section.key}-${items[0]?.id}`, items, firstIndex: index });
      index += items.length;
    }
  }

  return rows;
}
