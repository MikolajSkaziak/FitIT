import { defaultFigure, figureAspect, figureFor, figureLayout, figures, marksOf, type Figure, type FigureItem, type FigureLayer } from '../figure';

const piece = (id: string, slot: FigureItem['slot'], type?: FigureItem['type'], aspect?: number): FigureItem => ({ id, slot, type, aspect });

const layerOf = (layers: readonly FigureLayer[], id: string): FigureLayer => {
  const found = layers.find((layer) => layer.id === id);
  if (!found) {
    throw new Error(`no layer ${id}`);
  }

  return found;
};

const bottomOf = (layer: FigureLayer) => layer.rect.y + layer.rect.height;

const centerOf = (layer: FigureLayer) => layer.rect.x + layer.rect.width / 2;

/** How much wider than its own shape the picture is drawn: 1 is undistorted. */
const stretchOf = (layer: FigureLayer, aspect: number) => (layer.rect.width * figureAspect) / layer.rect.height / aspect;

const base: FigureItem[] = [piece('top', 'top', 't_shirt', 1.08), piece('bottom', 'bottom', 'jeans', 0.48), piece('shoes', 'shoes', 'sneakers', 1.87)];

const everyFigure = Object.entries(figures) as [string, Figure][];

describe('the figures', () => {
  it('knows the ten silhouettes by body type and falls back to one of them', () => {
    expect(Object.keys(figures)).toHaveLength(10);
    expect(figureFor('trapezoid')).toBe(figures.trapezoid);
    expect(figureFor('unheard_of')).toBe(defaultFigure);
    expect(figureFor(null)).toBe(defaultFigure);
    expect(figureFor('toString')).toBe(defaultFigure);
  });

  it.each(everyFigure)('puts the lines of %s in the order of a body', (_, figure) => {
    const marks = marksOf(figure);
    const lines = [marks.headTop, marks.eyes, marks.collar, marks.waistband, marks.hem, marks.crotch, marks.knees, marks.ankles, marks.ground];

    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
    expect(marks.ground).toBeLessThan(1);
  });
});

describe('figureLayout', () => {
  it.each(everyFigure)('dresses %s: trousers from the waistband to the ankles, the top from the collar to the hips, shoes on the ground', (_, figure) => {
    const { layers, marks } = figureLayout(base, figure);
    const top = layerOf(layers, 'top');
    const bottom = layerOf(layers, 'bottom');
    const shoes = layerOf(layers, 'shoes');

    expect(top.rect.y).toBeCloseTo(marks.collar, 5);
    expect(bottomOf(top)).toBeCloseTo(marks.hem, 5);
    // The waistband is below the natural waist and above the hips, and the trousers reach the ankles: nearly half the picture.
    expect(bottom.rect.y).toBeCloseTo(marks.waistband, 5);
    expect(bottom.rect.y).toBeLessThan(marks.crotch - 0.05);
    expect(bottomOf(bottom)).toBeCloseTo(marks.ankles, 5);
    expect(bottom.rect.height).toBeGreaterThan(0.4);
    // Wide enough to cover the hips and both legs, not wider than the shoulders of the top.
    expect(bottom.rect.width).toBeGreaterThanOrEqual(figure.hipWidth);
    expect(bottom.rect.width).toBeLessThan(top.rect.width);
    expect(top.rect.width).toBeGreaterThan(figure.shoulderWidth);
    // The shoes stand on the ground line, about as wide as the feet, and are no banner.
    expect(bottomOf(shoes)).toBeGreaterThan(marks.ground);
    expect(bottomOf(shoes)).toBeLessThan(marks.ground + 0.02);
    expect(shoes.rect.width).toBeGreaterThanOrEqual(figure.feetWidth);
    expect(shoes.rect.width).toBeLessThan(figure.feetWidth + 0.05);
    expect(shoes.rect.height).toBeLessThan(0.13);
    for (const layer of layers) {
      expect(centerOf(layer)).toBeCloseTo(figure.centerX, 5);
      expect(layer.rect.x).toBeGreaterThanOrEqual(0);
      expect(layer.rect.x + layer.rect.width).toBeLessThanOrEqual(1);
      expect(bottomOf(layer)).toBeLessThanOrEqual(1);
    }
  });

  it('draws the shoes first, the trousers over them and the top untucked over the waistband', () => {
    const { layers } = figureLayout(base);

    expect(layers.map((layer) => layer.id)).toEqual(['shoes', 'bottom', 'top']);
    expect(layerOf(layers, 'bottom').rect.y).toBeLessThan(bottomOf(layerOf(layers, 'top')));
    expect(layerOf(layers, 'shoes').rect.y).toBeLessThan(bottomOf(layerOf(layers, 'bottom')));
  });

  it('never distorts a picture by more than the give, and not at all when it fits the body as it is', () => {
    const fits = layerOf(figureLayout([piece('top', 'top', 't_shirt', 1.08)], figures.hourglass).layers, 'top');
    const narrow = layerOf(figureLayout([piece('top', 'top', 'tank_top', 0.5)], figures.trapezoid).layers, 'top');
    const wide = layerOf(figureLayout([piece('top', 'top', 'shirt', 3)], figures.hourglass).layers, 'top');

    expect(stretchOf(fits, 1.08)).toBeCloseTo(1, 5);
    expect(stretchOf(narrow, 0.5)).toBeCloseTo(1.18, 5);
    expect(stretchOf(wide, 3)).toBeCloseTo(1 / 1.18, 5);
  });

  it('is near its place before the picture has loaded, and the same height after', () => {
    const before = layerOf(figureLayout([piece('bottom', 'bottom', 'jeans')]).layers, 'bottom');
    const after = layerOf(figureLayout([piece('bottom', 'bottom', 'jeans', 0.48)]).layers, 'bottom');

    expect(before.rect.y).toBe(after.rect.y);
    expect(before.rect.height).toBe(after.rect.height);
  });

  it('puts a mid layer over the top, a little longer, and shows of the top only the column of the body', () => {
    const { layers } = figureLayout([...base, piece('mid', 'mid_layer', 'sweater', 0.96)]);
    const mid = layerOf(layers, 'mid');
    const top = layerOf(layers, 'top');

    expect(layers.indexOf(mid)).toBeGreaterThan(layers.indexOf(top));
    expect(bottomOf(mid)).toBeGreaterThan(bottomOf(top));
    expect(mid.clip).toBeNull();
    expect(top.clip).not.toBeNull();
  });

  it('lets nothing stick out sideways from under a coat: a covered layer shows only inside the shoulders', () => {
    const figure = figures.trapezoid;
    const { layers } = figureLayout([...base, piece('mid', 'mid_layer', 'hoodie', 0.98), piece('outer', 'outerwear', 'coat', 0.69)], figure);
    const outer = layerOf(layers, 'outer');

    expect(layers[layers.length - 1]).toBe(outer);
    expect(outer.clip).toBeNull();
    for (const id of ['top', 'mid']) {
      const { clip, rect } = layerOf(layers, id);
      expect(clip).not.toBeNull();
      expect(clip!.width).toBeLessThan(figure.shoulderWidth);
      expect(clip!.width).toBeLessThan(rect.width / 2);
      expect(clip!.x + clip!.width / 2).toBeCloseTo(figure.centerX, 5);
      expect(clip!.x).toBeGreaterThan(outer.rect.x);
      expect(clip!.x + clip!.width).toBeLessThan(outer.rect.x + outer.rect.width);
    }

    expect(layerOf(layers, 'bottom').clip).toBeNull();
    expect(layerOf(layers, 'shoes').clip).toBeNull();
  });

  it('ends a jacket at the hips and a coat above the knees, the widest layer of all', () => {
    const jacket = figureLayout([...base, piece('mid', 'mid_layer', 'hoodie', 0.98), piece('outer', 'outerwear', 'jacket', 1.04)]);
    const coat = figureLayout([...base, piece('outer', 'outerwear', 'coat', 0.69)]);
    const short = layerOf(jacket.layers, 'outer');
    const long = layerOf(coat.layers, 'outer');

    expect(short.rect.width).toBeGreaterThan(layerOf(jacket.layers, 'mid').rect.width);
    expect(bottomOf(short)).toBeGreaterThan(jacket.marks.hem);
    expect(bottomOf(short)).toBeLessThan(jacket.marks.crotch + 0.05);
    expect(bottomOf(long)).toBeGreaterThan(coat.marks.crotch + 0.1);
    expect(bottomOf(long)).toBeLessThan(coat.marks.knees);
    expect(long.rect.y).toBeLessThan(coat.marks.collar);
  });

  it('makes a blazer and a suit jacket longer than a sweater, and a track jacket like a sweater', () => {
    const end = (type: FigureItem['type']) => bottomOf(layerOf(figureLayout([piece('mid', 'mid_layer', type, 0.9)]).layers, 'mid'));

    expect(end('suit_jacket')).toBe(end('blazer'));
    expect(end('blazer')).toBeGreaterThan(end('sweater'));
    expect(end('track_jacket')).toBe(end('sweater'));
  });

  it('lays a dress out from the collar to just below the knee, and a jumpsuit and a tracksuit to the ankles', () => {
    const dress = figureLayout([piece('one', 'one_piece', 'dress', 0.5), piece('shoes', 'shoes', 'flats', 1.6)]);
    const one = layerOf(dress.layers, 'one');

    expect(one.rect.y).toBeCloseTo(dress.marks.collar, 5);
    expect(bottomOf(one)).toBeCloseTo(dress.marks.knees + 0.02, 5);
    expect(one.rect.width).toBeGreaterThanOrEqual(defaultFigure.hipWidth);
    for (const type of ['jumpsuit', 'tracksuit'] as const) {
      const suit = figureLayout([piece('one', 'one_piece', type, 0.45)]);
      expect(bottomOf(layerOf(suit.layers, 'one'))).toBeCloseTo(suit.marks.ankles, 5);
    }
  });

  it('ends shorts at mid-thigh and a skirt at the knee, both from the waistband', () => {
    const shorts = figureLayout([piece('bottom', 'bottom', 'shorts', 1.07)]);
    const skirt = figureLayout([piece('bottom', 'bottom', 'skirt', 0.9)]);
    const end = bottomOf(layerOf(shorts.layers, 'bottom'));

    expect(layerOf(shorts.layers, 'bottom').rect.y).toBeCloseTo(shorts.marks.waistband, 5);
    expect(end).toBeGreaterThan(shorts.marks.crotch + 0.08);
    expect(end).toBeLessThan(shorts.marks.knees);
    expect(bottomOf(layerOf(skirt.layers, 'bottom'))).toBeCloseTo(skirt.marks.knees, 5);
  });

  it('places accessories where they are worn, or beside the figure', () => {
    const items = [
      piece('hat', 'accessory', 'hat', 1.2),
      piece('glasses', 'accessory', 'sunglasses', 2.6),
      piece('scarf', 'accessory', 'scarf', 1),
      piece('tie', 'accessory', 'tie', 0.2),
      piece('belt', 'accessory', 'belt', 6),
      piece('bag', 'accessory', 'bag', 0.9),
      piece('backpack', 'accessory', 'backpack', 0.8),
      piece('gloves', 'accessory', 'gloves', 1),
    ];
    const figure = figures.rectangle;
    const { layers, marks } = figureLayout([...base, ...items], figure);
    const at = (id: string) => layerOf(layers, id);

    expect(at('hat').rect.y).toBeLessThan(marks.headTop);
    expect(bottomOf(at('hat'))).toBeLessThan(marks.eyes);
    expect(at('glasses').rect.y).toBeLessThan(marks.eyes);
    expect(bottomOf(at('glasses'))).toBeGreaterThan(marks.eyes);
    expect(at('glasses').rect.width).toBeLessThan(0.1);
    expect(at('scarf').rect.y).toBeLessThan(marks.collar);
    expect(bottomOf(at('scarf'))).toBeGreaterThan(marks.collar);
    expect(at('tie').rect.y).toBeGreaterThan(marks.collar);
    expect(bottomOf(at('tie'))).toBeLessThanOrEqual(marks.waistband + 1e-9);
    expect(at('belt').rect.y).toBeLessThan(marks.waistband + 0.012);
    expect(bottomOf(at('belt'))).toBeGreaterThan(marks.waistband + 0.012);
    expect(layers.indexOf(at('belt'))).toBeGreaterThan(layers.indexOf(at('top')));
    // The bag hangs from the hand, outside the body on one side; the backpack is on the other.
    expect(at('bag').rect.x).toBeGreaterThan(figure.centerX + figure.shoulderWidth / 2 - 0.02);
    expect(at('bag').rect.y).toBeGreaterThan(marks.crotch);
    expect(at('backpack').rect.x + at('backpack').rect.width).toBeLessThan(figure.centerX - figure.shoulderWidth / 2 + 0.02);
    expect(at('gloves').rect.x + at('gloves').rect.width).toBeLessThan(0.3);
    for (const { id } of items) {
      const { x, y, width, height } = at(id).rect;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(1 + 1e-9);
      expect(y + height).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('keeps loose accessories apart, down both sides', () => {
    const { layers } = figureLayout([piece('a', 'accessory', 'gloves', 1), piece('b', 'accessory', 'gloves', 1), piece('c', 'accessory', 'gloves', 1)]);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => layerOf(layers, id).rect);

    expect(a.x + a.width).toBeLessThan(b.x);
    expect(c.y).toBeGreaterThanOrEqual(a.y + a.height);
  });

  it('is empty for no garments', () => {
    expect(figureLayout([]).layers).toEqual([]);
  });
});
