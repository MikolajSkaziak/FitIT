import { renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import * as haptics from '@/lib/haptics';

const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);
const selection = jest.mocked(Haptics.selectionAsync);

beforeEach(() => jest.clearAllMocks());

describe('the haptic cues', () => {
  it.each([
    ['lift', () => haptics.lift(), 'impact', 'light'],
    ['edge', () => haptics.edge(), 'impact', 'rigid'],
    ['drop', () => haptics.drop(), 'impact', 'soft'],
    ['shutter', () => haptics.shutter(), 'impact', 'medium'],
    ['destroy', () => haptics.destroy(), 'impact', 'heavy'],
    ['keep (saved)', () => haptics.keep(true), 'impact', 'light'],
    ['arrange (going in, Done)', () => haptics.arrange(true), 'impact', 'medium'],
    ['arrange (Reset)', () => haptics.arrange(false), 'impact', 'light'],
    ['press primary', () => haptics.press('primary'), 'impact', 'medium'],
    ['press secondary', () => haptics.press('secondary'), 'impact', 'light'],
    ['press icon', () => haptics.press('icon'), 'impact', 'light'],
    ['press danger', () => haptics.press('danger'), 'impact', 'rigid'],
    ['temperature cold', () => haptics.temperature('cold'), 'impact', 'soft'],
    ['temperature warm', () => haptics.temperature('warm'), 'impact', 'rigid'],
    ['success', () => haptics.success(), 'notification', 'success'],
    ['warning', () => haptics.warning(), 'notification', 'warning'],
    ['error', () => haptics.error(), 'notification', 'error'],
  ] as const)('%s asks for the %s %s', (_name, cue, kind, style) => {
    cue();

    expect(kind === 'impact' ? impact.mock.calls : notification.mock.calls).toEqual([[style]]);
    expect(selection).not.toHaveBeenCalled();
    expect(kind === 'impact' ? notification : impact).not.toHaveBeenCalled();
  });

  it('gives a plain selection for select, a quiet press, a navigating press, an average temperature, and a bookmark taken off', () => {
    haptics.select();
    haptics.keep(false);
    haptics.press('quiet');
    haptics.press('nav');
    haptics.temperature('normal');

    expect(selection).toHaveBeenCalledTimes(5);
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('never waits for the motor and never throws: a refusal, or a motor that is not there, is ignored', async () => {
    impact.mockRejectedValueOnce(new Error('no motor'));
    selection.mockImplementationOnce(() => {
      throw new Error('module missing');
    });
    notification.mockReturnValueOnce(undefined as never);

    expect(() => haptics.lift()).not.toThrow();
    expect(() => haptics.select()).not.toThrow();
    expect(() => haptics.success()).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing on the web', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'web');

    haptics.select();
    haptics.lift();
    haptics.success();
    haptics.destroy();

    expect(selection).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    platform.restore();
  });
});

describe('useWarning', () => {
  it('warns once when the limit is reached, not while it is not, and not again on a re-render', async () => {
    const view = await renderHook((props: { reached: boolean }) => haptics.useWarning(props.reached), { initialProps: { reached: false } });
    expect(notification).not.toHaveBeenCalled();

    await view.rerender({ reached: true });
    await view.rerender({ reached: true });

    expect(notification.mock.calls).toEqual([['warning']]);
  });

  it('warns for a screen that opens with the limit already reached', async () => {
    await renderHook(() => haptics.useWarning(true));

    expect(notification.mock.calls).toEqual([['warning']]);
  });
});
