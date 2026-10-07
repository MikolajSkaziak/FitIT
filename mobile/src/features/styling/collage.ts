import type { Category } from '@/api/wardrobe';

/**
 * Head to toe. A one-piece garment comes first because it is the whole outfit; accessories sit with what is worn on
 * top, so the upper half of the collage is the upper half of the person.
 */
const reading: Record<Category, number> = { one_piece: 0, top: 1, mid_layer: 2, outerwear: 3, accessory: 4, bottom: 5, shoes: 6 };

/** The garments in the order the collage lays them out. Garments of one role keep the order they came in. */
export const inReadingOrder = <T extends { slot: Category }>(items: readonly T[]): T[] =>
  items.map((item, index) => ({ item, index })).sort((a, b) => reading[a.item.slot] - reading[b.item.slot] || a.index - b.index).map(({ item }) => item);

/** The grid has six units across, so a row can hold one tile, two or three of equal width. */
export const collageColumns = 6;

/** One tile: where it starts and how much of the grid it covers, in grid units. `index` is its place in reading order. */
export interface Cell {
  index: number;
  column: number;
  row: number;
  columns: number;
  rows: number;
}

export interface CollageLayout {
  rows: number;
  cells: Cell[];
}

const tile = (index: number, column: number, row: number, columns: number, rows = 1): Cell => ({ index, column, row, columns, rows });

/** `count` tiles in rows of up to `perRow`; a short last row shares the full width instead of leaving a hole. */
function evenRows(first: number, count: number, startRow: number, perRow: 2 | 3): Cell[] {
  const cells: Cell[] = [];
  for (let placed = 0; placed < count; ) {
    const inRow = Math.min(perRow, count - placed);
    const span = collageColumns / inRow;
    for (let column = 0; column < inRow; column += 1) {
      cells.push(tile(first + placed + column, column * span, startRow + Math.floor(placed / perRow), span));
    }

    placed += inRow;
  }

  return cells;
}

/**
 * Where each garment of an outfit goes. Every layout keeps the first garment (the one-piece, or the top) the largest:
 * with an odd count it is a tall tile down the left side and the rest fill the right; with an even count the tiles are equal.
 *
 *   3: tall + 2      4: 2 x 2      5: tall + 2 x 2      6: 3 x 2      7: five-tile block + a row of 2
 */
export function collageLayout(count: number): CollageLayout {
  if (count <= 0) {
    return { rows: 0, cells: [] };
  }

  if (count === 1) {
    return { rows: 1, cells: [tile(0, 0, 0, collageColumns)] };
  }

  if (count === 2 || count === 4) {
    return { rows: count / 2, cells: evenRows(0, count, 0, 2) };
  }

  if (count === 3) {
    return { rows: 2, cells: [tile(0, 0, 0, 3, 2), tile(1, 3, 0, 3), tile(2, 3, 1, 3)] };
  }

  if (count === 5 || count === 7) {
    const block = [tile(0, 0, 0, 2, 2), ...[1, 2, 3, 4].map((index) => tile(index, index % 2 === 1 ? 2 : 4, index <= 2 ? 0 : 1, 2))];
    return count === 5 ? { rows: 2, cells: block } : { rows: 3, cells: [...block, ...evenRows(5, 2, 2, 2)] };
  }

  const cells = evenRows(0, count, 0, 3);
  return { rows: Math.ceil(count / 3), cells };
}

export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Height of one row so that a tile a third of the width is square: what the mock-ups show. */
export const rowHeightFor = (width: number, gap: number): number => (width - 2 * gap) / 3;

export const collageHeight = (rows: number, rowHeight: number, gap: number): number => (rows === 0 ? 0 : rows * rowHeight + (rows - 1) * gap);

/** Pixel rectangle of a tile inside a collage `width` wide. */
export function cellFrame(cell: Cell, width: number, rowHeight: number, gap: number): Frame {
  const unit = (width - (collageColumns - 1) * gap) / collageColumns;
  return {
    left: cell.column * (unit + gap),
    top: cell.row * (rowHeight + gap),
    width: cell.columns * unit + (cell.columns - 1) * gap,
    height: cell.rows * rowHeight + (cell.rows - 1) * gap,
  };
}
