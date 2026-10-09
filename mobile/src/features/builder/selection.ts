import type { Category, Clothing } from '@/api/wardrobe';

/** Outfit order, head to toe: the order of the groups in the picker and of the pieces in the bar below it. */
export const roleOrder: readonly Category[] = ['top', 'mid_layer', 'bottom', 'one_piece', 'outerwear', 'shoes', 'accessory'];

export const minPieces = 2;
export const maxAccessories = 3;

/** What a toggle did besides adding or removing the garment, for the one-line note. */
export type Effect = 'replaced_body' | 'accessories_full' | null;

export interface Toggled {
  items: Clothing[];
  effect: Effect;
}

const separates: readonly Category[] = ['top', 'bottom'];

const inOrder = (items: readonly Clothing[]): Clothing[] =>
  [...items].sort((a, b) => roleOrder.indexOf(a.category ?? 'accessory') - roleOrder.indexOf(b.category ?? 'accessory'));

/**
 * The rules of the picker. Tapping a chosen garment takes it out. Otherwise there is one garment per role (a new one takes
 * the place of the old), up to three accessories, and a dress or jumpsuit never goes with a top or a bottom: choosing one
 * clears the other side. Nothing here looks at the weather or the style: the person is free to choose.
 */
export function toggleGarment(items: readonly Clothing[], garment: Clothing): Toggled {
  if (items.some((item) => item.id === garment.id)) {
    return { items: items.filter((item) => item.id !== garment.id), effect: null };
  }

  const role = garment.category;
  if (!role) {
    return { items: [...items], effect: null };
  }

  if (role === 'accessory') {
    return items.filter((item) => item.category === 'accessory').length >= maxAccessories
      ? { items: [...items], effect: 'accessories_full' }
      : { items: inOrder([...items, garment]), effect: null };
  }

  const clash = (item: Clothing) =>
    item.category === role || (role === 'one_piece' && separates.includes(item.category as Category)) || (separates.includes(role) && item.category === 'one_piece');
  const kept = items.filter((item) => !clash(item));
  const replacedBody = items.some((item) => clash(item) && item.category !== role);
  return { items: inOrder([...kept, garment]), effect: replacedBody ? 'replaced_body' : null };
}
