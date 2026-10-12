import type { Category } from '@/api/wardrobe';

import {
  arrangedBoard,
  boardGap,
  boardInset,
  boardLayout,
  boardSize,
  edgeResistance,
  edgeStretch,
  frameOf,
  frontOf,
  inReadingOrder,
  keptInside,
  maxScale,
  minScale,
  pulled,
  resized,
  resisted,
  aspectOf,
  storedForm,
  type BoardItem,
  type BoardSize,
  type Frame,
  type Placement,
} from '../board';

const piece = (id: string, slot: BoardItem['slot'], type?: BoardItem['type'], aspect?: number): BoardItem => ({ id, slot, type, aspect });

const tee = piece('tee', 'top', 't_shirt', 1.08);
const jeans = piece('jeans', 'bottom', 'jeans', 0.48);
const sneakers = piece('sneakers', 'shoes', 'sneakers', 1.87);
const coat = piece('coat', 'outerwear', 'coat', 0.68);
const sweater = piece('sweater', 'mid_layer', 'sweater', 1.02);
const dress = piece('dress', 'one_piece', 'dress', 0.46);
const bag = piece('bag', 'accessory', 'bag', 0.9);
const hat = piece('hat', 'accessory', 'hat', 1.3);
const belt = piece('belt', 'accessory', 'belt', 5.5);

/** The boards of the app: the builder's hero, a proposal, an outfit's page, a card on Today. */
const boards: BoardSize[] = [boardSize(244), boardSize(247), boardSize(275), boardSize(292), boardSize(351)];
const board = boardSize(275);

const framesOf = (items: readonly BoardItem[], size: BoardSize, placements: readonly Placement[] = boardLayout(items, size)): Map<string, Frame> =>
  new Map(placements.map((placement) => [placement.clothingId, frameOf(placement, aspectOf(items.find((item) => item.id === placement.clothingId)!), size)]));

const frameIn = (frames: Map<string, Frame>, id: string): Frame => {
  const found = frames.get(id);
  if (!found) {
    throw new Error(`no garment ${id}`);
  }

  return found;
};

/** How far apart two rectangles are: the larger of the gaps along the two axes, negative when they overlap. */
const apart = (a: Frame, b: Frame): number =>
  Math.max(a.left - (b.left + b.width), b.left - (a.left + a.width), a.top - (b.top + b.height), b.top - (a.top + a.height));

const centerX = (frame: Frame) => frame.left + frame.width / 2;
const bottomOf = (frame: Frame) => frame.top + frame.height;

/** A small repeatable generator, so a failing outfit can be found again. */
function randomOf(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const kinds: { slot: BoardItem['slot']; types: BoardItem['type'][]; aspects: [number, number] }[] = [
  { slot: 'top', types: ['t_shirt', 'shirt', 'tank_top', null], aspects: [0.6, 1.5] },
  { slot: 'mid_layer', types: ['sweater', 'blazer', 'vest'], aspects: [0.7, 1.4] },
  { slot: 'outerwear', types: ['coat', 'parka', 'jacket', 'denim_jacket'], aspects: [0.5, 1.3] },
  { slot: 'bottom', types: ['jeans', 'shorts', 'skirt', 'trousers'], aspects: [0.3, 1.4] },
  { slot: 'one_piece', types: ['dress', 'jumpsuit'], aspects: [0.3, 0.9] },
  { slot: 'shoes', types: ['sneakers', 'boots', 'heels'], aspects: [0.8, 2.4] },
  { slot: 'accessory', types: ['bag', 'backpack', 'hat', 'scarf', 'belt', 'tie', 'sunglasses', 'gloves', null], aspects: [0.2, 6] },
];

/** One to nine garments of any roles, some of them twice, some with a picture whose shape is not known yet. */
function randomOutfit(random: () => number): BoardItem[] {
  const count = 1 + Math.floor(random() * 9);
  return Array.from({ length: count }, (_, index) => {
    const kind = kinds[Math.floor(random() * kinds.length)];
    const [narrow, wide] = kind.aspects;
    return piece(`p${index}`, kind.slot, kind.types[Math.floor(random() * kind.types.length)], random() < 0.2 ? undefined : narrow + random() * (wide - narrow));
  });
}

function expectTidy(items: readonly BoardItem[], size: BoardSize) {
  const placements = boardLayout(items, size);
  expect(placements.map((placement) => placement.clothingId)).toEqual(items.map((item) => item.id));
  const frames = [...framesOf(items, size, placements).values()];
  for (const frame of frames) {
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.left).toBeGreaterThanOrEqual(boardInset - 1e-6);
    expect(frame.top).toBeGreaterThanOrEqual(boardInset - 1e-6);
    expect(frame.left + frame.width).toBeLessThanOrEqual(size.width - boardInset + 1e-6);
    expect(frame.top + frame.height).toBeLessThanOrEqual(size.height - boardInset + 1e-6);
  }

  for (let first = 0; first < frames.length; first += 1) {
    for (let second = first + 1; second < frames.length; second += 1) {
      expect(apart(frames[first], frames[second])).toBeGreaterThanOrEqual(boardGap - 1e-6);
    }
  }
}

describe('boardLayout', () => {
  it('keeps at least eight points between garments', () => {
    expect(boardGap).toBeGreaterThanOrEqual(8);
    expect(boardInset).toBeGreaterThanOrEqual(16);
  });

  const outfits: [string, BoardItem[]][] = [
    ['one garment', [tee]],
    ['a top and a bottom', [tee, jeans]],
    ['the usual three', [tee, jeans, sneakers]],
    ['a coat over them', [tee, coat, jeans, sneakers]],
    ['every layer and a bag', [tee, sweater, coat, jeans, sneakers, bag]],
    ['a dress alone', [dress]],
    ['a dress, shoes and a bag', [dress, sneakers, bag]],
    ['a dress under a coat', [dress, coat, sneakers, hat]],
    ['two tops', [tee, piece('shirt', 'top', 'shirt', 0.95), jeans, sneakers]],
    ['no top at all', [sweater, jeans, sneakers]],
    ['eight garments', [tee, sweater, coat, jeans, sneakers, bag, hat, belt]],
    ['small things only', [bag, hat, belt]],
  ];

  it.each(outfits)('lays out %s with nothing touching and everything on the board', (_, items) => {
    for (const size of boards) {
      expectTidy(items, size);
    }
  });

  it('holds for any mix of garments, whatever the shapes of their pictures', () => {
    const random = randomOf(20261010);
    for (let run = 0; run < 400; run += 1) {
      expectTidy(randomOutfit(random), boards[run % boards.length]);
    }
  });

  it('reads in body order: the top over the bottom, the shoes at the foot', () => {
    const frames = framesOf([sneakers, jeans, tee], board);
    const [top, bottom, shoes] = [frameIn(frames, 'tee'), frameIn(frames, 'jeans'), frameIn(frames, 'sneakers')];

    expect(bottomOf(top)).toBeLessThan(bottom.top);
    expect(centerX(top)).toBeCloseTo(centerX(bottom), 5);
    expect(bottomOf(shoes)).toBeCloseTo(Math.max(...[...frames.values()].map(bottomOf)), 5);
    expect(shoes.top).toBeGreaterThan(bottomOf(top));
  });

  it('lays the outer layer beside the top, not over it, and the bottom under the top', () => {
    const frames = framesOf([tee, coat, jeans, sneakers], board);
    const [top, outer, bottom] = [frameIn(frames, 'tee'), frameIn(frames, 'coat'), frameIn(frames, 'jeans')];

    expect(outer.left).toBeGreaterThan(top.left + top.width);
    expect(outer.top).toBeCloseTo(top.top, 5);
    expect(bottom.top).toBeGreaterThan(bottomOf(top));
    expect(centerX(bottom)).toBeCloseTo(centerX(top), 5);
  });

  it('keeps real proportions: a coat larger than a tee, shoes and a bag small', () => {
    const frames = framesOf([tee, coat, jeans, sneakers, bag], board);
    const area = (id: string) => frameIn(frames, id).width * frameIn(frames, id).height;

    expect(area('coat')).toBeGreaterThan(area('tee'));
    expect(frameIn(frames, 'jeans').height).toBeGreaterThan(frameIn(frames, 'tee').height);
    expect(area('sneakers')).toBeLessThan(area('tee') / 3);
    expect(area('bag')).toBeLessThan(area('tee') / 2);
  });

  it('puts the bag and the small things beside the garments, in the corners that are left', () => {
    const frames = framesOf([dress, sneakers, bag], board);
    const [body, small] = [frameIn(frames, 'dress'), frameIn(frames, 'bag')];

    expect(small.left > body.left + body.width || small.left + small.width < body.left).toBe(true);
    expect(bottomOf(small)).toBeCloseTo(Math.max(...[...frames.values()].map(bottomOf)), 5);
  });

  it('draws a dress with no top or bottom as the garment the outfit is built around', () => {
    const frames = framesOf([dress, sneakers], board);

    expect(frameIn(frames, 'dress').height).toBeGreaterThan(board.height / 2);
    expect(frameIn(frames, 'dress').height).toBeLessThanOrEqual(0.8 * board.height + 1e-6);
  });

  it('scales the whole outfit down together when there is more of it', () => {
    const few = framesOf([tee, jeans, sneakers], board);
    const many = framesOf([tee, sweater, coat, jeans, sneakers, bag, hat, belt], board);

    expect(frameIn(many, 'tee').width).toBeLessThan(frameIn(few, 'tee').width);
    expect(frameIn(many, 'tee').width / frameIn(many, 'jeans').height).toBeCloseTo(frameIn(few, 'tee').width / frameIn(few, 'jeans').height, 5);
  });

  it('gives the same answer on a board of any size, apart from the points kept free', () => {
    const small = boardLayout([tee, coat, jeans, sneakers], boardSize(244));
    const large = boardLayout([tee, coat, jeans, sneakers], boardSize(351));

    small.forEach((placement, index) => {
      expect(placement.x).toBeCloseTo(large[index].x, 1);
      expect(placement.y).toBeCloseTo(large[index].y, 1);
    });
  });

  it('uses a usual shape for a garment whose picture has not loaded, and re-lays it once it has', () => {
    const waiting = boardLayout([piece('jeans', 'bottom', 'jeans')], board)[0];
    const loaded = boardLayout([piece('jeans', 'bottom', 'jeans', 1.2)], board)[0];

    expect(aspectOf(piece('jeans', 'bottom', 'jeans'))).toBe(0.5);
    expect(loaded.scale).toBeGreaterThan(waiting.scale);
  });

  it('has nothing to lay out for an empty outfit', () => {
    expect(boardLayout([], board)).toEqual([]);
  });
});

describe('a person’s own arrangement', () => {
  const items = [tee, jeans, sneakers];
  const own: Placement[] = [
    { clothingId: 'tee', x: 0.3, y: 0.3, scale: 0.5, z: 4 },
    { clothingId: 'jeans', x: 0.35, y: 0.4, scale: 0.3, z: 7 },
  ];

  it('is used as it is, overlaps and all, and a garment it does not name keeps its automatic place, on top', () => {
    const shown = arrangedBoard(boardLayout(items, board), own);
    const automatic = boardLayout(items, board);

    expect(shown.slice(0, 2)).toEqual(own);
    expect(shown[2]).toEqual({ ...automatic[2], z: 8 + automatic[2].z });
  });

  it('is the automatic layout when there is none, and forgets garments that left the outfit', () => {
    expect(arrangedBoard(boardLayout(items, board), null)).toEqual(boardLayout(items, board));
    expect(arrangedBoard(boardLayout(items, board), [])).toEqual(boardLayout(items, board));
    expect(arrangedBoard(boardLayout([tee], board), [...own, { clothingId: 'gone', x: 0.5, y: 0.5, scale: 0.2, z: 9 }])).toEqual([own[0]]);
  });

  it('is stored with stacking orders counted from zero and coarse numbers', () => {
    expect(storedForm([{ clothingId: 'a', x: 0.123456, y: 1.2, scale: 0.333333, z: 12 }, { clothingId: 'b', x: 0.5, y: 0.5, scale: 0.01, z: 3 }])).toEqual([
      { clothingId: 'a', x: 0.1235, y: 1, scale: 0.3333, z: 1 },
      { clothingId: 'b', x: 0.5, y: 0.5, scale: 0.05, z: 0 },
    ]);
    expect(frontOf(own)).toBe(8);
    expect(frontOf([])).toBe(0);
  });
});

describe('moving and resizing', () => {
  it('keeps the whole garment on the board', () => {
    expect(keptInside({ x: -0.2, y: 1.4, scale: 0.4 }, 1)).toEqual({ x: 0.2, y: 1 - (0.4 * 0.75) / 2, scale: 0.4 });
    expect(keptInside({ x: 0.5, y: 0.5, scale: 0.4 }, 1)).toEqual({ x: 0.5, y: 0.5, scale: 0.4 });
  });

  it('resizes between 12% and 80% of the board’s width, and never taller than the board', () => {
    expect(resized({ x: 0.5, y: 0.5, scale: 0.4 }, 10, 1).scale).toBe(maxScale);
    expect(resized({ x: 0.5, y: 0.5, scale: 0.4 }, 0.01, 1).scale).toBe(minScale);
    // Trousers half as wide as tall fill the height of the board before they reach 80% of its width.
    expect(resized({ x: 0.5, y: 0.5, scale: 0.3 }, 10, 0.5)).toEqual({ x: 0.5, y: 0.5, scale: 0.5 / 0.75 });
  });

  it('pushes a garment that grows at the edge back onto the board', () => {
    const grown = resized({ x: 0.1, y: 0.1, scale: 0.2 }, 2, 1);

    expect(grown.scale).toBeCloseTo(0.4, 5);
    expect(grown.x).toBeCloseTo(0.2, 5);
    expect(grown.y).toBeCloseTo(0.15, 5);
  });
});

describe('inReadingOrder', () => {
  const of = (...slots: Category[]) => slots.map((slot, index) => ({ slot, index }));

  it('goes from head to toe, with accessories among what is worn on top', () => {
    const ordered = inReadingOrder(of('shoes', 'bottom', 'accessory', 'outerwear', 'top'));

    expect(ordered.map((item) => item.slot)).toEqual(['top', 'outerwear', 'accessory', 'bottom', 'shoes']);
  });

  it('puts a one-piece garment first, because it is the whole outfit', () => {
    const ordered = inReadingOrder(of('shoes', 'outerwear', 'one_piece'));

    expect(ordered.map((item) => item.slot)).toEqual(['one_piece', 'outerwear', 'shoes']);
  });

  it('keeps garments of one role in the order they came in', () => {
    const ordered = inReadingOrder(of('accessory', 'top', 'accessory', 'shoes', 'bottom', 'accessory'));

    expect(ordered.filter((item) => item.slot === 'accessory').map((item) => item.index)).toEqual([0, 2, 5]);
  });

  it('lays out a seven-piece outfit with every role in its place', () => {
    const ordered = inReadingOrder(of('shoes', 'accessory', 'bottom', 'outerwear', 'mid_layer', 'accessory', 'top'));

    expect(ordered.map((item) => item.slot)).toEqual(['top', 'mid_layer', 'outerwear', 'accessory', 'accessory', 'bottom', 'shoes']);
  });
});

describe('holding a garment past the board’s edge', () => {
  const size = boardSize(300);
  const spot = { x: 0.5, y: 0.5, scale: 0.4 };

  it('follows the finger at a third of the way beyond the edge, on the side it went', () => {
    expect(resisted(10)).toBeCloseTo(3, 6);
    expect(resisted(-10)).toBeCloseTo(-3, 6);
    expect(resisted(0)).toBe(0);
  });

  it('never strays further than the cap, however far the finger goes', () => {
    expect(resisted(80)).toBe(edgeStretch);
    expect(resisted(5000)).toBe(edgeStretch);
    expect(resisted(-5000)).toBe(-edgeStretch);
    expect(edgeResistance).toBeCloseTo(0.3, 6);
  });

  it('keeps what is stored on the board, whatever is drawn past it', () => {
    const far = pulled({ ...spot, x: 1.4 }, 1, size, false);

    expect(far.kept).toEqual(keptInside({ ...spot, x: 1.4 }, 1));
    expect(far.kept.x).toBeCloseTo(0.8, 6);
    expect(far.outside).toBe(true);
    // 0.6 of the board's width past where it belongs, slowed and capped.
    expect(far.over).toEqual({ x: edgeStretch, y: 0 });
  });

  it('leans by the resisted part of a small step past the edge', () => {
    const near = pulled({ ...spot, x: 0.8 + 10 / size.width }, 1, size, false);

    expect(near.over.x).toBeCloseTo(3, 4);
    expect(near.over.y).toBe(0);
    expect(near.outside).toBe(true);
  });

  it('is plainly inside while the garment is on the board', () => {
    const inside = pulled({ ...spot, x: 0.6, y: 0.4 }, 1, size, false);

    expect(inside.kept).toEqual({ ...spot, x: 0.6, y: 0.4 });
    expect(inside.over).toEqual({ x: 0, y: 0 });
    expect(inside.outside).toBe(false);
  });

  it('holds hard at the edge under reduced motion, though the finger has still gone past it', () => {
    const far = pulled({ ...spot, y: -0.5 }, 1, size, true);

    expect(far.over).toEqual({ x: 0, y: 0 });
    expect(far.kept.y).toBeGreaterThan(0);
    expect(far.outside).toBe(true);
  });
});
