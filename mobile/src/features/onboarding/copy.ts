import type { GarmentGroup } from '@/api/wardrobe';
import { plural } from '@/lib/plural';

export const basics = {
  title: 'Tap what you already own',
  lead: 'Your first look is made from these.',
  /** The button of the step before sign-up: it moves on with what is ticked, or with nothing. */
  use: (count: number) => `Continue with ${count} ${plural(count, ['piece', 'pieces'])}`,
  useNone: 'Continue without pieces',
  selectAll: 'Select all',
  clear: 'Clear',
  count: (chosen: number, total: number) => `${chosen} of ${total} selected`,
  add: (count: number) => `Add ${count} ${plural(count, ['piece', 'pieces'])}`,
  addIdle: 'Add pieces',
  loading: 'Loading the basics',
  loadFailed: 'We couldn’t load the basics. Check your connection and try again.',
  retry: 'Try again',
};

/** The tabs of the picker and the line under a piece's name: the shop-style group of its type, as the server names it. */
export const groupLabel: Record<GarmentGroup, string> = {
  t_shirts_and_tops: 'T-shirts and tops',
  shirts_and_blouses: 'Shirts and blouses',
  sweaters_and_hoodies: 'Sweaters and hoodies',
  jackets_and_coats: 'Jackets and coats',
  jeans: 'Jeans',
  pants: 'Pants and shorts',
  skirts: 'Skirts',
  dresses_and_jumpsuits: 'Dresses and jumpsuits',
  suits_and_blazers: 'Suits and blazers',
  tracksuits_and_sweats: 'Tracksuits and sweats',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
};

/** The picker sheet and the wardrobe strip that bring the common pieces back after onboarding. */
export const pieces = {
  title: 'Pieces you might own',
  lead: 'Tap what you already own. It goes straight into your wardrobe.',
  see: 'See all',
  addOne: (name: string) => `Add ${name}`,
};

export const create = {
  title: 'Add to fitit.',
  clothes: 'Add clothes',
  build: 'Build an outfit',
};

/** The reveal before sign-up: a look made of the pieces the person just ticked, or a photograph when there are too few. */
export const firstLook = {
  title: 'Your first look is ready',
  /** `place` is the city chosen a step earlier; left out when the person gave none. */
  lead: (place?: string) => (place ? `Made from your pieces, and soon matched to the weather in ${place}.` : 'Made from the pieces you just picked.'),
  emptyTitle: 'Add a few pieces and your first looks appear here',
  keep: 'Create an account to keep it',
  leave: 'Not now',
};

/** Shown after sign-up when the picked pieces could not be added to the new wardrobe. */
export const pending = {
  text: 'Your account is ready, but we couldn’t add your pieces.',
  retry: 'Add them again',
};

export const shape = {
  title: 'Your body shape',
  lead: 'Pick the closest one, as it only guides how outfits are balanced on you.',
  gender: 'Gender',
  /** A quiet link: the gender was asked before the account, this reopens the question here. */
  changeGender: 'Change gender',
  shapes: 'Body shape',
  /** Said only once non-binary or prefer not to say is chosen. */
  allShapes: 'You see all ten shapes, so pick whichever is closest.',
};

export const fit = {
  title: 'Your fit',
  lead: 'We started with the most common answers, so change whatever isn’t you.',
  size: 'The size you reach for most',
  legs: 'Where does your waist sit?',
  /** Next to an answer that is still our guess. */
  suggested: 'Suggested',
  skip: 'I’d rather not say',
};

export const recap = {
  title: 'You’re set',
  /** With a look to show. `place` is where the weather comes from; left out when the person gave none. */
  readyLead: (place?: string) => `Looks like this one are built from your pieces${place ? ` and the forecast in ${place}` : ''}.`,
  /** With too few pieces for a look. */
  lead: 'Add a few pieces and your first looks appear here.',
  action: 'Go to Today',
  labels: { name: 'Name', weather: 'Weather for', styles: 'Favorite styles', colors: 'Your colors', clothes: 'Clothes added' },
};
