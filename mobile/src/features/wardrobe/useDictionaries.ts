import { useQuery } from '@tanstack/react-query';

import { fetchDictionaries, wardrobeKeys, type Category, type Clothing, type Dictionaries, type GarmentGroup, type Subcategory } from '@/api/wardrobe';

/** The closed lists a garment is described with, with their labels. They change only with a new version of the server. */
export function useDictionaries() {
  return useQuery({ queryKey: wardrobeKeys.dictionaries, queryFn: fetchDictionaries, staleTime: Infinity, gcTime: Infinity });
}

export const groupLabel = (dictionaries: Dictionaries | undefined, group: GarmentGroup | null | undefined): string | null =>
  dictionaries?.groups.find((entry) => entry.code === group)?.label ?? null;

/** The role a type plays in an outfit. A person never picks it: it follows from the type they chose. */
export const categoryOfType = (dictionaries: Dictionaries, type: Subcategory | null | undefined): Category | null =>
  dictionaries.categories.find((entry) => entry.types.some((candidate) => candidate.code === type))?.code ?? null;

export const typeLabel = (dictionaries: Dictionaries | undefined, type: Subcategory | null | undefined): string | null => {
  for (const group of dictionaries?.groups ?? []) {
    const found = group.types.find((entry) => entry.code === type);
    if (found) {
      return found.label;
    }
  }

  return null;
};

/** "Sweaters and hoodies, hoodie": where the garment belongs, for the line under its name. */
export function kindLine(dictionaries: Dictionaries | undefined, item: Pick<Clothing, 'group' | 'subcategory'>): string | null {
  const group = groupLabel(dictionaries, item.group);
  const type = typeLabel(dictionaries, item.subcategory);
  return group && type ? `${group}, ${type.toLowerCase()}` : (group ?? type);
}
