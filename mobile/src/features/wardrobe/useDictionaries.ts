import { useQuery } from '@tanstack/react-query';

import { fetchDictionaries, wardrobeKeys, type Category, type Clothing, type Dictionaries, type Subcategory } from '@/api/wardrobe';

/** The closed lists a garment is described with, with their labels. They change only with a new version of the server. */
export function useDictionaries() {
  return useQuery({ queryKey: wardrobeKeys.dictionaries, queryFn: fetchDictionaries, staleTime: Infinity, gcTime: Infinity });
}

export const categoryLabel = (dictionaries: Dictionaries | undefined, category: Category | null | undefined): string | null =>
  dictionaries?.categories.find((entry) => entry.code === category)?.label ?? null;

export const typeLabel = (dictionaries: Dictionaries | undefined, type: Subcategory | null | undefined): string | null => {
  for (const category of dictionaries?.categories ?? []) {
    const found = category.types.find((entry) => entry.code === type);
    if (found) {
      return found.label;
    }
  }

  return null;
};

/** "Góra, koszula": where the garment belongs, for the line under its name. */
export function kindLine(dictionaries: Dictionaries | undefined, item: Pick<Clothing, 'category' | 'subcategory'>): string | null {
  const category = categoryLabel(dictionaries, item.category);
  const type = typeLabel(dictionaries, item.subcategory);
  return category && type ? `${category}, ${type.toLowerCase()}` : (category ?? type);
}
