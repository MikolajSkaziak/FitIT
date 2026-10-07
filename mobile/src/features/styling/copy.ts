import type { Relaxation } from '@/api/outfits';
import type { Category } from '@/api/wardrobe';
import { formatRange } from '@/features/weather/copy';

/** How each role of an outfit reads in a sentence about what the wardrobe lacks. */
interface RoleWords {
  /** "Brakuje ...". */
  genitive: string;
  /** "Potrzebne jest ...", with the verb, because it has to agree with the noun. */
  need: string;
  /** The same without the verb, for a list of several. */
  nominative: string;
  /** What to add, ready after "Dodaj". */
  add: readonly string[];
}

const roles: Record<Category, RoleWords> = {
  top: { genitive: 'góry', need: 'potrzebna jest góra', nominative: 'góra', add: ['koszulkę', 'koszulę', 'bluzkę'] },
  mid_layer: { genitive: 'warstwy pośredniej', need: 'potrzebna jest warstwa pośrednia', nominative: 'warstwa pośrednia', add: ['sweter', 'bluzę'] },
  bottom: { genitive: 'dołu', need: 'potrzebny jest dół', nominative: 'dół', add: ['spodnie', 'spódnicę', 'szorty'] },
  one_piece: { genitive: 'sukienki albo kombinezonu', need: 'potrzebna jest sukienka albo kombinezon', nominative: 'sukienka albo kombinezon', add: ['sukienkę', 'kombinezon'] },
  outerwear: { genitive: 'okrycia wierzchniego', need: 'potrzebne jest okrycie wierzchnie', nominative: 'okrycie wierzchnie', add: ['kurtkę', 'płaszcz'] },
  shoes: { genitive: 'butów', need: 'potrzebne są buty', nominative: 'buty', add: ['buty'] },
  accessory: { genitive: 'dodatku', need: 'potrzebny jest dodatek', nominative: 'dodatek', add: ['szalik', 'czapkę', 'rękawiczki'] },
};

/** The cold decides these two; the others are missing whatever the weather is. */
const weatherDriven: readonly Category[] = ['mid_layer', 'outerwear'];

/** "a, b i c": the last two joined by the word, the rest by commas. */
export function joinWords(parts: readonly string[], word: 'i' | 'albo'): string {
  if (parts.length <= 1) {
    return parts[0] ?? '';
  }

  return `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`;
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

  const needed = required.map((role) => roles[role].genitive);
  const alternative = options.length > 0 ? joinWords(options.map((role) => roles[role].genitive), 'albo') : null;
  const title = `Brakuje ${joinWords(alternative ? [...needed, alternative] : needed, 'i')}`;

  const everything = [...required, ...options];
  // Each missing role has several things that would fill it ("kurtkę albo płaszcz"); a role of its own is one more thing to add ("oraz").
  const adds = [...required.map((role) => joinWords(roles[role].add, 'albo')), ...(options.length > 0 ? [joinWords(options.flatMap((role) => roles[role].add), 'albo')] : [])].join(' oraz ');

  const cold = everything.length > 0 && everything.every((role) => weatherDriven.includes(role));
  const lead = cold ? `Przy ${formatRange(feelsMin, feelsMin)}` : 'Do zestawu';
  const need =
    options.length > 0 || required.length > 1
      ? `potrzebne jest co najmniej: ${joinWords(
          [...required.map((role) => roles[role].nominative), ...(options.length > 0 ? [joinWords(options.map((role) => roles[role].nominative), 'albo')] : [])],
          'i',
        )}`
      : roles[required[0] ?? 'top'].need;

  return { title, text: `${lead} ${need}. Dodaj ${adds}, a ułożymy zestaw.` };
}

const criteria = { formality: 'na tę okazję', style: 'w pasującym stylu', warmth: 'na tę temperaturę' } as const;

/** A rule that gave way, as a sentence a person can read. Same wording for every outfit of the request. */
export const relaxationLine = ({ role, rule }: Relaxation): string => `Nie masz ${roles[role].genitive} ${criteria[rule]}, więc proponuję to, co jest najbliżej.`;

export const relaxationLines = (relaxations: readonly Relaxation[]): string[] => unique(relaxations.map(relaxationLine));

export const umbrellaLine = 'Może padać, a w szafie nie ma okrycia na deszcz, więc weź parasol.';

export const rulesNote = 'Ten zestaw ułożyliśmy według prostych reguł, bo stylista AI jest teraz niedostępny.';

export const noOutfits = 'Nie udało się ułożyć zestawów z tego, co jest w szafie. Spróbuj z inną okazją albo dodaj ubrania.';
