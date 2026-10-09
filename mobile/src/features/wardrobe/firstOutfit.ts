import type { Category, Clothing } from '@/api/wardrobe';
import { joinWords } from '@/features/styling/copy';

/** What an outfit cannot do without: something on top, something below (unless it is one piece) and shoes. */
export type MissingPart = 'top' | 'bottom' | 'shoes';

/**
 * What the wardrobe still lacks before the first outfit can be put together. Empty when it has enough.
 * Only garments that are ready count; a sweater can stand in for a top, a dress for top and bottom.
 */
export function missingForFirstOutfit(clothes: readonly Pick<Clothing, 'status' | 'category'>[]): MissingPart[] {
  const have = new Set<Category>();
  for (const item of clothes) {
    if (item.status === 'ready' && item.category) {
      have.add(item.category);
    }
  }

  const missing: MissingPart[] = [];
  const onePiece = have.has('one_piece');
  if (!onePiece && !have.has('top') && !have.has('mid_layer')) {
    missing.push('top');
  }

  if (!onePiece && !have.has('bottom')) {
    missing.push('bottom');
  }

  if (!have.has('shoes')) {
    missing.push('shoes');
  }

  return missing;
}

const names: Record<MissingPart, string> = { top: 'tops', bottom: 'bottoms', shoes: 'shoes' };

/** "Add a bottom and shoes to get your first outfit." or null when nothing is missing. */
export function firstOutfitHint(missing: readonly MissingPart[]): string | null {
  if (missing.length === 0) {
    return null;
  }

  const parts = missing.map((part) => names[part]);
  return `Add ${joinWords(parts, 'and')} to get your first outfit.`;
}
