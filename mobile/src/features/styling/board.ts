import type { OutfitPlacement } from '@/api/outfits';
import type { Category, Subcategory } from '@/api/wardrobe';

/**
 * Where each garment of an outfit lies on the board that `BoardView` draws: a stylist's flat lay on the well, with no
 * body behind it. Pure geometry: no React.
 *
 * The board is 3:4 (width : height). A garment's place is its centre in fractions of the board (`x` of the width, `y`
 * of the height), its width as a fraction of the board's width (`scale`) and its stacking order (`z`); its height
 * follows from the shape of its picture, which the server crops to the garment. That is also how a person's own
 * arrangement is stored, so one arrangement fits a board of any size.
 *
 * The automatic layout (`boardLayout`) never lets two garments touch. It stands them in up to three columns, each a
 * stack in body order: the top (or the dress) over the bottom in the middle, the outer layer beside the top, shoes at
 * the foot of a column, the bag and the small things in the corners that are left. Every garment starts at a size
 * close to its real one (a coat larger than a tee, shoes small), every way of sharing the loose pieces between the
 * columns is tried, and the one that lets the whole outfit be drawn largest wins.
 */
export const boardAspect = 3 / 4;

/**
 * Head to toe. A one-piece garment comes first because it is the whole outfit; accessories sit with what is worn on
 * top, so the upper half of a list of garments is the upper half of the person.
 */
const reading: Record<Category, number> = { one_piece: 0, top: 1, mid_layer: 2, outerwear: 3, accessory: 4, bottom: 5, shoes: 6 };

/** The garments in head-to-toe order. Garments of one role keep the order they came in. */
export const inReadingOrder = <T extends { slot: Category }>(items: readonly T[]): T[] =>
  items.map((item, index) => ({ item, index })).sort((a, b) => reading[a.item.slot] - reading[b.item.slot] || a.index - b.index).map(({ item }) => item);

/** Points kept free along the edges of the board, and between two garments, by the automatic layout. */
export const boardInset = 16;
export const boardGap = 10;

/** How small and how large a person may make a garment: its width as a fraction of the board's width. */
export const minScale = 0.12;
export const maxScale = 0.8;

/** One press of "move" or "bigger" for somebody arranging without gestures. */
export const nudgeStep = 0.05;
export const scaleStep = 0.04;

/** A garment as the layout needs it. `aspect` is the picture's width over its height, once it is known. */
export interface BoardItem {
  id: string;
  slot: Category;
  type?: Subcategory | null;
  aspect?: number | null;
}

/** One garment's place on the board, in the form it is stored in. */
export type Placement = OutfitPlacement;

/** The part of a placement a finger changes. */
export interface Spot {
  x: number;
  y: number;
  scale: number;
}

export interface BoardSize {
  width: number;
  height: number;
}

export const boardSize = (width: number): BoardSize => ({ width: Math.round(width), height: Math.round(width / boardAspect) });

const isLong = (type: Subcategory | null | undefined): boolean => type === 'coat' || type === 'trench_coat' || type === 'parka' || type === 'raincoat';

/** The shape a picture is taken to have until it has loaded, so the garment is near its place from the first frame. */
const usualAspect = (slot: Category, type: Subcategory | null | undefined): number => {
  switch (slot) {
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

/** The shape of a garment's picture: its own once known, the usual one for its kind until then. */
export const aspectOf = (item: BoardItem): number => (item.aspect && item.aspect > 0 ? item.aspect : usualAspect(item.slot, item.type));

/** The room a garment of this kind takes lying flat, width and height in centimetres or so; its picture is fitted inside. */
const roomOf = (slot: Category, type: Subcategory | null | undefined): readonly [number, number] => {
  switch (slot) {
    case 'top':
      return [72, 72];
    case 'mid_layer':
      return [76, 76];
    case 'outerwear':
      return isLong(type) ? [84, 112] : [80, 80];
    case 'bottom':
      return type === 'shorts' ? [56, 48] : type === 'skirt' ? [58, 62] : [56, 104];
    case 'one_piece':
      return type === 'jumpsuit' || type === 'tracksuit' ? [72, 132] : [72, 112];
    case 'shoes':
      return [42, 34];
    default:
      switch (type) {
        case 'bag':
          return [40, 44];
        case 'backpack':
          return [42, 50];
        case 'scarf':
          return [36, 46];
        case 'belt':
          return [44, 22];
        case 'tie':
          return [24, 48];
        case 'sunglasses':
          return [32, 20];
        default:
          return [32, 32];
      }
  }
};

/** Worn on the head or at the neck: these lie above the garments of their column, the other small things below. */
const wornHigh = (type: Subcategory | null | undefined): boolean => type === 'hat' || type === 'cap' || type === 'sunglasses' || type === 'scarf' || type === 'tie';

/** Body order within a column, top to bottom. */
const rankOf = (slot: Category, type: Subcategory | null | undefined): number => {
  switch (slot) {
    case 'outerwear':
      return 1;
    case 'mid_layer':
      return 2;
    case 'top':
    case 'one_piece':
      return 3;
    case 'bottom':
      return 4;
    case 'shoes':
      return 6;
    default:
      return wornHigh(type) ? 0 : 5;
  }
};

type Column = 'right' | 'middle' | 'left';

/** Tried in this order, so of two equally good layouts the one that fills the right side first is kept. */
const columns: readonly Column[] = ['right', 'middle', 'left'];

/** Left to right, as the columns stand on the board. */
const standing: readonly Column[] = ['left', 'middle', 'right'];

/** How well a loose piece sits in a column, 1 being where a stylist would put it. Size decides between equals. */
const liking = (slot: Category, column: Column): number => {
  const beside = column !== 'middle';
  switch (slot) {
    case 'outerwear':
      return column === 'right' ? 1 : column === 'left' ? 0.97 : 0.6;
    case 'mid_layer':
      return column === 'left' ? 1 : column === 'right' ? 0.99 : 0.6;
    case 'shoes':
      return beside ? 0.93 : 1;
    case 'top':
    case 'one_piece':
      return beside ? 1 : 0.7;
    case 'bottom':
      return beside ? 1 : 0.9;
    default:
      return beside ? 1 : 0.85;
  }
};

/** The automatic layout draws no garment wider or taller than this share of the board, however few there are. */
const widest = 0.7;
const tallest = 0.8;

/** More loose pieces than this are not all tried in every column: the rest alternate between the sides. */
const triedLoose = 7;

interface Piece {
  id: string;
  slot: Category;
  order: number;
  rank: number;
  /** Lies at the foot of its column rather than under the garment above it. */
  low: boolean;
  aspect: number;
  width: number;
  height: number;
}

/** The garment the middle column is built around: the dress or the top, or failing those whatever is worn highest. */
const leadOf = (pieces: readonly Piece[]): Piece | undefined =>
  pieces.find((piece) => piece.slot === 'one_piece' || piece.slot === 'top') ??
  pieces.find((piece) => piece.slot === 'mid_layer') ??
  pieces.find((piece) => piece.slot === 'outerwear') ??
  pieces.find((piece) => piece.slot === 'bottom') ??
  pieces[0];

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** How large the outfit can be drawn with its pieces shared out this way: points per unit of a garment's room. */
function fitOf(stacks: Record<Column, Piece[]>, size: BoardSize): number {
  const used = standing.map((column) => stacks[column]).filter((stack) => stack.length > 0);
  const wide = sum(used.map((stack) => Math.max(...stack.map((piece) => piece.width))));
  let fit = (size.width - 2 * boardInset - (used.length - 1) * boardGap) / wide;
  for (const stack of used) {
    fit = Math.min(fit, (size.height - 2 * boardInset - (stack.length - 1) * boardGap) / sum(stack.map((piece) => piece.height)));
    for (const piece of stack) {
      fit = Math.min(fit, (widest * size.width) / piece.width, (tallest * size.height) / piece.height);
    }
  }

  return fit;
}

/**
 * Lays an outfit out on a board of the given size, in points. No two garments come closer than `boardGap` and none
 * comes closer to an edge than `boardInset`. The answer is in the order the garments came in.
 */
export function boardLayout(items: readonly BoardItem[], size: BoardSize): Placement[] {
  const pieces: Piece[] = items.map((item, order) => {
    const aspect = aspectOf(item);
    const [roomWidth, roomHeight] = roomOf(item.slot, item.type);
    const width = Math.min(roomWidth, roomHeight * aspect);
    return { id: item.id, slot: item.slot, order, rank: rankOf(item.slot, item.type), low: rankOf(item.slot, item.type) >= 5, aspect, width, height: width / aspect };
  });
  const lead = leadOf(pieces);
  if (!lead) {
    return [];
  }

  const waist = lead.slot === 'bottom' ? undefined : pieces.find((piece) => piece.slot === 'bottom');
  const loose = pieces.filter((piece) => piece !== lead && piece !== waist);
  const tried = loose.slice(0, triedLoose);
  const rest = loose.slice(triedLoose);

  let best: { stacks: Record<Column, Piece[]>; fit: number; score: number } | undefined;
  for (let way = 0; way < 3 ** tried.length; way += 1) {
    const stacks: Record<Column, Piece[]> = { left: [], middle: waist ? [lead, waist] : [lead], right: [] };
    let score = 1;
    let digits = way;
    for (const piece of tried) {
      const column = columns[digits % 3];
      digits = Math.floor(digits / 3);
      stacks[column].push(piece);
      score *= liking(piece.slot, column);
    }

    rest.forEach((piece, index) => stacks[index % 2 === 0 ? 'right' : 'left'].push(piece));
    const fit = fitOf(stacks, size);
    score *= fit;
    if (!best || score > best.score + 1e-9) {
      best = { stacks, fit, score };
    }
  }

  if (!best) {
    return [];
  }

  const { stacks, fit } = best;
  const used = standing.map((column) => stacks[column]).filter((stack) => stack.length > 0);
  for (const stack of used) {
    stack.sort((a, b) => a.rank - b.rank || a.order - b.order);
  }

  const widths = used.map((stack) => Math.max(...stack.map((piece) => piece.width)) * fit);
  const blockHeight = Math.max(...used.map((stack) => sum(stack.map((piece) => piece.height)) * fit + (stack.length - 1) * boardGap));
  const top = (size.height - blockHeight) / 2;
  let left = (size.width - sum(widths) - (used.length - 1) * boardGap) / 2;

  const placed = new Map<string, Placement>();
  const put = (piece: Piece, centerX: number, y: number) =>
    placed.set(piece.id, { clothingId: piece.id, x: centerX / size.width, y: (y + (piece.height * fit) / 2) / size.height, scale: (piece.width * fit) / size.width, z: piece.order });

  used.forEach((stack, index) => {
    const centerX = left + widths[index] / 2;
    left += widths[index] + boardGap;
    const hanging = stack.filter((piece) => !piece.low);
    const lying = stack.filter((piece) => piece.low);
    // A column of small things only spreads to both corners instead of piling up in the lower one.
    if (hanging.length === 0 && lying.length > 1) {
      hanging.push(...lying.splice(0, 1));
    }

    let y = top;
    for (const piece of hanging) {
      put(piece, centerX, y);
      y += piece.height * fit + boardGap;
    }

    y = top + blockHeight;
    for (const piece of lying.reverse()) {
      y -= piece.height * fit;
      put(piece, centerX, y);
      y -= boardGap;
    }
  });

  return pieces.flatMap((piece) => placed.get(piece.id) ?? []);
}

const clamp = (value: number, min: number, max: number): number => {
  'worklet';
  return Math.max(min, Math.min(max, value));
};

/** A garment's height as a fraction of the board's height. */
export const heightOf = (scale: number, aspect: number): number => {
  'worklet';
  return (scale / aspect) * boardAspect;
};

/** The same place, brought back so that the whole garment lies on the board. */
export function keptInside(spot: Spot, aspect: number): Spot {
  'worklet';
  const halfWidth = Math.min(spot.scale, 1) / 2;
  const halfHeight = Math.min(heightOf(spot.scale, aspect), 1) / 2;
  return { x: clamp(spot.x, halfWidth, 1 - halfWidth), y: clamp(spot.y, halfHeight, 1 - halfHeight), scale: spot.scale };
}

/** Past the board's edge a held garment follows the finger at this fraction of the way, and never strays further than `edgeStretch` points. */
export const edgeResistance = 0.3;
export const edgeStretch = 24;

/** How far (points) a garment follows a finger that is `beyond` points past the edge: slowed, capped, and on the same side. */
export function resisted(beyond: number): number {
  'worklet';
  return Math.sign(beyond) * Math.min(edgeStretch, Math.abs(beyond) * edgeResistance);
}

/**
 * A garment dragged to `spot`, which may lie past the board's edge. `kept` is where it belongs (all of it on the board, and
 * the only place ever stored), `over` how far in points it is drawn past that place while the finger is down (none under
 * reduced motion: it is held at the edge), `outside` whether the finger has taken it past the edge at all.
 */
export function pulled(spot: Spot, aspect: number, size: BoardSize, reduced: boolean): { kept: Spot; over: { x: number; y: number }; outside: boolean } {
  'worklet';
  const kept = keptInside(spot, aspect);
  const beyondX = (spot.x - kept.x) * size.width;
  const beyondY = (spot.y - kept.y) * size.height;
  return { kept, over: reduced ? { x: 0, y: 0 } : { x: resisted(beyondX), y: resisted(beyondY) }, outside: beyondX !== 0 || beyondY !== 0 };
}

/** The garment made `factor` times as large around its centre, within what a person may choose and what the board holds. */
export function resized(spot: Spot, factor: number, aspect: number): Spot {
  'worklet';
  const largest = Math.min(maxScale, aspect / boardAspect);
  return keptInside({ x: spot.x, y: spot.y, scale: clamp(spot.scale * factor, Math.min(minScale, largest), largest) }, aspect);
}

/**
 * The places an outfit is drawn at, given its automatic layout: the person's own arrangement where it names a garment,
 * the automatic place for every garment it does not.
 */
export function arrangedBoard(automatic: readonly Placement[], stored: readonly Placement[] | null | undefined): Placement[] {
  if (!stored || stored.length === 0) {
    return [...automatic];
  }

  const own = new Map(stored.map((placement) => [placement.clothingId, placement]));
  const front = Math.max(...stored.map((placement) => placement.z));
  return automatic.map((placement) => {
    const kept = own.get(placement.clothingId);
    // A garment the arrangement does not name lies on top, where it is seen.
    return kept ? { ...kept, x: clamp(kept.x, 0, 1), y: clamp(kept.y, 0, 1) } : { ...placement, z: front + 1 + placement.z };
  });
}

/** The stacking order just above everything on the board. */
export const frontOf = (placements: readonly Placement[]): number => Math.max(-1, ...placements.map((placement) => placement.z)) + 1;

/** The smallest size the server keeps; the automatic layout can draw a belt smaller than a person may choose. */
const storedMinScale = 0.05;

const rounded = (value: number): number => Math.round(value * 10000) / 10000;

/** An arrangement as it is sent to be stored: stacking orders counted from zero, numbers no finer than a point can show. */
export function storedForm(placements: readonly Placement[]): Placement[] {
  const order = [...placements].sort((a, b) => a.z - b.z).map((placement) => placement.clothingId);
  return placements.map((placement) => ({
    clothingId: placement.clothingId,
    x: rounded(clamp(placement.x, 0, 1)),
    y: rounded(clamp(placement.y, 0, 1)),
    scale: rounded(clamp(placement.scale, storedMinScale, 1)),
    z: order.indexOf(placement.clothingId),
  }));
}

export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The rectangle a placed garment covers on a board of the given size, in points. */
export function frameOf(placement: Spot, aspect: number, size: BoardSize): Frame {
  const width = placement.scale * size.width;
  const height = width / aspect;
  return { left: placement.x * size.width - width / 2, top: placement.y * size.height - height / 2, width, height };
}
