import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useSession } from '@/auth/session';
import { FigureView } from '@/components/FigureView';
import { figureFor, figureLayout } from '@/features/styling/figure';
import { clothing, fourItems, user } from '@/test/fixtures';

interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const frameOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Frame;

const layoutOf = (bodyType: string | null) => figureLayout(fourItems.map(({ slot, clothing: garment }) => ({ id: garment.id, slot, type: garment.subcategory })), figureFor(bodyType));

const trapezoid = { id: 'm5', gender: 'male' as const, bodyType: 'trapezoid', label: 'Trapezoid', imageUrl: 'https://images.test/m5.jpg', thumbUrl: 'https://images.test/m5.jpg', figureUrl: 'https://images.test/m5.png' };

beforeEach(() => useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' }));

describe('FigureView', () => {
  it('reads as one picture with the names of the garments, from head to toe', async () => {
    await render(<FigureView items={[...fourItems].reverse()} width={358} />);

    expect(screen.getByRole('image', { name: 'Outfit on a figure: Navy shirt, Gray coat, Beige chinos, White sneakers' })).toBeOnTheScreen();
  });

  it('is a 3:4 canvas as wide as its column, with the person’s own silhouette as the body', async () => {
    await render(<FigureView items={fourItems} width={351} testID="figure" />);

    const canvas = frameOf('figure');
    expect(canvas.width).toBe(351);
    expect(canvas.height).toBe(468);
    expect(screen.getByTestId('figure-body').props.source).toEqual([{ uri: 'https://images.test/a1-figure.png' }]);
  });

  it('puts every garment where the layout says, filling its rectangle', async () => {
    await render(<FigureView items={fourItems} width={351} testID="figure" />);

    for (const layer of layoutOf('hourglass').layers) {
      const shown = layer.clip ?? layer.rect;
      const frame = frameOf(`figure-${layer.id}`);
      expect(frame.left).toBeCloseTo(shown.x * 351, 1);
      expect(frame.top).toBeCloseTo(shown.y * 468, 1);
      expect(frame.width).toBeCloseTo(shown.width * 351, 1);
      expect(frame.height).toBeCloseTo(shown.height * 468, 1);
      const picture = frameOf(`figure-${layer.id}-picture`);
      expect(picture.left + frame.left).toBeCloseTo(layer.rect.x * 351, 1);
      expect(picture.top + frame.top).toBeCloseTo(layer.rect.y * 468, 1);
      expect(picture.width).toBeCloseTo(layer.rect.width * 351, 1);
      expect(picture.height).toBeCloseTo(layer.rect.height * 468, 1);
      expect(screen.getByTestId(`figure-${layer.id}-picture`).props.contentFit).toBe('fill');
    }
  });

  it('shows of a top under a coat only what is inside its frame, so no sleeve sticks out', async () => {
    await render(<FigureView items={fourItems} width={351} testID="figure" />);

    const shirt = frameOf('figure-g1');
    const coat = frameOf('figure-g2');
    expect(shirt.left).toBeGreaterThan(coat.left);
    expect(shirt.left + shirt.width).toBeLessThan(coat.left + coat.width);
    expect(frameOf('figure-g1-picture').width).toBeGreaterThan(shirt.width);
    expect(StyleSheet.flatten(screen.getByTestId('figure-g1').props.style)).toMatchObject({ overflow: 'hidden' });
  });

  it('lays the garments out for the silhouette in the profile and follows a change of it', async () => {
    await render(<FigureView items={fourItems} width={351} testID="figure" />);
    const before = frameOf('figure-g3');

    await act(async () => useSession.setState({ user: user({ avatar: trapezoid }) }));

    const after = frameOf('figure-g3');
    const expected = layoutOf('trapezoid').layers.find((layer) => layer.id === 'g3')!.rect;
    expect(after.top).toBeCloseTo(expected.y * 468, 1);
    expect(after.top).not.toBeCloseTo(before.top, 1);
    expect(screen.getByTestId('figure-body').props.source).toEqual([{ uri: 'https://images.test/m5.png' }]);
  });

  it('sizes a garment by the shape of its picture once that has loaded', async () => {
    const jeans = [{ slot: 'bottom' as const, clothing: clothing('j1', 'Jeans', 'bottom') }];
    await render(<FigureView items={jeans} width={351} testID="figure" />);
    const before = frameOf('figure-j1');

    await act(async () => screen.getByTestId('figure-j1-picture').props.onLoad({ nativeEvent: { source: { width: 294, height: 618 } } }));

    const expected = figureLayout([{ id: 'j1', slot: 'bottom', type: jeans[0].clothing.subcategory, aspect: 294 / 618 }]).layers[0].rect;
    const after = frameOf('figure-j1');
    expect(after.width).toBeCloseTo(expected.width * 351, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
  });

  it('lays the garments out with no body behind them for somebody without a silhouette', async () => {
    await act(async () => useSession.setState({ status: 'signedOut', user: null }));
    await render(<FigureView items={fourItems} width={351} testID="figure" />);

    expect(screen.queryByTestId('figure-body')).toBeNull();
    expect(frameOf('figure-g3').top).toBeCloseTo(layoutOf(null).layers.find((layer) => layer.id === 'g3')!.rect.y * 468, 1);
  });

  it('shows no garments for an empty outfit, only the figure', async () => {
    await render(<FigureView items={[]} width={351} testID="figure" />);

    expect(screen.getByRole('image', { name: 'Outfit on a figure: ' })).toBeOnTheScreen();
    expect(screen.getByTestId('figure-body')).toBeOnTheScreen();
  });
});
