import type { Category, Subcategory } from '@/api/wardrobe';

import { aspectOf, boardAspect, type BoardItem, type Placement } from './board';

/**
 * Where each garment of an outfit sits in the "On figure" view that `BoardView` draws: the garments' cut-outs over the
 * person's own silhouette, each where it is worn. Pure geometry: no React, no pixels.
 *
 * The canvas is the board (3:4), which is also the shape of the figure's picture: the silhouette, standing, seen from
 * the front, on a transparent background. Places are the board's own (`Placement`: the centre, the width as a fraction
 * of the board's, the stacking order), so the view is arranged by hand and stored exactly like the board.
 *
 * Each figure has a few measured landmarks (`figures`), and the lines garments hang from are derived from those
 * (`marksOf`): collar, waistband, hem, knees, ankles, ground. A garment hangs from its line and is as tall as the
 * stretch of body it covers, unless that would leave it narrower or wider than the body it is worn on: then its width
 * is held and its length follows. A picture is never stretched.
 *
 * Three rules make the view readable:
 *
 * - The outer layer is never worn. A coat over everything would hide the outfit, so it hangs beside the figure, and the
 *   figure steps aside to make room for it (`shift`).
 * - A layer worn over another shows as its right half only (`halved`): half the tee, half the hoodie, down the middle
 *   of the body. Moved away from what it covered, it is whole again.
 * - Layering, back to front: shoes, bottom, top or one-piece, belt and tie, mid layer, scarf, bag and loose things,
 *   hat, sunglasses, the outer layer.
 */

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

/** How far the figure steps to the left when a coat hangs beside it, as a fraction of the board's width. */
export const coatShift = -0.13;

/** The middle of the room beside the figure where the outer layer hangs, and the widest it is drawn there. */
const coatCenter = 0.82;
const coatWidest = 0.33;

/** The width of the head, the same on every figure. */
const headWidth = 0.097;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** The width, in fractions of the board's width, of a picture of this shape that is `height` of the board tall. */
const widthOf = (height: number, aspect: number): number => (height * aspect) / boardAspect;

const heightOf = (width: number, aspect: number): number => (width * boardAspect) / aspect;

/** A garment hanging from `top`: as long as the body down to `bottom`, unless that leaves it narrower than `min` or wider than `max`. */
function hang(cx: number, top: number, bottom: number, aspect: number, min: number, max: number): Rect {
  const width = clamp(widthOf(bottom - top, aspect), min, max);
  return { x: cx - width / 2, y: top, width, height: heightOf(width, aspect) };
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
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(top, 0, 1 - h), width: w, height: h };
}

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

const outerEnd = (type: Subcategory | null | undefined, marks: Marks): number => (isLong(type) ? marks.knees - 0.03 : marks.hem + 0.04);

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

/** Draw order. */
const depth = { shoes: 0, bottom: 1, body: 2, belt: 3, mid: 4, scarf: 5, side: 6, hat: 7, glasses: 8, outer: 9 } as const;

/** Heights along the side of the figure where loose accessories go, away from the hand that holds the bag. */
const sideHeights = [0.3, 0.86, 0.16] as const;

export interface FigureBoard {
  /** In the order the garments came in. */
  placements: Placement[];
  /** How far from the middle the figure's picture is drawn, as a fraction of the board's width. */
  shift: number;
}

/** Lays an outfit out on a figure. */
export function figureBoard(items: readonly BoardItem[], figure: Figure = defaultFigure): FigureBoard {
  const marks = marksOf(figure);
  const coat = items.some((item) => item.slot === 'outerwear');
  const shift = coat ? coatShift : 0;
  const cx = figure.centerX + shift;
  const { shoulderWidth: shoulders, hipWidth: hips } = figure;
  const beside = Math.max(0.09, cx - shoulders / 2 - 0.1);
  let sides = 0;
  let coats = 0;

  const laid = items.map((item, order) => {
    const { type } = item;
    const aspect = aspectOf(item);
    const place = (): readonly [Rect, number] => {
      switch (item.slot) {
        case 'top':
          return [hang(cx, marks.collar, marks.hem, aspect, shoulders * 1.56, shoulders * 1.8), depth.body];
        case 'one_piece':
          return [hang(cx, marks.collar, onePieceEnd(type, marks), aspect, hips * 1.14, shoulders * 1.8), depth.body];
        case 'mid_layer':
          return [hang(cx, marks.collar - 0.006, midEnd(type, marks), aspect, shoulders * 1.6, shoulders * 1.9), depth.mid];
        case 'bottom':
          return [hang(cx, marks.waistband, bottomEnd(type, marks), aspect, hips * 1.14, hips * 1.4), depth.bottom];
        case 'shoes':
          // One picture of the pair, a little wider than the feet, standing on the ground line.
          return [put(cx, marks.ground + 0.012, figure.feetWidth + 0.03, aspect, 0.125, 'bottom'), depth.shoes];
        case 'outerwear': {
          // Beside the figure, hanging from the height of its collar; a second one a little lower and in front.
          const top = marks.collar - 0.012 + coats * 0.06;
          coats += 1;
          const rect = hang(coatCenter, top, outerEnd(type, marks), aspect, 0.24, coatWidest);
          return [{ ...rect, y: Math.min(rect.y, 1 - rect.height - 0.02) }, depth.outer];
        }
        default:
          switch (type) {
            case 'hat':
            case 'cap':
              return [put(cx, marks.headTop + 0.045, headWidth * 1.3, aspect, 0.09, 'bottom'), depth.hat];
            case 'sunglasses':
              return [put(cx, marks.eyes, headWidth * 0.9, aspect, 0.03, 'center'), depth.glasses];
            case 'scarf':
              return [put(cx, marks.collar - 0.03, shoulders * 0.8, aspect, 0.12, 'top'), depth.scarf];
            case 'tie':
              return [put(cx, marks.collar + 0.01, 0.05, aspect, marks.waistband - marks.collar, 'top'), depth.belt];
            case 'belt':
              return [put(cx, marks.waistband + 0.012, hips * 1.1, aspect, 0.03, 'center'), depth.belt];
            case 'bag':
              // In the hand away from the coat, which hangs just outside the hip.
              return [put(cx - shoulders / 2 - 0.08, marks.crotch + 0.03, 0.15, aspect, 0.18, 'top'), depth.side];
            default: {
              const index = sides;
              sides += 1;
              // With a coat on the right, everything loose keeps to the left; without one the two sides take turns.
              const right = !coat && index % 2 === 1;
              const height = sideHeights[(coat ? index : Math.floor(index / 2)) % sideHeights.length];
              return [put(right ? 1 - beside : beside, height, 0.13, aspect, 0.11, 'center'), depth.side];
            }
          }
      }
    };

    const [rect, z] = place();
    return { id: item.id, order, rect, z };
  });

  const stacking = [...laid].sort((a, b) => a.z - b.z || a.order - b.order).map((piece) => piece.id);
  return {
    shift,
    placements: laid.map(({ id, rect }) => ({ clothingId: id, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, scale: rect.width, z: stacking.indexOf(id) })),
  };
}

/** How close the middles of two garments have to be, across and down, for one to count as worn over the other. */
const wornOverX = 0.05;
const wornOverY = 0.2;

const underLayers: readonly Category[] = ['top', 'one_piece'];

/**
 * The garments drawn as their right half only: a mid layer that lies over a top or a dress, in front of it. That shows
 * half of each down the middle of the body. One that was moved off what it covered, or put behind it, is whole.
 */
export function halved(items: readonly Pick<BoardItem, 'id' | 'slot'>[], placements: readonly Placement[]): ReadonlySet<string> {
  const placeOf = new Map(placements.map((placement) => [placement.clothingId, placement]));
  const under = items.filter((item) => underLayers.includes(item.slot)).flatMap((item) => placeOf.get(item.id) ?? []);
  const halves = new Set<string>();
  for (const item of items) {
    const over = item.slot === 'mid_layer' ? placeOf.get(item.id) : undefined;
    if (over && under.some((place) => over.z > place.z && Math.abs(over.x - place.x) < wornOverX && Math.abs(over.y - place.y) < wornOverY)) {
      halves.add(item.id);
    }
  }

  return halves;
}
