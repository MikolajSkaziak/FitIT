import type { Category, Subcategory } from '@/api/wardrobe';

/**
 * Where each garment of an outfit sits on the mannequin that `FigureView` draws. Pure geometry: no React, no pixels.
 *
 * The canvas is the picture of the figure itself, 3:4 (width : height): the person's own silhouette, standing, seen
 * from the front, on a transparent background. Every rectangle is in fractions of that picture, `x` and `width` of its
 * width, `y` and `height` of its height, so one layout fits any size.
 *
 * Each figure has a few measured landmarks (`figures`), and the lines garments hang from are derived from those
 * (`marksOf`): collar, waistband, hem, knees, ankles, ground. A garment's picture is cropped to the garment (the server
 * does that), so its rectangle is the garment's own: its height runs between two lines, its width follows from the
 * picture's shape, and when that would leave the body showing beside it, or make it far wider than the body, the
 * picture is stretched or squeezed by up to `give` to fit. `FigureView` fills the rectangle with the picture.
 *
 * Layering (z, low to high), one rule for every outfit:
 *
 *   shoes < bottom < top < one-piece < mid layer < outerwear < scarf < bag < hat   (the exact numbers are `depth`)
 *
 * Tops are worn untucked: the hem of the top covers the waistband, and trouser legs fall over the shoes. A top or a mid
 * layer that has another layer over it shows only in the column of the body (`clip`), which is what an open collar or
 * a longer hem lets through: the pictures are flat lays with the sleeves spread, and sleeves do not stick out from
 * under a coat.
 *
 * Clothing size and leg length are not drawn: the body is a photograph of the silhouette the person chose, and its
 * shape is theirs already.
 */
export const figureAspect = 3 / 4;

/** A garment as the layout needs it. `aspect` is the picture's width over its height, once it is known. */
export interface FigureItem {
  id: string;
  slot: Category;
  type?: Subcategory | null;
  aspect?: number | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigureLayer {
  id: string;
  role: Category;
  /** Where the whole picture goes. */
  rect: Rect;
  /** The only part of the canvas the picture shows in, or null when all of it shows. */
  clip: Rect | null;
  /** Higher is drawn later, in front. */
  z: number;
}

/** What was measured on one figure's picture, as fractions of it. */
export interface Figure {
  centerX: number;
  headTop: number;
  crotch: number;
  ground: number;
  shoulderWidth: number;
  hipWidth: number;
  /** From the outside of one foot to the outside of the other. */
  feetWidth: number;
}

const woman = { headTop: 0.084, crotch: 0.514, ground: 0.93, feetWidth: 0.132 } as const;

const man = { headTop: 0.0635, crotch: 0.535, ground: 0.945, feetWidth: 0.242 } as const;

/** The ten silhouettes by body type (the avatar's `bodyType`), measured from the pictures in `avatars/figure/`. */
export const figures = {
  hourglass: { ...woman, centerX: 0.4993, shoulderWidth: 0.2667, hipWidth: 0.2139 },
  pear: { ...woman, centerX: 0.4993, shoulderWidth: 0.2583, hipWidth: 0.2431 },
  apple: { ...woman, centerX: 0.4993, shoulderWidth: 0.2778, hipWidth: 0.2375 },
  column: { ...woman, centerX: 0.4993, shoulderWidth: 0.2667, hipWidth: 0.2056 },
  goblet: { ...woman, centerX: 0.5, shoulderWidth: 0.2806, hipWidth: 0.2083 },
  triangle: { ...man, centerX: 0.5, shoulderWidth: 0.3375, hipWidth: 0.2514 },
  inverted_triangle: { ...man, centerX: 0.5, shoulderWidth: 0.3458, hipWidth: 0.2194 },
  rectangle: { ...man, centerX: 0.5, shoulderWidth: 0.325, hipWidth: 0.2222 },
  oval: { ...man, centerX: 0.5, shoulderWidth: 0.3458, hipWidth: 0.2264 },
  trapezoid: { ...man, centerX: 0.5, shoulderWidth: 0.3264, hipWidth: 0.225 },
} as const satisfies Record<string, Figure>;

/** The figure garments are laid out for when the person's own is not known. */
export const defaultFigure: Figure = figures.hourglass;

export const figureFor = (bodyType: string | null | undefined): Figure =>
  bodyType && Object.hasOwn(figures, bodyType) ? figures[bodyType as keyof typeof figures] : defaultFigure;

/** The lines along the figure that garments hang from or stand on, as fractions of the picture's height. */
export interface Marks {
  headTop: number;
  eyes: number;
  /** The base of the neck: where a collar sits. */
  collar: number;
  /** Where trousers and skirts start: between the natural waist and the hips. */
  waistband: number;
  /** Where an untucked top ends: at the hips. */
  hem: number;
  crotch: number;
  knees: number;
  ankles: number;
  ground: number;
}

export const marksOf = (figure: Figure): Marks => {
  const height = figure.ground - figure.headTop;
  const legs = figure.ground - figure.crotch;
  const collar = figure.headTop + 0.143 * height;
  return {
    headTop: figure.headTop,
    eyes: figure.headTop + 0.05,
    collar,
    waistband: figure.crotch - 0.28 * (figure.crotch - collar),
    hem: figure.crotch - 0.005,
    crotch: figure.crotch,
    knees: figure.crotch + 0.46 * legs,
    ankles: figure.ground - 0.075 * legs,
    ground: figure.ground,
  };
};

/** How far a picture may be stretched or squeezed sideways to fit the body before it is left as it is. */
const give = 1.18;

/** The width of the head, the same on every figure. */
const headWidth = 0.097;

/** Half the column of the body, in shoulder widths, that a covered layer shows in. */
const column = 0.36;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** The width, in fractions of the canvas width, of a picture of this shape that is `height` of the canvas tall. */
const widthOf = (height: number, aspect: number): number => (height * aspect) / figureAspect;

const heightOf = (width: number, aspect: number): number => (width * figureAspect) / aspect;

/**
 * A garment that runs from `top` to `bottom`: as wide as its picture makes it, brought towards `min` and `max` by no
 * more than `give`.
 */
function hang(cx: number, top: number, bottom: number, aspect: number, min: number, max: number): Rect {
  const height = bottom - top;
  let width = widthOf(height, aspect);
  if (width < min) {
    width = Math.min(min, width * give);
  } else if (width > max) {
    width = Math.max(max, width / give);
  }

  return { x: cx - width / 2, y: top, width, height };
}

/** A small thing of a set width, as tall as its picture makes it but no taller than `tallest`, around a point or on a line. */
function put(cx: number, y: number, width: number, aspect: number, tallest: number, align: 'top' | 'center' | 'bottom'): Rect {
  let w = width;
  let h = heightOf(w, aspect);
  if (h > tallest) {
    w *= tallest / h;
    h = tallest;
  }

  const top = align === 'top' ? y : align === 'bottom' ? y - h : y - h / 2;
  return { x: clamp01(Math.min(cx - w / 2, 1 - w)), y: clamp01(Math.min(top, 1 - h)), width: w, height: h };
}

/** The shape a picture is taken to have until it has loaded, so the garment is near its place from the first frame. */
const usualAspect = (slot: Category, type: Subcategory | null | undefined): number => {
  switch (slot) {
    case 'top':
      return 1;
    case 'mid_layer':
      return 0.95;
    case 'outerwear':
      return isLong(type) ? 0.7 : 1;
    case 'bottom':
      return type === 'shorts' ? 1.1 : type === 'skirt' ? 0.9 : 0.5;
    case 'one_piece':
      return 0.5;
    case 'shoes':
      return 1.6;
    default:
      return 1;
  }
};

const isLong = (type: Subcategory | null | undefined): boolean => type === 'coat' || type === 'trench_coat' || type === 'parka' || type === 'raincoat';

const midEnd = (type: Subcategory | null | undefined, marks: Marks): number => {
  switch (type) {
    case 'cardigan':
    case 'blazer':
    case 'suit_jacket':
      return marks.hem + 0.04;
    case 'vest':
      return marks.hem;
    default:
      return marks.hem + 0.015;
  }
};

const outerEnd = (type: Subcategory | null | undefined, marks: Marks): number => {
  switch (type) {
    case 'coat':
    case 'trench_coat':
    case 'parka':
      return marks.knees - 0.03;
    case 'raincoat':
      return marks.knees - 0.06;
    case 'jacket':
    case 'bomber_jacket':
    case 'denim_jacket':
    case 'leather_jacket':
      return marks.hem + 0.025;
    default:
      return marks.hem + 0.05;
  }
};

const bottomEnd = (type: Subcategory | null | undefined, marks: Marks): number => {
  switch (type) {
    case 'shorts':
      return marks.crotch + 0.3 * (marks.ground - marks.crotch);
    case 'skirt':
      return marks.knees;
    default:
      return marks.ankles;
  }
};

const onePieceEnd = (type: Subcategory | null | undefined, marks: Marks): number => (type === 'jumpsuit' || type === 'tracksuit' ? marks.ankles : marks.knees + 0.02);

/** Draw order. Between neighbours there is room for the accessories that belong between them. */
const depth = { shoes: 5, bottom: 10, top: 20, belt: 21, tie: 22, onePiece: 25, mid: 30, outer: 40, scarf: 45, side: 50, bag: 55, hat: 60, glasses: 61 } as const;

/** Where the loose accessories go when they have no place on the body: down the two sides, below the hands. */
const sideSlot = (index: number): { cx: number; y: number } => ({ cx: index % 2 === 0 ? 0.14 : 0.86, y: 0.66 + Math.floor(index / 2) * 0.13 });

export interface FigureLayout {
  marks: Marks;
  /** Back to front. */
  layers: FigureLayer[];
}

/** Lays an outfit out on a figure. Garments are kept in the order they came in within one role. */
export function figureLayout(items: readonly FigureItem[], figure: Figure = defaultFigure): FigureLayout {
  const marks = marksOf(figure);
  const { centerX: cx, shoulderWidth: shoulders, hipWidth: hips } = figure;
  let sides = 0;
  const layers: FigureLayer[] = [];

  const add = (item: FigureItem, rect: Rect, z: number) => layers.push({ id: item.id, role: item.slot, rect, clip: null, z });

  for (const item of items) {
    const { type } = item;
    const aspect = item.aspect && item.aspect > 0 ? item.aspect : usualAspect(item.slot, type);
    switch (item.slot) {
      case 'top':
        add(item, hang(cx, marks.collar, marks.hem, aspect, shoulders * 1.56, shoulders * 1.8), depth.top);
        break;
      case 'mid_layer':
        add(item, hang(cx, marks.collar - 0.006, midEnd(type, marks), aspect, shoulders * 1.6, shoulders * 1.9), depth.mid);
        break;
      case 'outerwear':
        add(item, hang(cx, marks.collar - 0.012, outerEnd(type, marks), aspect, shoulders * 1.7, shoulders * 2.05), depth.outer);
        break;
      case 'bottom':
        add(item, hang(cx, marks.waistband, bottomEnd(type, marks), aspect, hips * 1.14, hips * 1.4), depth.bottom);
        break;
      case 'one_piece':
        add(item, hang(cx, marks.collar, onePieceEnd(type, marks), aspect, hips * 1.14, shoulders * 1.8), depth.onePiece);
        break;
      case 'shoes':
        // One picture of the pair, a little wider than the feet, standing on the ground line; never a banner.
        add(item, put(cx, marks.ground + 0.012, figure.feetWidth + 0.03, aspect, 0.125, 'bottom'), depth.shoes);
        break;
      default:
        switch (type) {
          case 'hat':
          case 'cap':
            add(item, put(cx, marks.headTop + 0.045, headWidth * 1.3, aspect, 0.09, 'bottom'), depth.hat);
            break;
          case 'sunglasses':
            add(item, put(cx, marks.eyes, headWidth * 0.9, aspect, 0.03, 'center'), depth.glasses);
            break;
          case 'scarf':
            add(item, put(cx, marks.collar - 0.03, shoulders * 0.8, aspect, 0.12, 'top'), depth.scarf);
            break;
          case 'tie':
            add(item, put(cx, marks.collar + 0.01, 0.05, aspect, marks.waistband - marks.collar, 'top'), depth.tie);
            break;
          case 'belt':
            add(item, put(cx, marks.waistband + 0.012, hips * 1.1, aspect, 0.03, 'center'), depth.belt);
            break;
          case 'bag':
            // In the hand, which hangs just outside the hip.
            add(item, put(cx + shoulders / 2 + 0.07, marks.crotch + 0.03, 0.16, aspect, 0.18, 'top'), depth.bag);
            break;
          case 'backpack':
            add(item, put(cx - shoulders / 2 - 0.1, marks.collar + 0.02, 0.17, aspect, 0.22, 'top'), depth.bag);
            break;
          default: {
            const slot = sideSlot(sides);
            sides += 1;
            add(item, put(slot.cx, slot.y, 0.13, aspect, 0.11, 'center'), depth.side);
          }
        }
    }
  }

  // What a later layer covers shows only where that layer lets it: in the column of the body.
  const covering = Math.max(0, ...layers.filter((layer) => layer.role === 'mid_layer' || layer.role === 'outerwear').map((layer) => layer.z));
  const half = shoulders * column;
  for (const layer of layers) {
    if ((layer.role === 'top' || layer.role === 'mid_layer') && layer.z < covering) {
      layer.clip = { x: cx - half, y: 0, width: half * 2, height: 1 };
    }
  }

  return { marks, layers: layers.map((layer, index) => ({ layer, index })).sort((a, b) => a.layer.z - b.layer.z || a.index - b.index).map(({ layer }) => layer) };
}
