import type { Category } from '@/api/wardrobe';

import type { Effect } from './selection';

export const builder = {
  title: 'Build an outfit',
  lead: 'Tap pieces to put them together. One per group, and up to three accessories.',
  empty: { title: 'Nothing to build with yet', text: 'Add a few pieces and they will show up here.', action: 'Add clothes' },
  hintFew: 'Pick at least two pieces',
  preview: 'Preview outfit',
};

/** The groups of the picker, in outfit order. */
export const groupTitle: Record<Category, string> = {
  top: 'Tops',
  mid_layer: 'Warm layers',
  bottom: 'Bottoms',
  one_piece: 'Dresses and jumpsuits',
  outerwear: 'Jackets and coats',
  shoes: 'Shoes',
  accessory: 'Accessories',
};

export const effectNote: Record<Exclude<Effect, null>, string> = {
  replaced_body: 'A dress or jumpsuit stands in for a top and a bottom, so those were taken out.',
  accessories_full: 'That’s three accessories. Take one out to add another.',
};

export const previewCopy = {
  title: 'Your outfit',
  piecesTitle: 'Pieces',
  nameLabel: 'Name (optional)',
  namePlaceholder: 'e.g. Sunday brunch',
  occasionTitle: 'Occasion',
  save: 'Save outfit',
  tips: 'Get tips',
  tipsAgain: 'Get tips again',
  tipsLoading: 'Looking at your outfit',
  tipsTitle: 'Tips',
  works: 'What works',
  improve: 'Could be better',
  limit: 'You’ve used today’s tips. More tomorrow.',
};
