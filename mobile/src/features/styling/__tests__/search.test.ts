import type { Outfit } from '@/api/outfits';
import { matchesOutfit } from '@/features/styling/search';

const outfit = {
  occasion: 'work',
  occasionNote: 'Prezentacja przed klientem',
  items: [{ clothing: { name: 'Granatowa koszula oxford' } }, { clothing: { name: 'Żółty sweter' } }, { clothing: { name: null } }],
} as unknown as Outfit;

describe('matchesOutfit', () => {
  it('finds an outfit by its occasion, its note or any garment in it', () => {
    expect(matchesOutfit(outfit, 'praca')).toBe(true);
    expect(matchesOutfit(outfit, 'klient')).toBe(true);
    expect(matchesOutfit(outfit, 'koszula')).toBe(true);
  });

  it('does not mind capitals or Polish letters', () => {
    expect(matchesOutfit(outfit, 'ZOLTY')).toBe(true);
    expect(matchesOutfit(outfit, 'żółty')).toBe(true);
  });

  it('shows everything for an empty search and nothing for a word that is nowhere', () => {
    expect(matchesOutfit(outfit, '  ')).toBe(true);
    expect(matchesOutfit(outfit, 'trening')).toBe(false);
  });
});
