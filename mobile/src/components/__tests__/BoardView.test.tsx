import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import { BoardView } from '@/components/BoardView';
import { useScrollable } from '@/components/scrollLock';
import { boardLayout, boardSize, type BoardItem, type Placement } from '@/features/styling/board';
import { clothing, fourItems } from '@/test/fixtures';
import { motion } from '@/theme';

const board = boardSize(351);

const pieces: BoardItem[] = fourItems.map(({ slot, clothing: garment }) => ({ id: garment.id, slot, type: garment.subcategory }));

const automatic = boardLayout(pieces, board);

const placeOf = (layout: readonly Placement[], id: string): Placement => {
  const found = layout.find((placement) => placement.clothingId === id);
  if (!found) {
    throw new Error(`no garment ${id}`);
  }

  return found;
};

interface Look {
  width: number;
  height: number;
  transform: { translateX?: number; translateY?: number; scale?: number }[];
}

const lookOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Look;

/** Where a garment is drawn, in the units it is stored in: read back from the two transforms that place it. */
function drawn(id: string): { x: number; y: number; scale: number } {
  const anchor = lookOf(`board-${id}`);
  const frame = lookOf(`board-${id}-frame`);
  const shift = Object.assign({}, ...anchor.transform) as { translateX: number; translateY: number };
  return { x: shift.translateX / board.width + 0.5, y: shift.translateY / board.height + 0.5, scale: (frame.width * (frame.transform[0].scale ?? 1)) / board.width };
}

function expectDrawnAt(layout: readonly Placement[]) {
  for (const placement of layout) {
    const shown = drawn(placement.clothingId);
    expect(shown.x).toBeCloseTo(placement.x, 4);
    expect(shown.y).toBeCloseTo(placement.y, 4);
    expect(shown.scale).toBeCloseTo(placement.scale, 4);
  }
}

const action = (testID: string, actionName: string) => fireEvent(screen.getByTestId(testID), 'accessibilityAction', { nativeEvent: { actionName } });

/** Lets what a gesture handed over to the JS side arrive. */
const settle = () => act(async () => undefined);

/** Where things were sent gliding to. A garment's fade-in also runs on a timing, to 1, and is not a glide. */
const glides = () =>
  jest
    .mocked(withTiming)
    .mock.calls.map(([to]) => to)
    .filter((to) => to !== 1);

function Scrolling() {
  return <Text testID="scrolling">{useScrollable() ? 'free' : 'held'}</Text>;
}

beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

describe('BoardView', () => {
  it('reads as one picture with the names of the garments, from head to toe', async () => {
    await render(<BoardView items={[...fourItems].reverse()} width={351} />);

    expect(screen.getByRole('image', { name: 'Outfit on a board: Navy shirt, Gray coat, Beige chinos, White sneakers' })).toBeOnTheScreen();
  });

  it('is a 3:4 board as wide as its column, with every garment where the automatic layout puts it, whole', async () => {
    await render(<BoardView items={fourItems} width={351} testID="board" />);

    const canvas = lookOf('board');
    expect(canvas.width).toBe(351);
    expect(canvas.height).toBe(468);
    expectDrawnAt(automatic);
    expect(screen.getByTestId('board-g1-picture').props.contentFit).toBe('contain');
  });

  it('draws the person’s own arrangement, and a garment it does not name at its automatic place', async () => {
    const own: Placement[] = [
      { clothingId: 'g1', x: 0.3, y: 0.25, scale: 0.5, z: 1 },
      { clothingId: 'g3', x: 0.32, y: 0.3, scale: 0.3, z: 0 },
    ];
    await render(<BoardView items={fourItems} width={351} layout={own} testID="board" />);

    expectDrawnAt([...own, placeOf(automatic, 'g2'), placeOf(automatic, 'g4')]);
    // Higher lies in front.
    expect(StyleSheet.flatten(screen.getByTestId('board-g1').props.style)).toMatchObject({ zIndex: 1 });
    expect(StyleSheet.flatten(screen.getByTestId('board-g3').props.style)).toMatchObject({ zIndex: 0 });
  });

  it('lays the garments out again by the shape of a picture once it has loaded', async () => {
    const jeans = [{ slot: 'bottom' as const, clothing: clothing('j1', 'Jeans', 'bottom') }];
    await render(<BoardView items={jeans} width={351} testID="board" />);
    const before = drawn('j1');

    await act(async () => screen.getByTestId('board-j1-picture').props.onLoad({ nativeEvent: { source: { width: 500, height: 520 } } }));

    expectDrawnAt(boardLayout([{ id: 'j1', slot: 'bottom', aspect: 500 / 520 }], board));
    expect(drawn('j1').scale).toBeGreaterThan(before.scale);
  });

  it('only shows when nothing asks to keep an arrangement: no button, nothing to grab', async () => {
    await render(<BoardView items={fourItems} width={351} testID="board" />);

    expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull();
    expect(screen.queryByTestId('board-g1-handle')).toBeNull();
  });

  it('shows nothing but the well for an empty outfit', async () => {
    await render(<BoardView items={[]} width={351} testID="board" />);

    expect(screen.getByRole('image', { name: 'Outfit on a board: ' })).toBeOnTheScreen();
  });
});

describe('arranging the board', () => {
  /** The board on a screen that keeps what the person arranged, as an outfit does. */
  function Kept({ first, onArrange }: { first: Placement[] | null; onArrange: (layout: Placement[] | null) => void }) {
    const [layout, setLayout] = useState(first);
    const keep = (next: Placement[] | null) => {
      onArrange(next);
      setLayout(next);
    };
    return (
      <>
        <BoardView items={fourItems} width={351} layout={layout} onArrange={keep} testID="board" />
        <Scrolling />
      </>
    );
  }

  const open = async (layout: Placement[] | null = null) => {
    const onArrange = jest.fn();
    await render(<Kept first={layout} onArrange={onArrange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    return onArrange;
  };

  it('turns each garment into something to act on, by name, and holds the page still', async () => {
    await open();

    expect(screen.queryByRole('image', { name: /^Outfit on a board/ })).toBeNull();
    const shirt = screen.getByRole('adjustable', { name: 'Navy shirt' });
    expect(shirt.props.accessibilityActions.map((entry: { label: string }) => entry.label)).toEqual([
      'Bring to front',
      'Move left',
      'Move right',
      'Move up',
      'Move down',
      'Make bigger',
      'Make smaller',
    ]);
    expect(screen.getByRole('button', { name: 'Done' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull();
    expect(screen.getByTestId('scrolling')).toHaveTextContent('held');
    // Never smaller than a finger, however small the garment is drawn.
    for (const { clothing: garment } of fourItems) {
      const handle = lookOf(`board-${garment.id}-handle`);
      expect(handle.width).toBeGreaterThanOrEqual(44);
      expect(handle.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('moves and resizes a garment in fixed steps without a gesture, and keeps the arrangement on Done', async () => {
    const onArrange = await open();
    const shirt = placeOf(automatic, 'g1');

    await action('board-g1-handle', 'moveRight');
    await action('board-g1-handle', 'moveDown');
    await action('board-g1-handle', 'decrement');

    expect(drawn('g1').x).toBeCloseTo(shirt.x + 0.05, 4);
    expect(drawn('g1').y).toBeCloseTo(shirt.y + 0.05, 4);
    expect(drawn('g1').scale).toBeCloseTo(shirt.scale - 0.04, 4);
    expect(screen.getByRole('adjustable', { name: 'Navy shirt', selected: true })).toBeOnTheScreen();
    expect(screen.getByTestId('board-g1-selected')).toBeOnTheScreen();
    expect(onArrange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onArrange).toHaveBeenCalledTimes(1);
    const kept = onArrange.mock.calls[0][0] as Placement[];
    expect(kept).toHaveLength(4);
    expect(placeOf(kept, 'g1')).toEqual({ clothingId: 'g1', x: expect.closeTo(shirt.x + 0.05, 3), y: expect.closeTo(shirt.y + 0.05, 3), scale: expect.closeTo(shirt.scale - 0.04, 3), z: 3 });
    expect(placeOf(kept, 'g3').x).toBeCloseTo(placeOf(automatic, 'g3').x, 3);
    expect([...kept.map((placement) => placement.z)].sort()).toEqual([0, 1, 2, 3]);
    // What was kept stays on the board, which only shows again and lets the page go.
    expect(drawn('g1').x).toBeCloseTo(shirt.x + 0.05, 3);
    expect(screen.getByRole('button', { name: 'Arrange' })).toBeOnTheScreen();
    expect(screen.queryByTestId('board-g1-handle')).toBeNull();
    expect(screen.getByTestId('scrolling')).toHaveTextContent('free');
  });

  it('keeps a garment on the board and between its smallest and largest size', async () => {
    await open();

    for (let step = 0; step < 12; step += 1) {
      await action('board-g4-handle', 'moveLeft');
      await action('board-g4-handle', 'decrement');
    }

    expect(drawn('g4').scale).toBeCloseTo(0.12, 4);
    expect(drawn('g4').x).toBeCloseTo(0.06, 4);

    for (let step = 0; step < 20; step += 1) {
      await action('board-g4-handle', 'increment');
    }

    expect(drawn('g4').scale).toBeCloseTo(0.8, 4);
    expect(drawn('g4').x).toBeCloseTo(0.4, 4);
  });

  it('follows a finger: touching a garment chooses it and brings it to the front, dragging moves it', async () => {
    const onArrange = await open([
      { clothingId: 'g1', x: 0.4, y: 0.4, scale: 0.4, z: 0 },
      { clothingId: 'g2', x: 0.5, y: 0.4, scale: 0.4, z: 1 },
    ]);

    fireGestureHandler(getByGestureTestId('board-g1-drag'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 10, translationY: 0 },
      { translationX: 35.1, translationY: 46.8 },
      { state: State.END, translationX: 35.1, translationY: 46.8 },
    ]);
    await settle();

    expect(drawn('g1').x).toBeCloseTo(0.5, 4);
    expect(drawn('g1').y).toBeCloseTo(0.5, 4);
    expect(screen.getByTestId('board-g1-selected')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('board-g1').props.style).zIndex).toBeGreaterThan(StyleSheet.flatten(screen.getByTestId('board-g2').props.style).zIndex);

    // Far past the edge: the garment stops with all of it on the board.
    fireGestureHandler(getByGestureTestId('board-g1-drag'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 10, translationY: 0 },
      { translationX: 900, translationY: 0 },
      { state: State.END, translationX: 900, translationY: 0 },
    ]);
    await settle();
    expect(drawn('g1').x).toBeCloseTo(0.8, 4);

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    const kept = onArrange.mock.calls[0][0] as Placement[];
    expect(placeOf(kept, 'g1')).toMatchObject({ x: 0.8, y: 0.5, scale: 0.4 });
    expect(placeOf(kept, 'g1').z).toBeGreaterThan(placeOf(kept, 'g2').z);
  });

  it('resizes the chosen garment with two fingers anywhere on the board', async () => {
    const onArrange = await open();
    await action('board-g3-handle', 'activate');
    const before = drawn('g3');

    fireGestureHandler(getByGestureTestId('board-pinch'), [{ state: State.BEGAN, scale: 1 }, { state: State.ACTIVE, scale: 1 }, { scale: 1.5 }, { state: State.END, scale: 1.5 }]);
    await settle();

    expect(drawn('g3').scale).toBeCloseTo(before.scale * 1.5, 4);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(placeOf(onArrange.mock.calls[0][0] as Placement[], 'g3').scale).toBeCloseTo(before.scale * 1.5, 3);
  });

  it('keeps nothing when nothing was changed, or when only a garment of the automatic layout was touched', async () => {
    const onArrange = await open();

    await action('board-g2-handle', 'activate');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onArrange).not.toHaveBeenCalled();
    expectDrawnAt(automatic);
  });

  it('goes back to the automatic layout on Reset, gliding, and clears a stored arrangement on Done', async () => {
    const onArrange = await open([{ clothingId: 'g1', x: 0.3, y: 0.3, scale: 0.5, z: 0 }]);
    jest.mocked(withTiming).mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));

    expectDrawnAt(automatic);
    expect(glides()).toEqual(expect.arrayContaining([placeOf(automatic, 'g1').x, placeOf(automatic, 'g1').y, placeOf(automatic, 'g1').scale]));
    expect(onArrange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onArrange).toHaveBeenCalledWith(null);
    expectDrawnAt(automatic);
  });

  it('jumps instead of gliding under reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await open([{ clothingId: 'g1', x: 0.3, y: 0.3, scale: 0.5, z: 0 }]);
    jest.mocked(withTiming).mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));

    expectDrawnAt(automatic);
    expect(glides()).toEqual([]);
  });

  it('has nothing to clear when an automatic layout is reset', async () => {
    const onArrange = await open();

    await action('board-g1-handle', 'moveLeft');
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onArrange).not.toHaveBeenCalled();
  });

  it('throws the changes away when the board leaves the screen without Done', async () => {
    const onArrange = jest.fn();
    const view = await render(
      <>
        <BoardView items={fourItems} width={351} onArrange={onArrange} testID="board" />
        <Scrolling />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    await action('board-g1-handle', 'moveLeft');

    await view.rerender(<Scrolling />);

    expect(onArrange).not.toHaveBeenCalled();
    expect(screen.getByTestId('scrolling')).toHaveTextContent('free');
  });

  it('shows the outfit’s own arrangement again when what was kept is refused', async () => {
    const own: Placement[] = [{ clothingId: 'g1', x: 0.3, y: 0.3, scale: 0.5, z: 0 }];
    let refuse: () => void = () => undefined;
    const onArrange = jest.fn(() => new Promise<void>((_, reject) => (refuse = () => reject(new Error('refused')))));
    await render(<BoardView items={fourItems} width={351} layout={own} onArrange={onArrange} testID="board" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    await action('board-g1-handle', 'moveRight');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    // Shown as kept while the answer is on its way, though the outfit still carries the old arrangement.
    expect(drawn('g1').x).toBeCloseTo(0.35, 4);
    await act(async () => refuse());

    expect(drawn('g1').x).toBeCloseTo(0.3, 4);
  });
});

describe('holding a garment', () => {
  const impacts = () => jest.mocked(Haptics.impactAsync).mock.calls.map(([style]) => style);
  const own: Placement[] = [{ clothingId: 'g1', x: 0.4, y: 0.4, scale: 0.4, z: 0 }];

  /** Opens the board in arrange mode on a screen that keeps what was arranged. */
  async function arranging() {
    const onArrange = jest.fn();
    function Kept() {
      const [layout, setLayout] = useState<Placement[] | null>(own);
      return (
        <BoardView
          items={fourItems}
          width={351}
          layout={layout}
          onArrange={(next) => {
            onArrange(next);
            setLayout(next);
          }}
          testID="board"
        />
      );
    }

    await render(<Kept />);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    jest.mocked(Haptics.impactAsync).mockClear();
    return onArrange;
  }

  const drag = (...steps: { translationX: number; translationY?: number; state?: (typeof State)[keyof typeof State] }[]) =>
    fireGestureHandler(
      getByGestureTestId('board-g1-drag'),
      steps.map((step) => ({ translationY: 0, ...step })),
    );

  /** What the board sent to a timing, as [target, duration]. */
  const timed = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration]);

  it('lifts a little when touched and settles back over the press duration when let go', async () => {
    await arranging();
    jest.mocked(withTiming).mockClear();

    drag({ state: State.BEGAN, translationX: 0 }, { state: State.ACTIVE, translationX: 10 }, { translationX: 20 }, { state: State.END, translationX: 20 });
    await settle();

    expect(timed()).toEqual(expect.arrayContaining([[1, motion.press], [0, motion.press]]));
    // At rest again: full size, not the lifted 1.03.
    expect(drawn('g1').scale).toBeCloseTo(0.4, 4);
  });

  it('gives a cue for picking up, for crossing the edge once per crossing, and for letting go', async () => {
    await arranging();

    drag(
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 10 },
      // Past the edge, and further past it: one cue.
      { translationX: 400 },
      { translationX: 430 },
      // Back on the board, and out again: a second crossing, a second cue.
      { translationX: 0 },
      { translationX: 450 },
      { state: State.END, translationX: 450 },
    );
    await settle();

    expect(impacts()).toEqual(['light', 'rigid', 'rigid', 'soft']);
  });

  it('lets a garment lean past the edge only while the finger is down, then glides back inside, decelerating', async () => {
    const onArrange = await arranging();
    jest.mocked(withTiming).mockClear();

    drag({ state: State.BEGAN, translationX: 0 }, { state: State.ACTIVE, translationX: 10 }, { translationX: 900 }, { state: State.END, translationX: 900 });
    await settle();

    // The glide home over the enter duration (never a spring), and what is kept is the clamped place on the board.
    expect(jest.mocked(withTiming).mock.calls.filter(([to, config]) => to === 0 && (config as { duration: number }).duration === motion.enter)).toHaveLength(2);
    expect(drawn('g1').x).toBeCloseTo(0.8, 4);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(placeOf(onArrange.mock.calls[0][0] as Placement[], 'g1')).toMatchObject({ x: 0.8, y: 0.4, scale: 0.4 });
  });

  it('does not lift or lean under reduced motion, holds hard at the edge, and still gives the cues', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const onArrange = await arranging();
    jest.mocked(withTiming).mockClear();

    drag({ state: State.BEGAN, translationX: 0 }, { state: State.ACTIVE, translationX: 10 }, { translationX: 900 }, { state: State.END, translationX: 900 });
    await settle();

    expect(timed().filter(([to]) => to === 0)).toEqual([]);
    expect(timed()).not.toContainEqual([1, motion.press]);
    expect(drawn('g1').x).toBeCloseTo(0.8, 4);
    expect(impacts()).toEqual(['light', 'rigid', 'soft']);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(placeOf(onArrange.mock.calls[0][0] as Placement[], 'g1').x).toBeCloseTo(0.8, 3);
  });

  it('gives its own cue for going in, for Reset and for Done', async () => {
    await render(<BoardView items={fourItems} width={351} onArrange={jest.fn()} testID="board" />);
    jest.mocked(Haptics.impactAsync).mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(impacts()).toEqual(['medium', 'light', 'medium']);
  });

  it('is silent for a screen reader’s steps: they are not a drag', async () => {
    await arranging();

    await action('board-g1-handle', 'moveRight');

    expect(impacts()).toEqual([]);
  });
});
