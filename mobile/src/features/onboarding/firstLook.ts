import type { OutfitItem } from '@/api/outfits';
import type { Category, Clothing, StarterPiece } from '@/api/wardrobe';

/**
 * A first look out of pieces the person has: something on top and something below (or one dress standing in for both),
 * shoes, and a layer over it when there is one. Of several pieces in one role the first is taken, so the same pieces always give the same look. Nothing is
 * added that the person did not pick, and fewer than two pieces are not a look: the answer is then empty.
 */
export function pickFirstLook<T extends { category: Category | null }>(pieces: readonly T[]): T[] {
  const first = (role: Category): T | undefined => pieces.find((piece) => piece.category === role);
  const top = first('top');
  const middle = first('mid_layer');
  const bottom = first('bottom');
  // A sweater or hoodie is the top when there is no shirt under it, and the layer over the shirt when there is one.
  const upper = top ?? middle;
  const dress = first('one_piece');
  const body = upper && bottom ? [upper, bottom] : dress ? [dress] : [upper, bottom];
  // A cardigan or sweater goes over the shirt, and over a dress when there is one and no top to wear it as.
  const layer = first('outerwear') ?? (top || (dress && !(upper && bottom)) ? middle : undefined);
  const look = [...body, first('shoes'), layer].filter((piece): piece is T => piece !== undefined);
  return look.length >= 2 ? look : [];
}

/**
 * A common piece as the garment it becomes once it is in a wardrobe: ready, with the name, role, type, colors and
 * picture the list gives it, and nothing made up for the rest. The board draws it like any other garment.
 */
const asGarment = (piece: StarterPiece): Clothing => ({
  id: piece.code,
  status: 'ready',
  name: piece.name,
  category: piece.category,
  group: piece.group,
  subcategory: piece.type,
  colors: piece.colors,
  pattern: null,
  material: null,
  formality: null,
  warmth: null,
  rainOk: null,
  styles: [],
  seasons: [],
  inLaundry: false,
  rarelyWorn: false,
  isForgotten: false,
  wearCount: 0,
  lastWornOn: null,
  rejectReason: null,
  imageUrl: piece.imageUrl,
  imageKey: `starter-${piece.code}`,
  createdAt: '',
  photos: [],
  describedByAi: false,
});

/** The look of common pieces ticked before the account exists, ready for the board. */
export const lookOfStarters = (pieces: readonly StarterPiece[]): OutfitItem[] => pickFirstLook(pieces).map((piece) => ({ slot: piece.category, clothing: asGarment(piece) }));

/** The look of garments already in the wardrobe, ready for the board. Garments still being described have no role yet and are left out. */
export const lookOfClothes = (clothes: readonly Clothing[]): OutfitItem[] =>
  pickFirstLook(clothes).flatMap((clothing) => (clothing.category ? [{ slot: clothing.category, clothing }] : []));
