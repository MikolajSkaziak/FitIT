import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Button } from '@/components/Button';
import { IconButton, LinkText, OptionTile } from '@/components/controls';
import { Row } from '@/components/lists';
import { PressScale } from '@/components/motion';
import { TabBar } from '@/components/TabBar';
import { renderScreen } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);

const select = jest.mocked(Haptics.selectionAsync);
const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);

beforeEach(() => jest.clearAllMocks());

describe('a press on a button, graded by the weight of what it does', () => {
  it.each([
    ['primary', 'medium'],
    ['secondary', 'light'],
    ['danger', 'rigid'],
    ['dangerText', 'rigid'],
  ] as const)('a %s button gives one %s impact', async (kind, style) => {
    const onPress = jest.fn();
    await render(<Button label="Go" kind={kind} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(impact.mock.calls).toEqual([[style]]);
    expect(select).not.toHaveBeenCalled();
  });

  it('gives a single selection tick for a text button and for a link', async () => {
    await render(
      <>
        <Button label="Skip" kind="text" onPress={jest.fn()} />
        <LinkText label="Forgot it?" onPress={jest.fn()} />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await fireEvent.press(screen.getByRole('link'));

    expect(select).toHaveBeenCalledTimes(2);
    expect(impact).not.toHaveBeenCalled();
  });

  it('gives nothing for a button that is disabled or busy', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button label="Off" disabled onPress={onPress} />
        <Button label="Working" busy onPress={onPress} />
        <IconButton icon="close" label="Close" busy onPress={onPress} />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Off' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Working' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('gives nothing when haptic is none, and the press still goes through', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button label="Quiet" haptic="none" onPress={onPress} />
        <IconButton icon="close" label="Close" haptic="none" onPress={onPress} />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Quiet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(impact).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('lets a control ask for a kind by name', async () => {
    await render(<Button label="Go" kind="secondary" haptic="danger" onPress={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));

    expect(impact.mock.calls).toEqual([['rigid']]);
  });

  it('gives a light tap for a round icon button', async () => {
    await render(<IconButton icon="back" label="Back" onPress={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(impact.mock.calls).toEqual([['light']]);
  });

  it('gives a selection for a row that opens something, a rigid tap for a danger row, and nothing for a row with no press', async () => {
    await render(
      <>
        <Row label="Place" onPress={jest.fn()} />
        <Row label="Delete account" danger onPress={jest.fn()} />
        <Row label="Version" value="1.0" />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Place' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(impact).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(impact.mock.calls).toEqual([['rigid']]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('gives a selection for a tile that opens a detail, and none for a radio that is already chosen', async () => {
    await render(
      <>
        <PressScale accessibilityRole="button" accessibilityLabel="Grey hoodie" onPress={jest.fn()} />
        <PressScale accessibilityRole="radio" accessibilityState={{ checked: true }} accessibilityLabel="Chosen" onPress={jest.fn()} />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Grey hoodie' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Chosen' }));

    expect(select).toHaveBeenCalledTimes(1);
  });

  it('gives exactly one selection for a choice tile: the choice cue, not a press on top of it', async () => {
    await render(<OptionTile label="Women" selected={false} onPress={jest.fn()} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Women' }));

    expect(select).toHaveBeenCalledTimes(1);
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });
});

describe('the tab bar', () => {
  const route = (name: string) => ({ key: `${name}-key`, name });
  const bar = {
    state: { index: 0, routes: ['index', 'wardrobe', 'outfits', 'profile'].map(route) },
    navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
    insets: { top: 0, bottom: 34, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;

  it('gives a selection when the tab changes, and nothing when the tab that is shown is pressed again', async () => {
    await renderScreen(<TabBar {...bar} />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));
    expect(select).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('tab', { name: 'Wardrobe' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(bar.navigation.navigate).toHaveBeenCalledWith('wardrobe', undefined);
  });

  it('gives a medium tap for the round plus', async () => {
    await renderScreen(<TabBar {...bar} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(impact.mock.calls).toEqual([['medium']]);
  });
});
