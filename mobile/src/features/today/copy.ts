import type { Occasion, Outfit } from '@/api/outfits';
import { kindLabel } from '@/copy/labels';

/** The occasions as the row of pills names them: short enough to sit side by side, everyday first. */
export const occasionPills: readonly { value: Occasion; label: string }[] = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'work', label: 'Work' },
  { value: 'business', label: 'Business' },
  { value: 'date', label: 'Date night' },
  { value: 'friends', label: 'Friends' },
  { value: 'workout', label: 'Workout' },
];

/** How many pieces make a wardrobe the stylist can vary: the nudge to add more goes away there. */
export const wardrobeGoal = 10;

const count = (value: number, one: string, many: string): string => `${value} ${value === 1 ? one : many}`;

export const piecesTitle = (total: number): string => `${count(total, 'piece', 'pieces')} in your wardrobe`;

export const piecesProgress = (total: number): string => `${total} of ${count(wardrobeGoal, 'piece', 'pieces')}`;

export const nudgeLine = (total: number): string => `Add ${wardrobeGoal - total} more and your picks get far more varied.`;

const numbers = ['No', 'One', 'Two', 'Three'] as const;

/** The line under "Today's picks": how many outfits there are to look at. */
export const picksLine = (outfits: number): string =>
  `${numbers[outfits] ?? outfits} ${outfits === 1 ? 'outfit' : 'outfits'} from your wardrobe, for this weather`;

/** The small label on a card: what kind of proposal it is, or its place among them when it earned no kind. */
export const pickTag = (outfit: Pick<Outfit, 'kind'>, position: number): string => (outfit.kind ? kindLabel(outfit.kind) : `Outfit ${position + 1}`);

const titles: Record<NonNullable<Outfit['kind']>, string> = {
  sure_bet: 'Your sure bet',
  discovery: 'Something rediscovered',
  new_pairing: 'A new pairing',
};

/** What the outfit is called under the cards: its own name when it has one, otherwise what kind of pick it is. */
export const pickName = (outfit: Pick<Outfit, 'name' | 'kind'>, position: number): string =>
  outfit.name ?? (outfit.kind ? titles[outfit.kind] : `Outfit ${position + 1}`);

/** The stylist's reason, cut to its first sentence: the full text is on the outfit's own page. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  return /^.*?[.!?](?=\s|$)/.exec(trimmed)?.[0] ?? trimmed;
}

/** "Give your navy jacket a turn". A name that starts like an ordinary word is set in lower case; "USA tee" is left alone. */
export function turnLine(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return 'Give this piece a turn';
  }

  const lower = /^[A-Z][a-z]/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
  return `Give your ${lower} a turn`;
}

/**
 * Which card of the row is the one in front, from how far the row has scrolled. The last card cannot travel a whole
 * step (the row ends first), so reaching the end counts as the last card.
 */
export function carouselIndex(offsetX: number, step: number, cards: number, maxOffset: number): number {
  if (cards <= 1 || step <= 0) {
    return 0;
  }

  if (maxOffset > 0 && offsetX >= maxOffset - 1) {
    return cards - 1;
  }

  return Math.min(cards - 1, Math.max(0, Math.round(offsetX / step)));
}
