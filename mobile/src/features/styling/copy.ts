import type { Category } from '@/api/wardrobe';
import { formatRange } from '@/features/weather/copy';

/** How each role of an outfit reads in a sentence about what the wardrobe lacks. */
interface RoleWords {
  /** The role as the app names it to a person, in lower case: "tops", "jackets and coats". */
  noun: string;
  /** What to add, ready after "Add". */
  add: readonly string[];
}

const roles: Record<Category, RoleWords> = {
  top: { noun: 'tops', add: ['a T-shirt', 'a shirt', 'a blouse'] },
  mid_layer: { noun: 'warm layers', add: ['a sweater', 'a hoodie'] },
  bottom: { noun: 'bottoms', add: ['pants', 'a skirt', 'shorts'] },
  one_piece: { noun: 'dresses and jumpsuits', add: ['a dress', 'a jumpsuit'] },
  outerwear: { noun: 'jackets and coats', add: ['a jacket', 'a coat'] },
  shoes: { noun: 'shoes', add: ['shoes'] },
  accessory: { noun: 'accessories', add: ['a scarf', 'a hat', 'gloves'] },
};

/** The cold decides these two; the others are missing whatever the weather is. */
const weatherDriven: readonly Category[] = ['mid_layer', 'outerwear'];

/** "a, b, and c": the last one joined by the word, the rest by commas. */
export function joinWords(parts: readonly string[], word: 'and' | 'or'): string {
  if (parts.length <= 1) {
    return parts[0] ?? '';
  }

  if (parts.length === 2) {
    return `${parts[0]} ${word} ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(', ')}, ${word} ${parts[parts.length - 1]}`;
}

export interface MissingNotice {
  title: string;
  text: string;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/**
 * What the sage panel says when the wardrobe cannot dress the person for this weather and occasion.
 * `all` are roles that must each be filled; `either` are roles where any one would do.
 */
export function missingNotice(all: readonly Category[], either: readonly Category[], feelsMin: number): MissingNotice {
  const required = unique(all);
  const options = unique(either).filter((role) => !required.includes(role));

  const needed = required.map((role) => roles[role].noun);
  const alternative = options.length > 0 ? joinWords(options.map((role) => roles[role].noun), 'or') : null;
  const list = joinWords(alternative ? [...needed, alternative] : needed, 'and');
  const title = `You’re missing ${list}`;

  const everything = [...required, ...options];
  // Each missing role has several things that would fill it ("a jacket or a coat"); a role of its own is one more thing to add ("plus").
  const adds = [...required.map((role) => joinWords(roles[role].add, 'or')), ...(options.length > 0 ? [joinWords(options.flatMap((role) => roles[role].add), 'or')] : [])].join(' plus ');

  const cold = everything.length > 0 && everything.every((role) => weatherDriven.includes(role));
  const lead = cold ? `At ${formatRange(feelsMin, feelsMin)}, you need` : 'To build an outfit, you need';
  const atLeast = options.length > 0 || required.length > 1 ? 'at least ' : '';

  return { title, text: `${lead} ${atLeast}${list}. Add ${adds} and we’ll put an outfit together.` };
}


export const umbrellaLine = 'Rain is possible and you don’t have a rainproof jacket, so bring an umbrella.';

export const rulesNote = 'Our AI stylist isn’t available right now, so we put this outfit together with simple style rules.';

export const noOutfits = 'We couldn’t put together an outfit from what you have. Try another occasion, or add more clothes.';
