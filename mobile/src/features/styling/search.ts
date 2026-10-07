import type { Outfit } from '@/api/outfits';
import { occasionLabel } from '@/copy/labels';

/** Lower case without accents, so "swetr" finds "Sweter" and "zolty" finds "żółty". */
const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').toLowerCase();

/** Whether an outfit answers a search typed by a person: by its occasion, its note, or the name of any garment in it. */
export function matchesOutfit(outfit: Outfit, query: string): boolean {
  const wanted = plain(query.trim());
  if (!wanted) {
    return true;
  }

  const haystack = [occasionLabel(outfit.occasion), outfit.occasionNote ?? '', ...outfit.items.map((item) => item.clothing.name ?? '')];
  return haystack.some((text) => plain(text).includes(wanted));
}
