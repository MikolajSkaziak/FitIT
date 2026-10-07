import { create } from 'zustand';

import { noFilter, type Category, type ClothesFilter } from '@/api/wardrobe';
import { onSessionEnd } from '@/auth/session';

interface FilterStore extends ClothesFilter {
  setSearch: (search: string) => void;
  setCategory: (category: Category | null) => void;
  setForgotten: (forgotten: boolean) => void;
  clear: () => void;
}

/** How the wardrobe is narrowed. Shared by the list and the filter sheet that opens over it. */
export const useWardrobeFilters = create<FilterStore>((set) => ({
  ...noFilter,
  setSearch: (search) => set({ search }),
  setCategory: (category) => set({ category }),
  setForgotten: (forgotten) => set({ forgotten }),
  clear: () => set(noFilter),
}));

export const isFiltered = (filter: ClothesFilter): boolean => filter.search.trim().length > 0 || filter.category !== null || filter.forgotten;

onSessionEnd(() => useWardrobeFilters.getState().clear());
