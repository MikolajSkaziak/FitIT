import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion as useSystemReducedMotion, withDelay, withTiming } from 'react-native-reanimated';

import { Curtain, DrawLine, DropIn, estimateOf, Fade, heldScale, letterStep, Letters, liftOf, Nudge, PressScale, pressLook, ProgressFill, progressCeiling, Shiver, Spin, stagger, staggerOf, Stretch, Sway, useChanged, useEstimatedProgress, useHeld, useIntro, type Wait } from '@/components/motion';
import { easing, feel, motion } from '@/theme';

const durations: number[] = Object.values(motion);
const timings = () => jest.mocked(withTiming).mock.calls.map(([, config]) => (config as { duration: number }).duration);

describe('motion tokens', () => {
  it('has the four durations and the two curves of the profile, the one long move of a curtain and the steady sweep of a loading placeholder', () => {
    expect(motion).toEqual({ press: 100, exit: 150, enter: 200, sheet: 300, reveal: 450, sweep: 1200 });
    expect(easing).toEqual({ enter: [0.16, 1, 0.3, 1], exit: [0.7, 0, 0.84, 0] });
    expect(feel.pressScale).toBe(0.97);
  });
});

describe('reduced motion', () => {
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  it('takes the travel out and leaves it in otherwise', () => {
    expect(liftOf(6, true)).toBe(0);
    expect(liftOf(6, false)).toBe(6);
  });

  it('never scales a pressed surface, which only dims', () => {
    expect(pressLook(1, false)).toEqual({ scale: 0.97, opacity: 0.85 });
    expect(pressLook(1, true)).toEqual({ scale: 1, opacity: 0.85 });
    expect(pressLook(0, false)).toEqual({ scale: 1, opacity: 1 });
  });

  it('lets content rise by its distance, and only fade when movement is reduced', async () => {
    await render(
      <Fade rise={6} testID="fade">
        <Text>Hello</Text>
      </Fade>,
    );
    expect(screen.getByTestId('fade')).toHaveStyle({ opacity: 0, transform: [{ translateY: 6 }] });

    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    await render(
      <Fade rise={6} testID="still">
        <Text>Hello</Text>
      </Fade>,
    );
    expect(screen.getByTestId('still')).toHaveStyle({ opacity: 0, transform: [{ translateY: 0 }] });
  });

  it('keeps the fade itself when movement is reduced', async () => {
    jest.mocked(withTiming).mockClear();
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);

    await render(
      <Fade rise={6}>
        <Text>Hello</Text>
      </Fade>,
    );

    expect(jest.mocked(withTiming)).toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.enter }));
  });
});

describe('Fade', () => {
  beforeEach(() => jest.mocked(withTiming).mockClear());

  it('takes its duration from the tokens', async () => {
    await render(
      <Fade>
        <Text>Enter</Text>
      </Fade>,
    );
    await render(
      <Fade duration={motion.exit}>
        <Text>Quick</Text>
      </Fade>,
    );

    expect(timings()).toEqual([motion.enter, motion.exit]);
    expect(timings().every((duration) => durations.includes(duration))).toBe(true);
  });

  it('does not animate, and is fully there, when told not to', async () => {
    await render(
      <Fade enter={false} testID="fade">
        <Text>Still</Text>
      </Fade>,
    );

    expect(jest.mocked(withTiming)).not.toHaveBeenCalled();
    expect(screen.getByTestId('fade')).toHaveStyle({ opacity: 1 });
  });
});

describe('PressScale', () => {
  beforeEach(() => jest.mocked(withTiming).mockClear());

  it('presses in and out over the press duration and still presses', async () => {
    const press = jest.fn();
    await render(
      <PressScale accessibilityRole="button" accessibilityLabel="Open" onPress={press}>
        <Text>Open</Text>
      </PressScale>,
    );
    const button = screen.getByRole('button', { name: 'Open' });

    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);

    expect(jest.mocked(withTiming).mock.calls.slice(0, 2).map(([to, config]) => [to, (config as { duration: number }).duration])).toEqual([
      [1, motion.press],
      [0, motion.press],
    ]);
    expect(press).toHaveBeenCalledTimes(1);
  });
});

describe('staggered reveal', () => {
  it('starts the first items in turn and leaves the rest alone', () => {
    expect(staggerOf(0, true)).toEqual({ enter: true, delay: 0 });
    expect(staggerOf(stagger.limit - 1, true)).toEqual({ enter: true, delay: (stagger.limit - 1) * stagger.step });
    expect(staggerOf(stagger.limit, true).enter).toBe(false);
    expect(staggerOf(40, true).delay).toBe(stagger.limit * stagger.step);
  });

  it('does not animate at all outside the intro', () => {
    expect(staggerOf(0, false).enter).toBe(false);
  });

  it('is an intro from the first data until the first items have arrived, and never again', async () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = await renderHook<boolean, { ready: boolean }>(({ ready }) => useIntro(ready), { initialProps: { ready: false } });
      expect(result.current).toBe(false);

      await rerender({ ready: true });
      expect(result.current).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(stagger.limit * stagger.step + motion.enter);
      });
      expect(result.current).toBe(false);

      await rerender({ ready: false });
      await rerender({ ready: true });
      expect(result.current).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('useChanged', () => {
  it('tells a change from a first appearance', async () => {
    const { result, rerender } = await renderHook<boolean, { value: string }>(({ value }) => useChanged(value), { initialProps: { value: 'a' } });
    expect(result.current).toBe(false);

    await rerender({ value: 'b' });
    expect(result.current).toBe(true);
  });
});

describe('the estimate of a wait of unknown length', () => {
  const typical = 25_000;

  it('shows a sliver at the start, climbs, slows down, and never passes the ceiling however long it takes', () => {
    const samples = [0, 2000, 5000, 10_000, 25_000, 40_000, 120_000, 3_600_000].map((ms) => estimateOf(ms, typical));

    expect(samples[0]).toBeGreaterThan(0);
    expect(samples.every((value, index) => index === 0 || value >= samples[index - 1])).toBe(true);
    expect(Math.max(...samples)).toBeLessThanOrEqual(progressCeiling);
    expect(progressCeiling).toBeCloseTo(0.9);
    // Decelerating: the first ten seconds cover more than the next ten.
    expect(estimateOf(10_000, typical) - estimateOf(0, typical)).toBeGreaterThan(estimateOf(20_000, typical) - estimateOf(10_000, typical));
    expect(estimateOf(typical, typical)).toBeGreaterThan(0.8);
    expect(estimateOf(typical, typical)).toBeLessThan(progressCeiling);
  });
});

describe('useEstimatedProgress', () => {
  type Props = { wait: Wait };
  const run = () => renderHook<ReturnType<typeof useEstimatedProgress>, Props>(({ wait }) => useEstimatedProgress(wait, 25_000), { initialProps: { wait: 'running' } });
  const pass = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
    });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('only ever moves forward while running, and stays under the ceiling', async () => {
    const { result } = await run();
    const seen = [result.current.progress];
    for (let second = 0; second < 90; second++) {
      await pass(1000);
      seen.push(result.current.progress);
    }

    expect(seen.every((value, index) => index === 0 || value >= seen[index - 1])).toBe(true);
    expect(seen[seen.length - 1]).toBeGreaterThan(0.85);
    expect(Math.max(...seen)).toBeLessThanOrEqual(progressCeiling);
    expect(result.current.complete).toBe(false);
  });

  it('runs to the end when the work is done, and is complete once the bar has had time to get there', async () => {
    const { result, rerender } = await run();
    await pass(8000);
    expect(result.current.progress).toBeLessThan(progressCeiling);

    await rerender({ wait: 'done' });
    expect(result.current.progress).toBe(1);
    expect(result.current.complete).toBe(false);

    await pass(motion.enter);
    expect(result.current.complete).toBe(true);
  });

  it('stops where it was when the work failed, and does not creep on', async () => {
    const { result, rerender } = await run();
    await pass(6000);
    await rerender({ wait: 'stopped' });
    const held = result.current.progress;

    await pass(60_000);
    expect(result.current.progress).toBe(held);
    expect(result.current.complete).toBe(false);
  });

  it('starts over from the beginning when the work is tried again', async () => {
    const { result, rerender } = await run();
    await pass(30_000);
    await rerender({ wait: 'stopped' });
    const before = result.current.progress;

    await rerender({ wait: 'running' });
    expect(result.current.progress).toBeLessThan(before);
    expect(result.current.complete).toBe(false);
  });
});

describe('Curtain', () => {
  const halves = (phase: 'closed' | 'opening' | 'open') => (
    <Curtain phase={phase} width={200} left={<Text>Left half</Text>} right={<Text>Right half</Text>} testID="curtain">
      <Text>Behind</Text>
    </Curtain>
  );
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  it('hangs shut over what is behind it, and leaves nothing of itself once it is open', async () => {
    const { rerender } = await render(halves('closed'));
    expect(screen.getByTestId('curtain', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Behind')).toBeOnTheScreen();

    await rerender(halves('open'));
    expect(screen.queryByTestId('curtain', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Behind')).toBeOnTheScreen();
  });

  it('draws aside over the reveal duration, with the decelerating curve and no spring', async () => {
    jest.mocked(withTiming).mockClear();
    const { rerender } = await render(halves('closed'));
    await rerender(halves('opening'));

    expect(jest.mocked(withTiming)).toHaveBeenCalledWith(1, expect.objectContaining({ duration: motion.reveal }));
  });

  it('only fades out under reduced motion, over the ordinary enter duration', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    jest.mocked(withTiming).mockClear();
    const { rerender } = await render(halves('closed'));
    await rerender(halves('opening'));

    expect(timings()).toEqual([motion.enter]);
  });
});

describe('a piece held in a finger', () => {
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  it('is drawn 3% larger when fully lifted, and at its own size at rest', () => {
    expect(feel.liftScale).toBe(1.03);
    expect(heldScale(0)).toBe(1);
    expect(heldScale(1)).toBeCloseTo(1.03, 6);
    expect(heldScale(0.5)).toBeCloseTo(1.015, 6);
  });

  it('lifts over the press duration, leans by what it is given, and glides home over the enter duration', async () => {
    const held = (await renderHook(() => useHeld())).result.current;
    jest.mocked(withTiming).mockClear();

    held.hold();
    held.pull(12, -5);
    expect(held.lifted.value).toBe(1);
    expect([held.pullX.value, held.pullY.value]).toEqual([12, -5]);

    held.release();
    expect([held.lifted.value, held.pullX.value, held.pullY.value]).toEqual([0, 0, 0]);
    expect(jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration])).toEqual([
      [1, motion.press],
      [0, motion.press],
      [0, motion.enter],
      [0, motion.enter],
    ]);
  });

  it('never lifts or glides under reduced motion', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    const held = (await renderHook(() => useHeld())).result.current;
    jest.mocked(withTiming).mockClear();

    held.hold();
    held.release();

    expect(held.reduced).toBe(true);
    expect(held.lifted.value).toBe(0);
    expect(jest.mocked(withTiming)).not.toHaveBeenCalled();
  });
});

describe('Fade leaving', () => {
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  const leaving = (testID: string) => screen.getByTestId(testID).props.exiting;

  it('has no exit unless asked for one', async () => {
    await render(
      <Fade testID="plain">
        <Text>Hello</Text>
      </Fade>,
    );

    expect(leaving('plain')).toBeUndefined();
  });

  it('fades out when asked, and also shrinks when asked to shrink', async () => {
    await render(
      <>
        <Fade exit testID="fades">
          <Text>Hello</Text>
        </Fade>
        <Fade exit shrink testID="shrinks">
          <Text>Hello</Text>
        </Fade>
      </>,
    );

    expect(leaving('fades')).toBeDefined();
    expect(typeof leaving('shrinks')).toBe('function');
    expect(leaving('shrinks')().animations).toHaveProperty('transform');
    expect(leaving('shrinks')().initialValues).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
    expect(typeof leaving('fades')).not.toBe('function');
  });

  it('only fades under reduced motion, even when asked to shrink', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    await render(
      <Fade exit shrink testID="shrinks">
        <Text>Hello</Text>
      </Fade>,
    );

    expect(typeof leaving('shrinks')).not.toBe('function');
    expect(leaving('shrinks')).toBeDefined();
  });
});

describe('ProgressFill', () => {
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));
  const timedTo = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration]);

  it('grows from where it is told to start, over the duration it is given', async () => {
    jest.mocked(withTiming).mockClear();

    await render(<ProgressFill progress={0.4} from={0.2} delay={motion.exit} duration={motion.sheet} />);

    expect(timedTo()).toEqual([[0.4, motion.sheet]]);
  });

  it('just fills to the progress, over the enter duration, when it has nowhere to start from', async () => {
    jest.mocked(withTiming).mockClear();

    await render(<ProgressFill progress={0.4} />);

    expect(timedTo()).toEqual([[0.4, motion.enter]]);
  });

  it('jumps to the progress under reduced motion when it was told where to start', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    jest.mocked(withTiming).mockClear();

    await render(<ProgressFill progress={0.4} from={0.2} delay={motion.exit} duration={motion.sheet} />);

    expect(timedTo()).toEqual([]);
  });
});

describe('kinetic details', () => {
  const steps = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration] as [number, number]);

  beforeEach(() => jest.mocked(withTiming).mockClear());
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  describe('Shiver', () => {
    const tick = motion.press / 2;

    it('shakes five times by 1.5 points, a half press each, and settles at 0', async () => {
      await render(
        <Shiver testID="shiver">
          <Text>colder</Text>
        </Shiver>,
      );

      expect(steps()).toEqual([[1.5, tick], [-1.5, tick], [1.5, tick], [-1.5, tick], [0, tick]]);
      expect(steps().reduce((sum, [, duration]) => sum + duration, 0)).toBeLessThanOrEqual(motion.reveal);
      expect(screen.getByTestId('shiver')).toHaveStyle({ transform: [{ translateX: 0 }] });
    });

    it('stays still on mount when asked to skip the first, and plays when the key then changes to a truthy one', async () => {
      const word = (play: boolean) => (
        <Shiver play={play} skipFirst>
          <Text>colder</Text>
        </Shiver>
      );
      const { rerender } = await render(word(false));
      expect(steps()).toEqual([]);

      await rerender(word(true));
      expect(steps()).toHaveLength(5);

      await rerender(word(false));
      expect(steps()).toHaveLength(5);

      await rerender(word(true));
      expect(steps()).toHaveLength(10);
    });

    it('does not play for the key it was first shown with when it skips the first', async () => {
      await render(
        <Shiver play skipFirst>
          <Text>colder</Text>
        </Shiver>,
      );

      expect(steps()).toEqual([]);
    });

    it('does nothing at all under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await render(
        <Shiver testID="shiver">
          <Text>colder</Text>
        </Shiver>,
      );

      expect(steps()).toEqual([]);
      expect(screen.getByTestId('shiver')).toHaveStyle({ transform: [{ translateX: 0 }] });
    });
  });

  describe('Nudge', () => {
    it('goes out and comes back in two steps of the exit duration, which is the sheet duration in all', async () => {
      await render(
        <Nudge dy={-2} dimTo={0.6} testID="nudge">
          <Text>warmer</Text>
        </Nudge>,
      );

      expect(steps()).toEqual([[1, motion.exit], [0, motion.exit]]);
      expect(motion.exit * 2).toBe(motion.sheet);
      expect(steps().at(-1)).toEqual([0, motion.exit]);
      expect(screen.getByTestId('nudge')).toHaveStyle({ opacity: 1 });
    });

    it('replays when the key changes, and does nothing under reduced motion', async () => {
      const mark = (play: boolean) => (
        <Nudge dy={3} play={play} skipFirst>
          <Text>drop</Text>
        </Nudge>
      );
      const { rerender } = await render(mark(false));
      await rerender(mark(true));
      expect(steps()).toHaveLength(2);

      jest.mocked(withTiming).mockClear();
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await rerender(mark(false));
      await rerender(mark(true));
      expect(steps()).toEqual([]);
    });
  });

  describe('Spin', () => {
    it('turns once over the enter duration and is upright at the end', async () => {
      await render(
        <Spin degrees={60} testID="spin">
          <Text>*</Text>
        </Spin>,
      );

      expect(steps()).toEqual([[1, motion.enter]]);
      expect(screen.getByTestId('spin')).toHaveStyle({ transform: [{ rotate: '0deg' }] });
    });

    it('waits for its key, and does nothing under reduced motion', async () => {
      const mark = (play: boolean) => (
        <Spin degrees={45} play={play} skipFirst>
          <Text>*</Text>
        </Spin>
      );
      const { rerender } = await render(mark(false));
      expect(steps()).toEqual([]);
      await rerender(mark(true));
      expect(steps()).toEqual([[1, motion.enter]]);

      jest.mocked(withTiming).mockClear();
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await rerender(mark(false));
      await rerender(mark(true));
      expect(steps()).toEqual([]);
    });
  });

  describe('Sway', () => {
    it('swings through +4, -2 and 0 degrees in three steps of the exit duration and hangs from its top centre', async () => {
      await render(
        <Sway testID="sway">
          <Text>hanger</Text>
        </Sway>,
      );

      expect(steps()).toEqual([[4, motion.exit], [-2, motion.exit], [0, motion.exit]]);
      expect(motion.exit * 3).toBeLessThanOrEqual(motion.reveal);
      expect(screen.getByTestId('sway')).toHaveStyle({ transformOrigin: '50% 0%' });
    });

    it('is drawn at -6 degrees from its first frame, so it never jumps into its swing', async () => {
      await render(
        <Sway testID="sway">
          <Text>hanger</Text>
        </Sway>,
      );

      expect(screen.getByTestId('sway')).toHaveStyle({ transform: [{ rotate: '-6deg' }] });
    });

    it('is simply upright and still under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await render(
        <Sway testID="sway">
          <Text>hanger</Text>
        </Sway>,
      );

      expect(steps()).toEqual([]);
      expect(screen.getByTestId('sway')).toHaveStyle({ transform: [{ rotate: '0deg' }] });
    });
  });

  describe('Sway soft', () => {
    it('swings -3, +2 and 0 degrees from upright, wound up over a press and two exits (400ms), and is not drawn tilted', async () => {
      await render(
        <Sway soft testID="sway">
          <Text>wear</Text>
        </Sway>,
      );

      expect(steps()).toEqual([[-3, motion.press], [2, motion.exit], [0, motion.exit]]);
      expect(steps().reduce((sum, [, duration]) => sum + duration, 0)).toBeLessThanOrEqual(motion.reveal);
      expect(screen.getByTestId('sway')).toHaveStyle({ transformOrigin: '50% 0%', transform: [{ rotate: '0deg' }] });
    });

    it('does nothing under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await render(
        <Sway soft>
          <Text>wear</Text>
        </Sway>,
      );

      expect(steps()).toEqual([]);
    });
  });

  describe('Stretch', () => {
    it('goes out and back in two steps of the exit duration, around its left edge, and rests at full width', async () => {
      jest.mocked(withDelay).mockClear();
      await render(
        <Stretch delay={motion.sheet} testID="stretch">
          <Text>shape</Text>
        </Stretch>,
      );

      expect(steps()).toEqual([[1, motion.exit], [0, motion.exit]]);
      expect(steps().reduce((sum, [, duration]) => sum + duration, 0)).toBeLessThanOrEqual(motion.reveal);
      expect(jest.mocked(withDelay).mock.calls.map(([delay]) => delay)).toEqual([motion.sheet]);
      expect(screen.getByTestId('stretch')).toHaveStyle({ transformOrigin: 'left center', transform: [{ scaleX: 1 }] });
    });

    it('replays when its key turns truthy, and does nothing under reduced motion', async () => {
      const word = (play: boolean) => (
        <Stretch play={play} skipFirst>
          <Text>shape</Text>
        </Stretch>
      );
      const { rerender } = await render(word(false));
      expect(steps()).toEqual([]);
      await rerender(word(true));
      expect(steps()).toHaveLength(2);

      jest.mocked(withTiming).mockClear();
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await rerender(word(false));
      await rerender(word(true));
      expect(steps()).toEqual([]);
    });
  });

  describe('Letters', () => {
    const starts = () => jest.mocked(withDelay).mock.calls.map(([delay]) => delay);
    // The fading layer around a letter: the nearest host view above its text.
    const letter = (text: string) => {
      let node = screen.getByText(text).parent;
      while (node && node.type !== 'View') {
        node = node.parent;
      }

      return node;
    };

    it('is one text per letter, each fading in over the exit duration, half a press after the one before', async () => {
      jest.mocked(withDelay).mockClear();
      await render(<Letters text="colors" variant="displayItalic" color="action" delay={motion.sheet} testID="letters" />);

      expect(within(screen.getByTestId('letters')).getAllByText(/^[a-z]$/)).toHaveLength(6);
      expect(steps()).toEqual(Array.from({ length: 6 }, () => [1, motion.exit]));
      expect(starts()).toEqual([0, 1, 2, 3, 4, 5].map((index) => motion.sheet + (index * motion.press) / 2));
    });

    it('finishes within the reveal duration however long the word is, by stepping faster', async () => {
      expect(letterStep(1)).toBe(0);
      expect(letterStep(6)).toBe(motion.press / 2);
      for (const count of [2, 6, 7, 8, 12, 20]) {
        expect((count - 1) * letterStep(count) + motion.exit).toBeLessThanOrEqual(motion.reveal);
      }

      jest.mocked(withDelay).mockClear();
      await render(<Letters text="abcdefghijkl" variant="displayItalic" />);
      expect((starts().at(-1) ?? 0) + motion.exit).toBeLessThanOrEqual(motion.reveal);
    });

    it('starts every letter invisible and, at rest, shows them all', async () => {
      await render(<Letters text="ab" variant="displayItalic" testID="letters" />);

      expect(screen.getByTestId('letters')).toBeOnTheScreen();
      expect(letter('a')).toHaveStyle({ opacity: 0 });
    });

    it('is simply there under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      jest.mocked(withDelay).mockClear();
      await render(<Letters text="colors" variant="displayItalic" testID="letters" />);

      expect(steps()).toEqual([]);
      expect(starts()).toEqual([]);
      expect(letter('c')).toHaveStyle({ opacity: 1 });
    });
  });

  describe('DropIn', () => {
    it('is hidden, 6 points above its place, from its first frame, and arrives over the enter duration', async () => {
      await render(
        <DropIn delay={motion.sheet} testID="drop">
          <Text>.</Text>
        </DropIn>,
      );

      expect(steps()).toEqual([[1, motion.enter]]);
      expect(screen.getByTestId('drop')).toHaveStyle({ opacity: 0, transform: [{ translateY: -6 }] });
    });

    it('is simply there under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await render(
        <DropIn delay={motion.sheet} testID="drop">
          <Text>.</Text>
        </DropIn>,
      );

      expect(steps()).toEqual([]);
      expect(screen.getByTestId('drop')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
    });
  });

  describe('DrawLine', () => {
    it('starts with no length, draws from the left edge over the sheet duration to full length, and stays', async () => {
      await render(<DrawLine delay={motion.enter} testID="line" />);

      expect(steps()).toEqual([[1, motion.sheet]]);
      expect(screen.getByTestId('line')).toHaveStyle({ transformOrigin: 'left center', transform: [{ scaleX: 0 }] });
    });

    it('is simply there under reduced motion', async () => {
      jest.mocked(useSystemReducedMotion).mockReturnValue(true);
      await render(<DrawLine delay={motion.enter} testID="line" />);

      expect(steps()).toEqual([]);
      expect(screen.getByTestId('line')).toHaveStyle({ transform: [{ scaleX: 1 }] });
    });
  });
});

describe('Shimmer', () => {
  afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

  it('sweeps a band of light across a placeholder once it knows how wide the placeholder is', async () => {
    const { Shimmer } = jest.requireActual<typeof import('@/components/motion')>('@/components/motion');
    await render(<Shimmer color="#FFFFFF" />);
    const layer = screen.getByTestId('shimmer');
    expect(layer.children).toHaveLength(0);

    await fireEvent(layer, 'layout', { nativeEvent: { layout: { width: 200, height: 40 } } });

    expect(screen.getByTestId('shimmer').children.length).toBeGreaterThan(0);
  });

  it('stays still under reduced motion', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    const { Shimmer } = jest.requireActual<typeof import('@/components/motion')>('@/components/motion');
    await render(<Shimmer color="#FFFFFF" />);
    await fireEvent(screen.getByTestId('shimmer'), 'layout', { nativeEvent: { layout: { width: 200, height: 40 } } });

    expect(screen.getByTestId('shimmer').children).toHaveLength(0);
  });
});
