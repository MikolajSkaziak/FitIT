import type { Category } from '@/api/wardrobe';
import { lookOfClothes, lookOfStarters, pickFirstLook } from '@/features/onboarding/firstLook';
import { clothing, starterPiece } from '@/test/fixtures';

const piece = (name: string, category: Category | null) => ({ name, category });
const names = (pieces: readonly { name: string }[]) => pieces.map((entry) => entry.name);

describe('the first look, picked from what the person has', () => {
  it('takes a top, a bottom, shoes and a layer over them, in that order', () => {
    const picked = pickFirstLook([piece('coat', 'outerwear'), piece('sneakers', 'shoes'), piece('jeans', 'bottom'), piece('tee', 'top'), piece('scarf', 'accessory')]);

    expect(names(picked)).toEqual(['tee', 'jeans', 'sneakers', 'coat']);
  });

  it('takes the first of several pieces in one role, so the same pieces always give the same look', () => {
    const pieces = [piece('tee', 'top'), piece('shirt', 'top'), piece('jeans', 'bottom'), piece('chinos', 'bottom'), piece('boots', 'shoes'), piece('sneakers', 'shoes')];

    expect(names(pickFirstLook(pieces))).toEqual(['tee', 'jeans', 'boots']);
    expect(pickFirstLook(pieces)).toEqual(pickFirstLook(pieces));
  });

  it('wears a sweater as the top when there is no shirt, and over the shirt when there is one', () => {
    expect(names(pickFirstLook([piece('sweater', 'mid_layer'), piece('jeans', 'bottom')]))).toEqual(['sweater', 'jeans']);
    expect(names(pickFirstLook([piece('sweater', 'mid_layer'), piece('tee', 'top'), piece('jeans', 'bottom')]))).toEqual(['tee', 'jeans', 'sweater']);
    // A coat is the outer layer whenever there is one.
    expect(names(pickFirstLook([piece('sweater', 'mid_layer'), piece('tee', 'top'), piece('jeans', 'bottom'), piece('coat', 'outerwear')]))).toEqual(['tee', 'jeans', 'coat']);
  });

  it('builds around a one-piece when top and bottom do not make a pair', () => {
    expect(names(pickFirstLook([piece('dress', 'one_piece'), piece('boots', 'shoes'), piece('tee', 'top')]))).toEqual(['dress', 'boots']);
    expect(names(pickFirstLook([piece('dress', 'one_piece'), piece('tee', 'top'), piece('jeans', 'bottom')]))).toEqual(['tee', 'jeans']);
  });

  it('counts a dress as a whole look: it needs shoes or a layer and no top and bottom', () => {
    expect(names(pickFirstLook([piece('dress', 'one_piece'), piece('flats', 'shoes')]))).toEqual(['dress', 'flats']);
    expect(names(pickFirstLook([piece('dress', 'one_piece'), piece('trench', 'outerwear')]))).toEqual(['dress', 'trench']);
  });

  it('puts a cardigan over a dress, but wears it as the top when there is a bottom and no shirt', () => {
    expect(names(pickFirstLook([piece('cardigan', 'mid_layer'), piece('dress', 'one_piece'), piece('boots', 'shoes')]))).toEqual(['dress', 'boots', 'cardigan']);
    expect(names(pickFirstLook([piece('cardigan', 'mid_layer'), piece('dress', 'one_piece'), piece('skirt', 'bottom')]))).toEqual(['cardigan', 'skirt']);
  });

  it('takes a skirt as the bottom, heeled boots and flats as shoes, and leaves a bag or a belt out', () => {
    const pieces = [piece('bag', 'accessory'), piece('belt', 'accessory'), piece('blouse', 'top'), piece('skirt', 'bottom'), piece('flats', 'shoes'), piece('ankle boots', 'shoes')];

    expect(names(pickFirstLook(pieces))).toEqual(['blouse', 'skirt', 'flats']);
  });

  it('is empty for a bag and a belt, which are never a look on their own', () => {
    expect(pickFirstLook([piece('bag', 'accessory'), piece('belt', 'accessory')])).toEqual([]);
  });

  it.each([
    ['nothing', []],
    ['one piece', [piece('tee', 'top')]],
    ['three tops', [piece('tee', 'top'), piece('shirt', 'top'), piece('polo', 'top')]],
    ['only accessories', [piece('scarf', 'accessory'), piece('belt', 'accessory')]],
    ['garments still being described', [piece('a', null), piece('b', null)]],
  ])('is empty when there are fewer than two usable pieces: %s', (_name, pieces) => {
    expect(pickFirstLook(pieces)).toEqual([]);
  });

  it('adds nothing the person did not pick', () => {
    const pieces = [piece('tee', 'top'), piece('sneakers', 'shoes')];

    expect(names(pickFirstLook(pieces))).toEqual(['tee', 'sneakers']);
  });
});

describe('the look, ready for the board', () => {
  it('turns ticked common pieces into ready garments, named and cached like the tiles they were ticked on, with nothing made up', () => {
    const starters = [
      starterPiece('white_tshirt', 'White T-shirt', 'top'),
      starterPiece('blue_jeans', 'Blue jeans', 'bottom', { type: 'jeans', group: 'jeans', colors: ['blue'] }),
    ];

    const look = lookOfStarters(starters);

    expect(look.map((item) => item.slot)).toEqual(['top', 'bottom']);
    expect(look[0]?.clothing).toMatchObject({
      id: 'white_tshirt',
      status: 'ready',
      name: 'White T-shirt',
      category: 'top',
      group: 't_shirts_and_tops',
      subcategory: 't_shirt',
      colors: ['white'],
      imageUrl: 'http://api.test/starter/white_tshirt.png',
      imageKey: 'starter-white_tshirt',
      material: null,
      warmth: null,
      styles: [],
      wearCount: 0,
    });
  });

  it('lays a ticked dress on the board as the whole body, with a layer over it', () => {
    const look = lookOfStarters([
      starterPiece('burgundy_cardigan', 'Burgundy cardigan', 'mid_layer', { type: 'cardigan', group: 'sweaters_and_hoodies', audience: 'women' }),
      starterPiece('little_black_dress', 'Little black dress', 'one_piece', { type: 'dress', group: 'dresses_and_jumpsuits', audience: 'women' }),
      starterPiece('black_ankle_boots', 'Black heeled ankle boots', 'shoes', { type: 'boots', group: 'shoes', audience: 'women' }),
    ]);

    expect(look.map((item) => [item.slot, item.clothing.id, item.clothing.group])).toEqual([
      ['one_piece', 'little_black_dress', 'dresses_and_jumpsuits'],
      ['shoes', 'black_ankle_boots', 'shoes'],
      ['mid_layer', 'burgundy_cardigan', 'sweaters_and_hoodies'],
    ]);
  });

  it('gives garments of the wardrobe the role of their category', () => {
    const look = lookOfClothes([clothing('g1', 'Navy shirt', 'top'), clothing('g2', 'Beige chinos', 'bottom')]);

    expect(look.map((item) => [item.slot, item.clothing.id])).toEqual([['top', 'g1'], ['bottom', 'g2']]);
  });
});
