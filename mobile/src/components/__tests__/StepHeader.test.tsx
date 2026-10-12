import { render, screen } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';

import { ProgressFill } from '@/components/motion';
import { StepHeader } from '@/components/StepHeader';
import { fillStart, flow } from '@/features/flow';
import { motion } from '@/theme';

jest.mock('expo-router', () => ({ ...jest.requireActual('@/test/screen').routerModule, useIsFocused: jest.fn(() => true) }));
jest.mock('@/components/motion', () => ({ ...jest.requireActual('@/components/motion'), ProgressFill: jest.fn(() => null) }));

const fill = jest.mocked(ProgressFill);
const lastFill = () => fill.mock.calls[fill.mock.calls.length - 1]?.[0];

describe('where a line starts', () => {
  it('carries on from the step before it going forward, and from the step after it coming back', () => {
    expect(fillStart('styles', 'gender')).toBe(flow.gender.progress);
    expect(fillStart('basics', 'styles')).toBe(flow.styles.progress);
    expect(fillStart('gender', 'styles')).toBe(flow.styles.progress);
    expect(fillStart('fit', 'shape')).toBe(flow.shape.progress);
  });

  it('starts at half of its own when there is no step before it, so a line is never empty', () => {
    expect(fillStart('gender', null)).toBeCloseTo(0.1, 6);
    expect(fillStart('shape', null)).toBeCloseTo(0.125, 6);
  });

  it('starts afresh at the account and after it: those are lines of their own', () => {
    expect(fillStart('account', 'look')).toBeCloseTo(0.25, 6);
    expect(fillStart('shape', 'account')).toBeCloseTo(0.125, 6);
    expect(fillStart('styles', 'styles')).toBeCloseTo(0.2, 6);
  });
});

describe('StepHeader', () => {
  beforeEach(() => {
    fill.mockClear();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it('grows its line from half its value for the very first step, after a short wait for the screen to push in', async () => {
    await render(<StepHeader step="gender" />);

    expect(lastFill()).toMatchObject({ progress: 0.2, from: 0.1, delay: motion.exit, duration: motion.sheet });
  });

  it('grows the line of the next step from the step that was in view before it', async () => {
    await render(<StepHeader step="gender" />);
    await render(<StepHeader step="styles" />);

    expect(lastFill()).toMatchObject({ progress: 0.4, from: 0.2 });
  });

  it('shrinks the line from the step it came back from each time its screen comes into view again', async () => {
    const view = await render(<StepHeader step="gender" />);
    await render(<StepHeader step="styles" />);
    const calls = fill.mock.calls.length;

    jest.mocked(useIsFocused).mockReturnValue(false);
    await view.rerender(<StepHeader step="gender" />);
    expect(fill.mock.calls.length).toBeGreaterThanOrEqual(calls);
    jest.mocked(useIsFocused).mockReturnValue(true);
    await view.rerender(<StepHeader step="gender" />);

    expect(lastFill()).toMatchObject({ progress: 0.2, from: 0.4 });
  });

  it('tells a screen reader the true value from the first frame', async () => {
    await render(<StepHeader step="basics" />);

    expect(screen.getByRole('progressbar', { name: flow.basics.label })).toHaveProp('accessibilityValue', { min: 0, max: 100, now: 60 });
  });
});
