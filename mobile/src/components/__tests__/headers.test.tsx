import { render, screen, within } from '@testing-library/react-native';
import { useReducedMotion as useSystemReducedMotion, withDelay, withTiming } from 'react-native-reanimated';

import { TitleBlock, type TitleAccent } from '@/components/headers';
import { motion, palettes, typography } from '@/theme';

const timed = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration] as [number, number]);
const delays = () => jest.mocked(withDelay).mock.calls.map(([delay]) => delay);
// The pieces of a title are hidden from screen readers (the row carries the sentence), so a test must ask for them.
const piece = { hidden: true } as const;
const accentOf = () => screen.getByTestId('title-accent', piece);

beforeEach(() => {
  jest.mocked(withTiming).mockClear();
  jest.mocked(withDelay).mockClear();
});
afterEach(() => jest.mocked(useSystemReducedMotion).mockReturnValue(false));

describe('TitleBlock accent', () => {
  const sentence = 'Who are we dressing?';

  it('is still one header with the whole sentence as its label, and no piece of it is read separately', async () => {
    await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'shiver' }} />);

    const header = screen.getByRole('header', { name: sentence });
    expect(header).toBeOnTheScreen();
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(within(header).getByTestId('title-accent', piece)).toHaveTextContent('dressing');
  });

  it('sets the accent word in the italic twin of the title size and the action colour, and the rest upright', async () => {
    await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'tap' }} />);

    expect(accentOf()).toHaveStyle({ fontFamily: typography.displayItalic.fontFamily });
    expect(accentOf()).toHaveStyle({ color: palettes.light.action });
    expect(screen.getByText('Who', piece)).toHaveStyle({ fontFamily: typography.display.fontFamily });
  });

  it('uses the compact heading and its italic twin on a compact title', async () => {
    await render(<TitleBlock compact title="What do you like to wear?" accent={{ word: 'wear', act: 'none' }} />);

    expect(accentOf()).toHaveStyle({ fontFamily: typography.headingItalic.fontFamily });
  });

  it('keeps the line height of the upright words, so the line does not grow', async () => {
    await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'none' }} />);

    expect(accentOf()).toHaveStyle({ lineHeight: typography.display.lineHeight });
  });

  it('finds the word before its punctuation, and the first one that matches', async () => {
    await render(<TitleBlock title={'Where are\nyou?'} accent={{ word: 'Where', act: 'drop' }} />);

    expect(accentOf()).toHaveTextContent('Where');
    expect(screen.getByRole('header', { name: 'Where are\nyou?' })).toBeOnTheScreen();
  });

  it('falls back to a plain title when the word is not one of its words, or differs in case or length', async () => {
    for (const word of ['cold', 'Dressing', 'dress', 'are we', '']) {
      await render(<TitleBlock title={sentence} accent={{ word, act: 'shiver' }} />);
      expect(screen.queryByTestId('title-accent', piece)).toBeNull();
      expect(screen.getByRole('header', { name: sentence })).toBeOnTheScreen();
    }
  });

  it('waits for the sheet duration before each act, and each act is the one asked for', async () => {
    const acts: [TitleAccent['act'], [number, number][]][] = [
      ['shiver', [[1.5, 50], [-1.5, 50], [1.5, 50], [-1.5, 50], [0, 50]]],
      ['tap', [[1, motion.exit], [0, motion.exit]]],
      ['rise', [[1, motion.exit], [0, motion.exit]]],
      ['stretch', [[1, motion.exit], [0, motion.exit]]],
      ['sway', [[-3, motion.press], [2, motion.exit], [0, motion.exit]]],
      ['drop', [[1, motion.enter]]],
    ];
    for (const [act, steps] of acts) {
      jest.mocked(withTiming).mockClear();
      jest.mocked(withDelay).mockClear();
      await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act }} />);

      expect(screen.getByTestId(`title-accent-${act}`)).toBeOnTheScreen();
      expect(timed()).toEqual(steps);
      expect(delays()).toEqual([motion.sheet]);
      expect(steps.reduce((sum, [, duration]) => sum + duration, 0)).toBeLessThanOrEqual(motion.reveal);
    }
  });

  it('draws the letters of a letters accent one after another, each its own text, all within the reveal', async () => {
    await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'letters' }} />);

    const word = accentOf();
    expect(word).toHaveTextContent('dressing');
    expect(within(word).getAllByText(/^[a-z]$/, piece)).toHaveLength(8);
    expect(screen.getByTestId('title-accent-letters', piece)).toBeOnTheScreen();
    const starts = delays();
    expect(starts).toHaveLength(8);
    expect(starts[0]).toBe(motion.sheet);
    expect(starts.slice(1).every((start, index) => start > (starts[index] ?? 0))).toBe(true);
    expect((starts.at(-1) ?? 0) - motion.sheet + motion.exit).toBeLessThanOrEqual(motion.reveal);
  });

  it('plays an act once: a new render of the same title does not play it again', async () => {
    const { rerender } = await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'shiver' }} />);
    expect(timed()).toHaveLength(5);

    await rerender(<TitleBlock title={sentence} lead="Something" accent={{ word: 'dressing', act: 'shiver' }} />);
    expect(timed()).toHaveLength(5);
  });

  it('plays nothing at all under reduced motion, and the word is simply there', async () => {
    jest.mocked(useSystemReducedMotion).mockReturnValue(true);
    for (const act of ['shiver', 'tap', 'rise', 'stretch', 'sway', 'drop', 'letters'] as const) {
      await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act }} />);
      expect(timed()).toEqual([]);
      expect(delays()).toEqual([]);
    }

    await render(<TitleBlock title={sentence} accent={{ word: 'dressing', act: 'drop' }} />);
    expect(screen.getByTestId('title-accent-drop')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
  });

  it('plays the replays of its keys when they turn truthy, and not for the key it opened with', async () => {
    const title = (cold: boolean, warm: boolean) => <TitleBlock title="How you feel the cold" accent={{ word: 'cold', act: 'shiver', replay: { shiver: cold, rise: warm } }} />;
    const { rerender } = await render(title(true, false));
    // The arrival shiver only: the replay of a key already truthy on mount waits.
    expect(timed()).toHaveLength(5);

    jest.mocked(withTiming).mockClear();
    await rerender(title(false, true));
    expect(timed()).toEqual([[1, motion.exit], [0, motion.exit]]);

    jest.mocked(withTiming).mockClear();
    await rerender(title(false, false));
    expect(timed()).toEqual([]);

    await rerender(title(true, false));
    expect(timed()).toHaveLength(5);
  });
});

describe('TitleBlock underlined', () => {
  it('makes the underlined word the accent at rest, with the line under it', async () => {
    await render(<TitleBlock title="You’re set" underlined />);

    expect(screen.getByRole('header', { name: 'You’re set' })).toBeOnTheScreen();
    expect(accentOf()).toHaveTextContent('set');
    expect(screen.getByTestId('title-accent-none')).toBeOnTheScreen();
    expect(screen.getByTestId('title-underline')).toBeOnTheScreen();
  });

  it('keeps the line under the last word when another word is the accent', async () => {
    await render(<TitleBlock title="Your first look is ready" underlined accent={{ word: 'first', act: 'tap' }} />);

    expect(accentOf()).toHaveTextContent('first');
    expect(screen.getByTestId('title-underline')).toBeOnTheScreen();
  });

  it('draws the line as well when the accent is the last word, and for a title that is not a string it draws none', async () => {
    await render(<TitleBlock title="Your first look is ready" underlined accent={{ word: 'ready', act: 'shiver' }} />);
    expect(screen.getByTestId('title-accent-shiver')).toBeOnTheScreen();
    expect(screen.getByTestId('title-underline')).toBeOnTheScreen();

    await render(<TitleBlock title={<>Plain</>} underlined />);
    expect(screen.queryByTestId('title-underline')).toBeNull();
  });

  it('is a plain header without accent or line', async () => {
    await render(<TitleBlock title="Create account" />);

    expect(screen.getByRole('header', { name: 'Create account' })).toBeOnTheScreen();
    expect(screen.queryByTestId('title-accent', piece)).toBeNull();
  });
});
