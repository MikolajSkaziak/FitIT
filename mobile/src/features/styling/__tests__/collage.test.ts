import type { Category } from '@/api/wardrobe';
import { cellFrame, collageColumns, collageHeight, collageLayout, inReadingOrder, rowHeightFor, type Cell } from '@/features/styling/collage';
import { pageIndex } from '@/features/styling/pager';

const overlap = (a: Cell, b: Cell): boolean =>
  a.column < b.column + b.columns && b.column < a.column + a.columns && a.row < b.row + b.rows && b.row < a.row + a.rows;

describe('collageLayout', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('places %i garments once each, inside the grid, without overlap', (count) => {
    const { rows, cells } = collageLayout(count);

    expect(cells.map((cell) => cell.index).sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, index) => index));
    for (const cell of cells) {
      expect(cell.column).toBeGreaterThanOrEqual(0);
      expect(cell.column + cell.columns).toBeLessThanOrEqual(collageColumns);
      expect(cell.row + cell.rows).toBeLessThanOrEqual(rows);
    }

    for (const [position, cell] of cells.entries()) {
      for (const other of cells.slice(position + 1)) {
        expect(overlap(cell, other)).toBe(false);
      }
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('leaves no hole for %i garments', (count) => {
    const { rows, cells } = collageLayout(count);
    const covered = cells.reduce((sum, cell) => sum + cell.columns * cell.rows, 0);

    expect(covered).toBe(rows * collageColumns);
  });

  it('shows three garments as one tall tile and two beside it', () => {
    const { rows, cells } = collageLayout(3);

    expect(rows).toBe(2);
    expect(cells[0]).toMatchObject({ column: 0, row: 0, columns: 3, rows: 2 });
    expect(cells.slice(1).map((cell) => [cell.column, cell.row])).toEqual([
      [3, 0],
      [3, 1],
    ]);
  });

  it('shows four garments as a plain two by two', () => {
    const { rows, cells } = collageLayout(4);

    expect(rows).toBe(2);
    expect(cells.every((cell) => cell.columns === 3 && cell.rows === 1)).toBe(true);
  });

  it('shows five garments as the mock-up does: one tall tile on the left and a two by two on the right', () => {
    const { rows, cells } = collageLayout(5);

    expect(rows).toBe(2);
    expect(cells[0]).toMatchObject({ column: 0, row: 0, columns: 2, rows: 2 });
    expect(cells.slice(1).map((cell) => [cell.column, cell.row])).toEqual([
      [2, 0],
      [4, 0],
      [2, 1],
      [4, 1],
    ]);
  });

  it('shows six garments as three by two and seven as the five-tile block with a row of two under it', () => {
    expect(collageLayout(6).cells.every((cell) => cell.columns === 2 && cell.rows === 1)).toBe(true);

    const seven = collageLayout(7);
    expect(seven.rows).toBe(3);
    expect(seven.cells.slice(5).map((cell) => [cell.column, cell.row, cell.columns])).toEqual([
      [0, 2, 3],
      [3, 2, 3],
    ]);
  });

  it('shares the full width in a short last row, so there is never a gap', () => {
    const eight = collageLayout(8);
    const last = eight.cells.filter((cell) => cell.row === 2);

    expect(last.map((cell) => cell.columns)).toEqual([3, 3]);
    expect(collageLayout(10).cells.find((cell) => cell.index === 9)).toMatchObject({ columns: 6, row: 3 });
  });

  it('has nothing to lay out for no garments', () => {
    expect(collageLayout(0)).toEqual({ rows: 0, cells: [] });
  });
});

describe('inReadingOrder', () => {
  const of = (...slots: Category[]) => slots.map((slot, index) => ({ slot, index }));

  it('goes from head to toe, with accessories among what is worn on top', () => {
    const ordered = inReadingOrder(of('shoes', 'bottom', 'accessory', 'outerwear', 'top'));

    expect(ordered.map((item) => item.slot)).toEqual(['top', 'outerwear', 'accessory', 'bottom', 'shoes']);
  });

  it('puts a one-piece garment first, because it is the whole outfit, and keeps the larger tile for it', () => {
    const ordered = inReadingOrder(of('shoes', 'outerwear', 'one_piece'));

    expect(ordered.map((item) => item.slot)).toEqual(['one_piece', 'outerwear', 'shoes']);
    expect(collageLayout(ordered.length).cells[ordered.findIndex((item) => item.slot === 'one_piece')]).toMatchObject({ columns: 3, rows: 2 });
  });

  it('keeps garments of one role in the order they came in', () => {
    const ordered = inReadingOrder(of('accessory', 'top', 'accessory', 'shoes', 'bottom', 'accessory'));

    expect(ordered.filter((item) => item.slot === 'accessory').map((item) => item.index)).toEqual([0, 2, 5]);
  });

  it('lays out a seven-piece outfit with every role in its place', () => {
    const ordered = inReadingOrder(of('shoes', 'accessory', 'bottom', 'outerwear', 'mid_layer', 'accessory', 'top'));

    expect(ordered.map((item) => item.slot)).toEqual(['top', 'mid_layer', 'outerwear', 'accessory', 'accessory', 'bottom', 'shoes']);
    // The two last tiles, the lower body, share the bottom row.
    expect(collageLayout(7).cells.slice(5).every((cell) => cell.row === 2)).toBe(true);
  });
});

describe('frames', () => {
  const width = 358;
  const gap = 8;
  const rowHeight = rowHeightFor(width, gap);

  it('makes a tile of a third of the width square, as in the mock-ups', () => {
    const [, second] = collageLayout(5).cells;
    const frame = cellFrame(second as Cell, width, rowHeight, gap);

    expect(frame.width).toBeCloseTo(frame.height, 5);
  });

  it('fills the width exactly, with the gaps between tiles', () => {
    const { cells } = collageLayout(5);
    const [tall, right] = cells.map((cell) => cellFrame(cell, width, rowHeight, gap)) as [ReturnType<typeof cellFrame>, ReturnType<typeof cellFrame>];
    const far = cellFrame(cells[2] as Cell, width, rowHeight, gap);

    expect(tall.left).toBe(0);
    expect(right.left).toBeCloseTo(tall.width + gap, 5);
    expect(far.left + far.width).toBeCloseTo(width, 5);
  });

  it('makes a tall tile as high as the rows it spans and the gap between them', () => {
    const [tall] = collageLayout(5).cells;

    expect(cellFrame(tall as Cell, width, rowHeight, gap).height).toBeCloseTo(2 * rowHeight + gap, 5);
    expect(collageHeight(2, rowHeight, gap)).toBeCloseTo(2 * rowHeight + gap, 5);
    expect(collageHeight(0, rowHeight, gap)).toBe(0);
  });
});

describe('pageIndex', () => {
  it('rounds to the nearest page, so a swipe that stops halfway counts for the page it is closer to', () => {
    expect(pageIndex(0, 390, 3)).toBe(0);
    expect(pageIndex(180, 390, 3)).toBe(0);
    expect(pageIndex(200, 390, 3)).toBe(1);
    expect(pageIndex(780, 390, 3)).toBe(2);
  });

  it('never leaves the pages there are, even when the scroll bounces past them', () => {
    expect(pageIndex(-40, 390, 3)).toBe(0);
    expect(pageIndex(1200, 390, 3)).toBe(2);
    expect(pageIndex(100, 0, 3)).toBe(0);
    expect(pageIndex(100, 390, 0)).toBe(0);
  });
});
