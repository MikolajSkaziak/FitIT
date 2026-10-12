import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import type { Gender, ThermalPreference } from '@/api/account';
import { thermalPictures } from '@/components/brand';
import { ThermalPicker } from '@/features/profile/ThermalPicker';
import { thermalLooks, thermalOrder, thermalSetOf } from '@/features/profile/thermal';
import { motion } from '@/theme';

const thermalOptionName = { runs_cold: 'I get cold easily', normal: 'About average', runs_warm: 'I run warm' } as const;
const select = jest.mocked(Haptics.selectionAsync);
const impact = jest.mocked(Haptics.impactAsync);

beforeEach(() => jest.clearAllMocks());

function Picker({ start = 'normal', gender = 'female', shapeGender, compact }: { start?: ThermalPreference; gender?: Gender | null; shapeGender?: Gender | null; compact?: boolean }) {
  const [value, setValue] = useState<ThermalPreference>(start);
  return <ThermalPicker value={value} onChange={setValue} gender={gender} shapeGender={shapeGender} compact={compact} />;
}

const layout = (width: number) => fireEvent(screen.getByTestId('thermal-track'), 'layout', { nativeEvent: { layout: { width, height: 1, x: 0, y: 0 } } });
const opacityOf = (answer: string) => screen.getByTestId(`thermal-picture-${answer}`).parent;

describe('the thermal picker', () => {
  it('is a group of three radios, cold to warm, each with its own name and the chosen one checked', async () => {
    await render(<Picker />);

    expect(screen.getByTestId('thermal-scale').props).toMatchObject({ accessibilityRole: 'radiogroup' });
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual(['I get cold easily', 'About average', 'I run warm']);
    expect(screen.getByRole('radio', { name: 'About average' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'I run warm' })).not.toBeChecked();
  });

  it('shows the picture and the care label of the chosen answer, and the sentence of what it changes', async () => {
    await render(<Picker />);
    expect(screen.getByTestId('thermal-effect')).toHaveTextContent('fitit. dresses you for the forecast as it is.');
    expect(screen.getByTestId('thermal-picture').props.accessibilityLabel).toBe('A mannequin in a knit over a shirt. As the forecast says');
    expect(screen.getByTestId('thermal-care-normal')).toHaveTextContent('As the forecast says');

    await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
    expect(screen.getByTestId('thermal-effect')).toHaveTextContent('fitit. dresses you as if it were 3° colder than the forecast says.');
    expect(screen.getByTestId('thermal-picture').props.accessibilityLabel).toBe('A mannequin in a coat, a knit and a scarf. Dressed for 3° colder');

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));
    expect(screen.getByTestId('thermal-effect')).toHaveTextContent('fitit. dresses you as if it were 3° warmer than the forecast says.');
    expect(screen.getByTestId('thermal-picture').props.accessibilityLabel).toBe('A mannequin in a T-shirt. Dressed for 3° warmer');
  });

  it('cross-fades the pictures: the chosen one is at full strength and the others are gone, over the enter duration', async () => {
    await render(<Picker />);
    expect(opacityOf('normal')).toHaveStyle({ opacity: 1 });
    expect(opacityOf('runs_cold')).toHaveStyle({ opacity: 0 });
    jest.mocked(withTiming).mockClear();

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));

    expect(opacityOf('runs_warm')).toHaveStyle({ opacity: 1 });
    expect(opacityOf('normal')).toHaveStyle({ opacity: 0 });
    const durations = jest.mocked(withTiming).mock.calls.map(([, config]) => (config as { duration: number }).duration);
    expect(durations).toContain(motion.enter);
  });

  it('slides the marker to the chosen stop with a translation over the enter duration', async () => {
    await render(<Picker />);
    expect(screen.queryByTestId('thermal-marker')).toBeNull();
    await layout(300);
    expect(screen.getByTestId('thermal-marker')).toHaveStyle({ width: 100 });
    jest.mocked(withTiming).mockClear();

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));

    const slides = jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));
    expect(slides).toContainEqual({ to: 200, duration: motion.enter });
  });

  it('has its own feel for each stop: soft for cold, a tick for average, rigid for warm, and nothing when the chosen one is pressed again', async () => {
    await render(<Picker />);

    await fireEvent.press(screen.getByRole('radio', { name: 'About average' }));
    expect(select).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
    expect(impact.mock.calls).toEqual([['soft']]);

    await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
    expect(impact.mock.calls).toEqual([['soft']]);

    await fireEvent.press(screen.getByRole('radio', { name: 'About average' }));
    expect(select).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('radio', { name: 'I run warm' }));
    expect(impact.mock.calls).toEqual([['soft'], ['rigid']]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('shows the pictures of the set for the gender: the men’s for a man, the women’s for a woman, and for the rest the body shape’s set or the women’s', async () => {
    expect(thermalSetOf('male')).toBe('m');
    expect(thermalSetOf('female')).toBe('f');
    expect(thermalSetOf('non_binary')).toBe('f');
    expect(thermalSetOf('unspecified')).toBe('f');
    expect(thermalSetOf(null)).toBe('f');
    expect(thermalSetOf('non_binary', 'male')).toBe('m');
    expect(thermalSetOf('unspecified', 'female')).toBe('f');
    expect(thermalSetOf('female', 'male')).toBe('f');

    await render(<Picker gender="male" />);
    expect(screen.getByTestId('thermal-picture-runs_cold').props.source).toEqual([thermalPictures.m.runs_cold]);
  });

  it('follows the body shape for a person who is not tied to a set', async () => {
    await render(<Picker gender="unspecified" shapeGender="male" />);

    expect(screen.getByTestId('thermal-picture-normal').props.source).toEqual([thermalPictures.m.normal]);
  });

  it('is the same control in its compact form: a small picture beside the sentence, no care label', async () => {
    await render(<Picker compact start="runs_warm" />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'I run warm' })).toBeChecked();
    expect(screen.queryByTestId('thermal-care-runs_warm')).toBeNull();
    expect(screen.getByTestId('thermal-picture-runs_warm').props.source).toEqual([thermalPictures.f.runs_warm]);
    expect(screen.getByTestId('thermal-effect')).toHaveTextContent(/3° warmer/);
  });
});

describe('the kinetic details of the picker', () => {
  afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  const timings = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration] as const);
  const count = (to: number, duration: number) => timings().filter(([target, length]) => target === to && length === duration).length;
  /** The steps of a shiver: five in the sentence and five in the care label. */
  const shivers = () => timings().filter(([, length]) => length === motion.press / 2).length;
  const choose = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));

  it('keeps the sentence as one accessibility label, whatever the answer, and hides its pieces', async () => {
    await render(<Picker start="runs_cold" />);

    for (const answer of thermalOrder) {
      await choose(thermalOptionName[answer]);
      const effect = screen.getByTestId('thermal-effect');
      expect(effect.props).toMatchObject({ accessible: true, accessibilityLabel: thermalLooks[answer].effect, accessibilityLiveRegion: 'polite' });
      expect(effect).toHaveTextContent(thermalLooks[answer].effect);
    }
  });

  it('shivers "colder" in the sentence and in the care label when the answer changes to cold, and not again for the same answer', async () => {
    await render(<Picker />);
    expect(shivers()).toBe(0);
    jest.mocked(withTiming).mockClear();

    await choose('I get cold easily');
    expect(screen.getByTestId('thermal-effect-shiver')).toBeOnTheScreen();
    expect(screen.getByTestId('thermal-care-runs_cold-shiver')).toBeOnTheScreen();
    expect(shivers()).toBe(10);
    expect(timings().filter(([, length]) => length === motion.press / 2).map(([to]) => to)).toEqual([1.5, -1.5, 1.5, -1.5, 0, 1.5, -1.5, 1.5, -1.5, 0]);

    await choose('I get cold easily');
    expect(shivers()).toBe(10);
  });

  it('stays still for the answer that is already chosen when the picker opens, and shivers when the person comes back to it', async () => {
    await render(<Picker start="runs_cold" />);
    expect(shivers()).toBe(0);

    await choose('About average');
    expect(shivers()).toBe(0);

    await choose('I get cold easily');
    expect(shivers()).toBe(10);
  });

  it('lifts "warmer" while it dims to 0.6 when the answer changes to warm, and does nothing for average', async () => {
    await render(<Picker start="runs_cold" />);
    jest.mocked(withTiming).mockClear();

    await choose('About average');
    expect(screen.queryByTestId('thermal-effect-heat')).toBeNull();
    expect(screen.queryByTestId('thermal-effect-shiver')).toBeNull();
    expect(shivers()).toBe(0);

    jest.mocked(withTiming).mockClear();
    await choose('I run warm');
    expect(screen.getByTestId('thermal-effect-heat')).toBeOnTheScreen();
    expect(screen.getByTestId('thermal-care-runs_warm-heat')).toBeOnTheScreen();
    // Out and back in two steps of the exit duration, in the sentence and in the care label.
    expect(count(0, motion.exit)).toBe(2);
    expect(shivers()).toBe(0);
  });

  it('does not move the preselected warm answer on mount', async () => {
    await render(<Picker start="runs_warm" />);

    expect(count(0, motion.exit)).toBe(0);
    expect(shivers()).toBe(0);
  });

  it('answers with the icon of the chosen stop: the snowflake and the sun turn, the thermometer lifts', async () => {
    await render(<Picker />);
    jest.mocked(withTiming).mockClear();

    // The picture of the chosen answer also fades in over the enter duration, so each turn is one more than that.
    await choose('I get cold easily');
    expect(count(1, motion.enter)).toBe(2);
    expect(count(1, motion.exit)).toBe(0);

    jest.mocked(withTiming).mockClear();
    await choose('About average');
    expect(count(1, motion.enter)).toBe(1);
    expect(count(1, motion.exit)).toBe(1);

    jest.mocked(withTiming).mockClear();
    await choose('I run warm');
    expect(count(1, motion.enter)).toBe(2);
  });

  it('does not turn or lift an icon on mount, nor when the chosen stop is pressed again', async () => {
    await render(<Picker start="runs_cold" />);
    // Only the chosen picture fades in; no icon turns or lifts.
    expect(count(1, motion.enter)).toBe(1);
    expect(count(1, motion.exit)).toBe(0);

    jest.mocked(withTiming).mockClear();
    await choose('I get cold easily');
    expect(timings()).toEqual([]);
  });

  it('does nothing at all to words or icons under reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await render(<Picker />);
    jest.mocked(withTiming).mockClear();

    await choose('I get cold easily');
    await choose('I run warm');
    await choose('About average');

    expect(shivers()).toBe(0);
    expect(count(0, motion.exit) + count(1, motion.exit)).toBe(0);
    expect(screen.getByTestId('thermal-effect').props.accessibilityLabel).toBe(thermalLooks.normal.effect);
  });
});
