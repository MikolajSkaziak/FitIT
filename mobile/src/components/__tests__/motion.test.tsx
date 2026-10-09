import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion as useSystemReducedMotion, withTiming } from 'react-native-reanimated';

import { Fade, liftOf, PressScale, pressLook, stagger, staggerOf, useChanged, useIntro } from '@/components/motion';
import { easing, feel, motion } from '@/theme';

const durations: number[] = Object.values(motion);
const timings = () => jest.mocked(withTiming).mock.calls.map(([, config]) => (config as { duration: number }).duration);

describe('motion tokens', () => {
  it('has the four durations and the two curves of the profile', () => {
    expect(motion).toEqual({ press: 100, exit: 150, enter: 200, sheet: 300 });
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
