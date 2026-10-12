import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';

import * as colors from '@/api/colors';
import { ApiError } from '@/api/problem';
import { Fade, stagger } from '@/components/motion';
import { ColorResult } from '@/features/colors/ColorResult';
import { useAnalyzeAnswers } from '@/features/colors/useColors';
import { failureCue } from '@/lib/failureCue';
import { colorAnalysis } from '@/test/fixtures';
import { motion } from '@/theme';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/colors', () => ({ createSelfieUpload: jest.fn(), analyzeColors: jest.fn(), deleteColorAnalysis: jest.fn() }));
jest.mock('@/components/motion', () => {
  const actual = jest.requireActual<typeof import('@/components/motion')>('@/components/motion');
  return { ...actual, Fade: jest.fn(actual.Fade) };
});

const fade = jest.mocked(Fade);
const notification = jest.mocked(Haptics.notificationAsync);
/** The props the swatches of a palette were given, in order. */
const swatchesOf = (group: 'color-best' | 'color-soften') =>
  fade.mock.calls.map(([props]) => props).filter((props) => props.testID?.startsWith(`${group}-`));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the colors to wear more of', () => {
  it('arrive one by one, each settling in from a little smaller, with a longer wait for each', async () => {
    await render(<ColorResult analysis={colorAnalysis} />);

    const first = swatchesOf('color-best').slice(0, colorAnalysis.best.length);
    expect(first).toHaveLength(colorAnalysis.best.length);
    expect(first.every((props) => props.pop === true)).toBe(true);
    expect(first.map((props) => props.enter)).toEqual([true, true, true, true, true, true, true]);
    expect(first.map((props) => props.delay)).toEqual(colorAnalysis.best.map((_, index) => index * stagger.step));
    expect(first[0]?.duration ?? motion.enter).toBe(motion.enter);
    // Still reachable by name, as before.
    expect(screen.getByLabelText('Sage green')).toBeOnTheScreen();
  });

  it('leave the colors to wear less of alone: they come with the block’s own fade', async () => {
    await render(<ColorResult analysis={colorAnalysis} />);

    const softened = swatchesOf('color-soften');
    expect(softened.length).toBeGreaterThanOrEqual(colorAnalysis.soften.length);
    expect(softened.every((props) => props.enter === false)).toBe(true);
  });

  it('do not arrive again when the result is drawn again', async () => {
    const view = await render(<ColorResult analysis={colorAnalysis} />);
    // The first items have arrived once the intro has run its course.
    await act(async () => new Promise((resolve) => setTimeout(resolve, stagger.limit * stagger.step + motion.enter + 50)));
    fade.mockClear();

    await view.rerender(<ColorResult analysis={{ ...colorAnalysis }} />);

    const again = swatchesOf('color-best');
    expect(again.length).toBeGreaterThan(0);
    expect(again.every((props) => props.enter === false)).toBe(true);
  });
});

describe('the result of an analysis', () => {
  const clients: QueryClient[] = [];
  // A finished mutation is otherwise kept for minutes, on a timer that outlives the tests.
  afterEach(() => clients.splice(0).forEach((client) => client.clear()));

  function wrapper() {
    const client = new QueryClient({ mutationCache: new MutationCache({ onError: failureCue }), defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
    clients.push(client);
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    return Wrapper;
  }
  const answers = { skinTone: 3, undertone: 'warm', hair: 'black', eyes: 'hazel' } as const;

  it('gives the success cue when it arrives', async () => {
    jest.mocked(colors.analyzeColors).mockResolvedValue(colorAnalysis);
    const { result } = await renderHook(() => useAnalyzeAnswers(), { wrapper: wrapper() });

    await act(async () => result.current.mutateAsync(answers));

    expect(notification.mock.calls).toEqual([['success']]);
  });

  it('gives the error cue, and no success, when it cannot be made', async () => {
    jest.mocked(colors.analyzeColors).mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    const { result } = await renderHook(() => useAnalyzeAnswers(), { wrapper: wrapper() });

    await act(async () => result.current.mutateAsync(answers).catch(() => undefined));

    expect(notification.mock.calls).toEqual([['error']]);
  });
});
