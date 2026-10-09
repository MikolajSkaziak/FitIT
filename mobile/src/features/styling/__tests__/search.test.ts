import type { Outfit } from '@/api/outfits';
import { matchesOutfit } from '@/features/styling/search';

const outfit = {
  occasion: 'work',
  occasionNote: 'Presentation for a client',
  items: [{ clothing: { name: 'Navy oxford shirt' } }, { clothing: { name: 'Yellow café sweater' } }, { clothing: { name: null } }],
} as unknown as Outfit;

describe('matchesOutfit', () => {
  it('finds an outfit by its occasion, its note or any garment in it', () => {
    expect(matchesOutfit(outfit, 'work')).toBe(true);
    expect(matchesOutfit(outfit, 'client')).toBe(true);
    expect(matchesOutfit(outfit, 'shirt')).toBe(true);
  });

  it('does not mind capitals or accents', () => {
    expect(matchesOutfit(outfit, 'CAFE')).toBe(true);
    expect(matchesOutfit(outfit, 'café')).toBe(true);
  });

  it('shows everything for an empty search and nothing for a word that is nowhere', () => {
    expect(matchesOutfit(outfit, '  ')).toBe(true);
    expect(matchesOutfit(outfit, 'workout')).toBe(false);
  });
});
