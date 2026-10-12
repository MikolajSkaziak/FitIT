import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

import { motion } from '@/theme';
import { fittingRoom, noticeFor, pictureCaption } from '@/features/visualization/copy';
import { OutfitVisualization, type OutfitViewer } from '@/features/visualization/OutfitVisualization';
import { useFittingRoom } from '@/features/visualization/FittingRoom';
import type { OrderStage } from '@/features/visualization/order';
import { outfit } from '@/test/fixtures';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);

const url = 'https://images.test/v1.jpg';

/** The viewer of one outfit with its order in the stage a test says, so the wait, the arrival and the failure can be played one after another. */
function Harness({ stage, code = null, trailing = false }: { stage: OrderStage; code?: string | null; trailing?: boolean }) {
  const room = useFittingRoom(stage);
  const [side, setSide] = useState<'board' | 'tryOn'>('tryOn');
  const viewer = {
    picture: {
      stage,
      picture: stage === 'ready' ? { id: 'v1', url, cacheKey: null } : null,
      errorCode: code,
      notice: noticeFor(stage, code),
      leftLine: null,
      usedUp: false,
      start: jest.fn(),
    },
    room,
    side,
    setSide,
    order: jest.fn(),
  } as unknown as OutfitViewer;
  return <OutfitVisualization viewer={viewer} outfit={outfit('o1')} width={390} trailing={trailing ? <Text testID="bookmark">Bookmark</Text> : undefined} />;
}

/** What the native image sends when it has decoded the picture. */
const loaded = () => ({ nativeEvent: { source: { url, width: 1024, height: 1365, mediaType: null, isAnimated: false }, cacheType: 'none' } });
const curtain = () => screen.queryByTestId('visualization-curtain', { includeHiddenElements: true });
const pass = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
const progressNow = () => (screen.getByRole('progressbar').props.accessibilityValue as { now: number }).now;

describe('the fitting room', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined).mockClear();
    jest.mocked(Haptics.notificationAsync).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows a closed curtain with the status and an honest progress bar while the picture is made', async () => {
    await render(<Harness stage="working" />);

    expect(curtain()).toBeOnTheScreen();
    expect(screen.getByText(fittingRoom.eyebrow)).toBeOnTheScreen();
    expect(screen.getByText(fittingRoom.stages[0])).toBeOnTheScreen();
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 100 });
    expect(progressNow()).toBeGreaterThan(0);
    expect(progressNow()).toBeLessThanOrEqual(90);
    expect(screen.queryByTestId('visualization-picture')).toBeNull();

    await pass(60_000);
    expect(progressNow()).toBeLessThanOrEqual(90);
    expect(screen.getByText(fittingRoom.stages[2])).toBeOnTheScreen();
  });

  it('completes the bar when the picture has arrived and loaded, then draws the curtain aside and takes it away', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await pass(8000);
    const before = progressNow();
    await rerender(<Harness stage="ready" />);
    expect(progressNow()).toBeGreaterThanOrEqual(before);

    // The picture is there under the curtain, which stays shut until the picture itself has loaded.
    expect(screen.getByTestId('visualization-picture')).toBeOnTheScreen();
    await pass(10_000);
    expect(curtain()).toBeOnTheScreen();
    expect(progressNow()).toBeLessThanOrEqual(90);

    expect(screen.queryByRole('link', { name: 'Report a problem' })).toBeNull();
    await fireEvent(screen.getByTestId('visualization-image'), 'load', loaded());
    expect(progressNow()).toBe(100);
    expect(curtain()).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    await pass(motion.enter);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(fittingRoom.ready);
    // The curtain starts to open: felt once.
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['success']]);
    expect(curtain()).toBeOnTheScreen();

    await pass(motion.reveal);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(curtain()).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('visualization-picture')).toBeOnTheScreen();
    expect(screen.getByText(pictureCaption)).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    // Under the caption, once the picture can be looked at.
    expect(screen.getByRole('link', { name: 'Report a problem' })).toBeOnTheScreen();
  });

  it('does not take a press on the picture while the curtain still hangs over it', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await rerender(<Harness stage="ready" />);

    expect(screen.getByTestId('visualization-picture').props.pointerEvents).toBe('none');
    await fireEvent(screen.getByTestId('visualization-image'), 'load', loaded());
    await pass(motion.enter);
    await pass(motion.reveal);

    expect(screen.getByTestId('visualization-picture').props.pointerEvents).toBe('auto');
  });

  it('shows an outfit that already had its picture at once, with no curtain and no announcement', async () => {
    await render(<Harness stage="ready" />);

    expect(curtain()).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('visualization-picture')).toBeOnTheScreen();
    expect(screen.getByText(pictureCaption)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Report a problem' })).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('keeps the curtain shut and says why when the picture did not come out, the bar gone with the wait', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await pass(5000);
    await rerender(<Harness stage="failed" code="timeout" />);

    expect(curtain()).toBeOnTheScreen();
    expect(screen.getByTestId('visualization-problem')).toBeOnTheScreen();
    expect(screen.getByText('The picture took too long')).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByTestId('visualization-picture')).toBeNull();
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('starts the bar over when the picture is ordered again after a failure', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await pass(30_000);
    const before = progressNow();
    await rerender(<Harness stage="failed" code="timeout" />);
    await rerender(<Harness stage="working" />);

    expect(curtain()).toBeOnTheScreen();
    expect(progressNow()).toBeLessThan(before);
  });

  it('keeps the bar where it was across a look at the Board, and leaves no curtain when the picture came meanwhile', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await pass(10_000);
    const before = progressNow();

    await fireEvent.press(screen.getByRole('tab', { name: 'Board' }));
    await pass(1000);
    await rerender(<Harness stage="ready" />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Try-on' }));
    expect(progressNow()).toBeGreaterThanOrEqual(before);

    await fireEvent(screen.getByTestId('visualization-image'), 'load', loaded());
    await pass(motion.enter);
    await pass(motion.reveal);
    expect(curtain()).toBeNull();
  });

  it('finishes a reveal that was under way when the Board was opened, so no curtain is left hanging', async () => {
    const { rerender } = await render(<Harness stage="working" />);
    await rerender(<Harness stage="ready" />);
    await fireEvent(screen.getByTestId('visualization-image'), 'load', loaded());
    await pass(motion.enter);

    await fireEvent.press(screen.getByRole('tab', { name: 'Board' }));
    await pass(motion.reveal);
    await fireEvent.press(screen.getByRole('tab', { name: 'Try-on' }));

    expect(curtain()).toBeNull();
    expect(screen.getByTestId('visualization-picture')).toBeOnTheScreen();
  });
});

describe('what is laid at the end of the row of tabs', () => {
  it('sits beside the tabs once there is a try-on picture to choose between', async () => {
    await render(<Harness stage="ready" trailing />);

    expect(screen.getByRole('tab', { name: 'Board' })).toBeOnTheScreen();
    expect(screen.getByTestId('bookmark')).toBeOnTheScreen();
    expect(within(screen.getByTestId('visualization-tabs-row')).getByTestId('bookmark')).toBeOnTheScreen();
    expect(within(screen.getByTestId('visualization-tabs-row')).getByRole('tab', { name: 'Try-on' })).toBeOnTheScreen();
  });

  it('sits beside the Board and On figure tabs while there is no try-on picture', async () => {
    await render(<Harness stage="none" trailing />);

    const row = screen.getByTestId('visualization-tabs-row');
    expect(within(row).getByRole('tab', { name: 'Board' })).toBeOnTheScreen();
    expect(within(row).getByRole('tab', { name: 'On figure' })).toBeOnTheScreen();
    expect(within(row).queryByRole('tab', { name: 'Try-on' })).toBeNull();
    expect(within(row).getByTestId('bookmark')).toBeOnTheScreen();
  });
});
