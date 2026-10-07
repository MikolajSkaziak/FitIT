import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { OutfitItem } from '@/api/outfits';
import { Collage } from '@/components/Collage';
import { clothing, fourItems } from '@/test/fixtures';

const item = (index: number, slot: OutfitItem['slot']): OutfitItem => ({ slot, clothing: clothing(`c${index}`, `Ubranie ${index}`, slot) });

const frameOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as { width: number; height: number };

describe('Collage', () => {
  it.each([3, 4, 5, 6, 7])('shows every garment of an outfit of %i', async (count) => {
    const slots: OutfitItem['slot'][] = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'mid_layer', 'accessory'];
    const items = slots.slice(0, count).map((slot, index) => item(index, slot));

    await render(<Collage items={items} width={358} testID="collage" />);

    expect(screen.getByLabelText(/^Zestaw: /)).toBeOnTheScreen();
    for (const entry of items) {
      expect(screen.getByLabelText(new RegExp(entry.clothing.name as string))).toBeOnTheScreen();
    }
  });

  it('reads as one picture with the names of the garments, from head to toe', async () => {
    await render(<Collage items={[...fourItems].reverse()} width={358} />);

    expect(screen.getByRole('image', { name: 'Zestaw: Granatowa koszula, Szary płaszcz, Beżowe chinosy, Białe trampki' })).toBeOnTheScreen();
  });

  it('is as high as its rows and as wide as it was told', async () => {
    await render(<Collage items={fourItems} width={358} testID="collage" />);

    const frame = frameOf('collage');
    expect(frame.width).toBe(358);
    // Two rows of a third of the width, and the gap between them.
    expect(frame.height).toBeCloseTo(2 * ((358 - 16) / 3) + 8, 5);
  });

  it('shows a one-piece outfit with the dress as the tall tile', async () => {
    const items = [item(0, 'shoes'), item(1, 'outerwear'), item(2, 'one_piece')];

    await render(<Collage items={items} width={358} />);

    expect(screen.getByRole('image', { name: 'Zestaw: Ubranie 2, Ubranie 1, Ubranie 0' })).toBeOnTheScreen();
  });
});
