import { create } from 'zustand';

import {
  noFilter,
  type ClothesFilter,
  type Color,
  type Dictionaries,
  type GarmentGroup,
  type Material,
  type Season,
  type Subcategory,
  type UsageFilter,
} from '@/api/wardrobe';
import { onSessionEnd } from '@/auth/session';

import { defaultArrangement, type Arrangement, type GroupBy, type SortKey } from './arrange';

interface FilterStore extends ClothesFilter, Arrangement {
  setSearch: (search: string) => void;
  /** Adds the group to the chosen ones, or takes it out when it is already there. The types belong to the chosen groups, so they go. */
  toggleGroup: (group: GarmentGroup) => void;
  clearGroups: () => void;
  toggleType: (type: Subcategory) => void;
  toggleColor: (color: Color) => void;
  toggleSeason: (season: Season) => void;
  toggleMaterial: (material: Material) => void;
  setUsage: (usage: UsageFilter) => void;
  setForgotten: (forgotten: boolean) => void;
  setSort: (sort: SortKey) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  /** Back to the whole wardrobe in its default order. */
  clear: () => void;
}

const toggled = <T>(values: readonly T[], value: T): T[] => (values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);

/** How the wardrobe is narrowed, sorted and grouped. Shared by the list and the filter sheet that opens over it. */
export const useWardrobeFilters = create<FilterStore>((set) => ({
  ...noFilter,
  ...defaultArrangement,
  setSearch: (search) => set({ search }),
  toggleGroup: (group) => set((state) => ({ groups: toggled(state.groups, group), types: [] })),
  clearGroups: () => set({ groups: [], types: [] }),
  toggleType: (type) => set((state) => ({ types: toggled(state.types, type) })),
  toggleColor: (color) => set((state) => ({ colors: toggled(state.colors, color) })),
  toggleSeason: (season) => set((state) => ({ seasons: toggled(state.seasons, season) })),
  toggleMaterial: (material) => set((state) => ({ materials: toggled(state.materials, material) })),
  setUsage: (usage) => set({ usage }),
  setForgotten: (forgotten) => set({ forgotten }),
  setSort: (sort) => set({ sort }),
  setGroupBy: (groupBy) => set({ groupBy }),
  clear: () => set({ ...noFilter, ...defaultArrangement }),
}));

/** Whether anything narrows the list. Sorting and grouping only arrange it, so they do not count. */
export const isFiltered = (filter: ClothesFilter): boolean =>
  filter.search.trim().length > 0 || filterCount(filter) > 0 || filter.types.length > 0;

/**
 * How many of the filters of the sheet are set: one for each section that has a choice in it, however many values it holds.
 * The search box and the types row sit on the screen itself and are not counted.
 */
export const filterCount = (filter: ClothesFilter): number =>
  [filter.groups.length > 0, filter.colors.length > 0, filter.seasons.length > 0, filter.materials.length > 0, filter.usage !== 'all', filter.forgotten].filter(
    Boolean,
  ).length;

/** The types to offer under the search box: those of the one chosen group. With none chosen, or several, there is no row. */
export function subFilterTypes(dictionaries: Dictionaries | undefined, groups: readonly GarmentGroup[]): readonly { code: Subcategory; label: string }[] | null {
  if (groups.length !== 1) {
    return null;
  }

  return dictionaries?.groups.find((entry) => entry.code === groups[0])?.types ?? null;
}

onSessionEnd(() => useWardrobeFilters.getState().clear());
