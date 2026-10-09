import { plural } from '@/lib/plural';

import { piecesForFirstOutfit } from './steps';

export const basics = {
  title: 'Start with the basics',
  lead: 'Tick the pieces you already own and we’ll add them to your wardrobe, so your first outfits are ready today. You can swap these for photos of your own clothes any time.',
  selectAll: 'Select all',
  clear: 'Clear',
  count: (chosen: number, total: number) => `${chosen} of ${total} selected`,
  add: (count: number) => `Add ${count} ${plural(count, ['piece', 'pieces'])}`,
  addIdle: 'Add pieces',
  missing: 'Tick the pieces you own, or skip for now.',
  skip: 'Skip for now',
  loading: 'Loading the basics',
  loadFailed: 'We couldn’t load the basics. Check your connection and try again.',
  retry: 'Try again',
};

/** The picker sheet and the wardrobe strip that bring the common pieces back after onboarding. */
export const pieces = {
  title: 'Pieces you might own',
  lead: 'Tick what you have. You can swap any of them for photos of your own clothes any time.',
  see: 'See all',
  addOne: (name: string) => `Add ${name}`,
};

export const create = {
  title: 'Add to fitit.',
  clothes: 'Add clothes',
  build: 'Build an outfit',
};

export const recap = {
  title: 'You’re set',
  lead: 'Here is what fitit. knows about you so far.',
  next: 'What happens next',
  needMore: `Add ${piecesForFirstOutfit} or more pieces and we’ll style your first outfit.`,
  ready: 'You have enough to style your first outfit. Open Today and pick an occasion.',
  action: 'Go to Today',
  labels: { name: 'Name', weather: 'Weather for', styles: 'Favorite styles', colors: 'Your colors', clothes: 'Clothes added' },
};
