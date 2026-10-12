import type { BoardItem, Placement } from '@/features/styling/board';
import { coatShift, figureBoard, figures, halved, marksOf } from '@/features/styling/figure';

const tee: BoardItem = { id: 'tee', slot: 'top', type: 't_shirt', aspect: 1.1 };
const hoodie: BoardItem = { id: 'hoodie', slot: 'mid_layer', type: 'hoodie', aspect: 1 };
const jeans: BoardItem = { id: 'jeans', slot: 'bottom', type: 'jeans', aspect: 0.5 };
const sneakers: BoardItem = { id: 'sneakers', slot: 'shoes', type: 'sneakers', aspect: 1.6 };
const coat: BoardItem = { id: 'coat', slot: 'outerwear', type: 'coat', aspect: 0.7 };

const figure = figures.rectangle;
const placeOf = (placements: readonly Placement[], id: string) => placements.find((placement) => placement.clothingId === id) as Placement;

describe('garments on the figure', () => {
  it('hangs each garment where it is worn: down the middle of the body, head to toe', () => {
    const { placements, shift } = figureBoard([tee, jeans, sneakers], figure);

    expect(shift).toBe(0);
    expect(placements.map((placement) => placement.clothingId)).toEqual(['tee', 'jeans', 'sneakers']);
    for (const placement of placements) {
      expect(placement.x).toBeCloseTo(figure.centerX, 5);
    }

    expect(placeOf(placements, 'tee').y).toBeLessThan(placeOf(placements, 'jeans').y);
    expect(placeOf(placements, 'jeans').y).toBeLessThan(placeOf(placements, 'sneakers').y);
    // Untucked: the top lies over the trousers, and the trouser legs over the shoes.
    expect(placeOf(placements, 'tee').z).toBeGreaterThan(placeOf(placements, 'jeans').z);
    expect(placeOf(placements, 'jeans').z).toBeGreaterThan(placeOf(placements, 'sneakers').z);
  });

  it('starts a top at the collar', () => {
    const { placements } = figureBoard([tee], figure);
    const place = placeOf(placements, 'tee');
    const height = (place.scale * 0.75) / 1.1;

    expect(place.y - height / 2).toBeCloseTo(marksOf(figure).collar, 5);
  });

  it('never wears the coat: it hangs beside the figure, which steps aside for it', () => {
    const { placements, shift } = figureBoard([tee, jeans, coat], figure);
    const hung = placeOf(placements, 'coat');
    const worn = placeOf(placements, 'tee');

    expect(shift).toBe(coatShift);
    expect(worn.x).toBeCloseTo(figure.centerX + coatShift, 5);
    // Clear of the top, and all of it on the board.
    expect(hung.x - hung.scale / 2).toBeGreaterThan(worn.x + worn.scale / 2 - 0.12);
    expect(hung.x + hung.scale / 2).toBeLessThanOrEqual(1);
    expect(hung.z).toBeGreaterThan(worn.z);
  });

  it('shows a layer worn over a top as its right half, and whole again once it is moved away or put behind', () => {
    const items = [tee, hoodie, jeans];
    const { placements } = figureBoard(items, figure);

    expect([...halved(items, placements)]).toEqual(['hoodie']);

    const moved = placements.map((placement) => (placement.clothingId === 'hoodie' ? { ...placement, x: placement.x + 0.2 } : placement));
    expect(halved(items, moved).size).toBe(0);

    const behind = placements.map((placement) => (placement.clothingId === 'hoodie' ? { ...placement, z: -1 } : placement));
    expect(halved(items, behind).size).toBe(0);
  });

  it('halves nothing when only one layer is worn on top', () => {
    const { placements } = figureBoard([hoodie, jeans], figure);

    expect(halved([hoodie, jeans], placements).size).toBe(0);
  });
});
