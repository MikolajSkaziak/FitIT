import { carouselIndex, firstSentence, nudgeLine, occasionPills, pickName, pickTag, picksLine, piecesProgress, piecesTitle, turnLine } from '@/features/today/copy';
import { occasionOptions } from '@/copy/labels';
import { greetingAt, hourSlots } from '@/features/weather/copy';

describe('carouselIndex', () => {
  // Three cards 262 wide with 12 between them on a 390 wide phone: a step of 274, and 452 of travel in all.
  it.each([
    [0, 0],
    [136, 0],
    [138, 1],
    [274, 1],
    [420, 2],
    [451, 2],
    [452, 2],
    [600, 2],
    [-40, 0],
  ])('at %i points the card in front is number %i', (offset, index) => {
    expect(carouselIndex(offset, 274, 3, 452)).toBe(index);
  });

  it('has only the first card when there is one, or nothing to measure with', () => {
    expect(carouselIndex(300, 274, 1, 0)).toBe(0);
    expect(carouselIndex(300, 0, 3, 452)).toBe(0);
    expect(carouselIndex(0, 274, 3, 0)).toBe(0);
  });
});

describe('the words of the picks', () => {
  it('names a pick by its own name, then by its kind, then by its place', () => {
    expect(pickName({ name: 'Friday best', kind: 'sure_bet' }, 0)).toBe('Friday best');
    expect(pickName({ name: null, kind: 'discovery' }, 1)).toBe('Something rediscovered');
    expect(pickName({ name: null, kind: null }, 2)).toBe('Outfit 3');
    expect(pickTag({ kind: 'new_pairing' }, 0)).toBe('New pairing');
    expect(pickTag({ kind: null }, 1)).toBe('Outfit 2');
  });

  it('counts the outfits in words', () => {
    expect(picksLine(1)).toBe('One outfit from your wardrobe, for this weather');
    expect(picksLine(2)).toBe('Two outfits from your wardrobe, for this weather');
    expect(picksLine(3)).toBe('Three outfits from your wardrobe, for this weather');
  });

  it('keeps the first sentence of the reason', () => {
    expect(firstSentence('  Light for 14°C. Add a layer later. ')).toBe('Light for 14°C.');
    expect(firstSentence('Works at 7.5°C all day! Really.')).toBe('Works at 7.5°C all day!');
    expect(firstSentence('No full stop here')).toBe('No full stop here');
  });

  it('asks for a turn in the garment’s own words', () => {
    expect(turnLine('Navy jacket')).toBe('Give your navy jacket a turn');
    expect(turnLine('USA tee')).toBe('Give your USA tee a turn');
    expect(turnLine('  ')).toBe('Give this piece a turn');
    expect(turnLine(null)).toBe('Give this piece a turn');
  });

  it('speaks of pieces in the singular and the plural', () => {
    expect(piecesTitle(1)).toBe('1 piece in your wardrobe');
    expect(piecesTitle(9)).toBe('9 pieces in your wardrobe');
    expect(piecesProgress(1)).toBe('1 of 10 pieces');
    expect(nudgeLine(9)).toBe('Add 1 more and your picks get far more varied.');
  });

  it('has a short label for every occasion there is, everyday first', () => {
    expect(occasionPills.map((pill) => pill.value)).toEqual(occasionOptions.map((option) => option.value));
    expect(occasionPills[0]).toEqual({ value: 'everyday', label: 'Everyday' });
  });
});

describe('the words of the weather card', () => {
  it('greets by the hour', () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(greetingAt)).toEqual([
      'Good evening',
      'Good morning',
      'Good morning',
      'Good afternoon',
      'Good afternoon',
      'Good evening',
      'Good evening',
    ]);
  });

  it('labels the first hour "Now" and the others by the clock of the place, with a word when it is wet', () => {
    expect(
      hourSlots({
        hours: [
          { time: '2026-10-05T12:00:00+09:00', feels: 14, sky: 'cloud_sun' },
          { time: '2026-10-05T15:00:00+09:00', feels: 13, sky: 'rain' },
          { time: '2026-10-05T00:00:00+09:00', feels: -1, sky: 'snow' },
        ],
      }).map(({ label, value }) => [label, value]),
    ).toEqual([
      ['Now', '14°'],
      ['3 pm', '13° rain'],
      ['12 am', '−1° snow'],
    ]);
  });
});
