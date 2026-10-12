import type { Category } from '@/api/wardrobe';

import type { Effect } from './selection';

export const builder = {
  title: 'Build an outfit',
  lead: 'Pick a top, a bottom, shoes and whatever goes with them. The board updates as you go.',
  empty: { title: 'Nothing to build with yet', text: 'Add a few pieces and they will show up here.', action: 'Add clothes' },
  hintFew: 'Pick at least two pieces',
  preview: 'Preview outfit',
};

/** What a role is called where the wardrobe's own name for a garment's kind is not known. */
export const groupTitle: Record<Category, string> = {
  top: 'Tops',
  mid_layer: 'Sweaters and layers',
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
  wear: 'Wear it today',
  worn: 'Worn',
  /** The check in the corner. Not "Done": that is the board's own button while it is being arranged. */
  finish: 'Finish',
  swap: (name: string) => `Swap ${name}`,
  remove: (name: string) => `Take out ${name}`,
  add: 'Add a piece',
  few: 'Add at least two pieces to wear or save this outfit.',
  tips: 'Get tips',
  tipsAgain: 'Get tips again',
  tipsLoading: 'Looking at your outfit',
  tipsTitle: 'Tips',
  works: 'What works',
  improve: 'Could be better',
  limit: 'You’ve used today’s tips. More tomorrow.',
};

export const swapCopy = {
  eyebrow: 'Swap',
  empty: 'Nothing else of this kind in your wardrobe yet.',
};
