import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { withTiming } from 'react-native-reanimated';

import { IconToggleButton, OptionTile, Segmented } from '@/components/controls';
import { SizeButtons } from '@/components/SizeButtons';
import { StyleTile } from '@/components/StyleTile';
import { TextTabs } from '@/components/TextTabs';
import { Pill } from '@/components/toggles';
import { StarterTile } from '@/features/onboarding/StarterTile';
import { starterPiece } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';
import { motion } from '@/theme';

const select = jest.mocked(Haptics.selectionAsync);
const impact = jest.mocked(Haptics.impactAsync);

beforeEach(() => jest.clearAllMocks());

describe('a choice that changes', () => {
  const options = [
    { value: 'a', label: 'Tops' },
    { value: 'b', label: 'Bottoms' },
  ] as const;

  function Tabs({ tabs = false }: { tabs?: boolean }) {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return <TextTabs label="Groups" tabs={tabs} options={options} value={value} onChange={setValue} />;
  }

  it('gives one selection when another tab is chosen, and none when the chosen one is pressed again', async () => {
    await render(<Tabs tabs />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Bottoms' }));
    expect(select).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('tab', { name: 'Bottoms' }));
    expect(select).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('tab', { name: 'Tops' }));
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('gives a selection every time a value of several is ticked or unticked', async () => {
    await render(<TextTabs label="Seasons" options={options} value={['a']} onChange={jest.fn()} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tops' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bottoms' }));

    expect(select).toHaveBeenCalledTimes(2);
  });

  it('is the same for segments and pills, which are text tabs underneath', async () => {
    await render(<Segmented label="Gender" options={options} value="a" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Bottoms' }));
    expect(select).toHaveBeenCalledTimes(1);

    await render(<Pill label="Hats" selected onPress={jest.fn()} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Hats' }));
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('gives one selection for an option that becomes chosen, not for the one that already is', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <OptionTile label="Women" selected={false} onPress={onPress} />
        <OptionTile label="Men" selected onPress={onPress} />
      </>,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Men' }));
    expect(select).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Women' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('gives a selection for an option of several, whichever way it goes', async () => {
    await render(<OptionTile label="Coat" role="checkbox" selected onPress={jest.fn()} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Coat' }));

    expect(select).toHaveBeenCalledTimes(1);
  });

  it('gives a selection for a size that is chosen, not for the one that already is', async () => {
    const onChange = jest.fn();
    await render(<SizeButtons value="m" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Medium' }));
    expect(select).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('l');
  });

  it('gives a selection when a style tile is ticked, and a starter piece is added', async () => {
    const onStyle = jest.fn();
    const onPiece = jest.fn();
    await renderScreen(
      <>
        <StyleTile label="Casual" selected={false} onPress={onStyle} />
        <StarterTile piece={starterPiece('white-tee', 'White tee', 'top')} caption="Tops" selected={false} onPress={onPiece} />
      </>,
    );

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Casual' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'White tee' }));

    expect(select).toHaveBeenCalledTimes(2);
    expect(onStyle).toHaveBeenCalledTimes(1);
    expect(onPiece).toHaveBeenCalledTimes(1);
  });

  it('gives a light tap, and no selection, for a round icon button that is not a choice', async () => {
    const onPress = jest.fn();
    await render(<IconToggleButton icon="filters" label="Filters" active={false} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    expect(impact.mock.calls).toEqual([['light']]);
  });
});

describe('the bookmark', () => {
  const popTimings = () => jest.mocked(withTiming).mock.calls.filter(([to, config]) => to === 1 && (config as { duration: number }).duration === motion.exit);

  it('shows an outfit that is already saved as it is, with no pop', async () => {
    jest.mocked(withTiming).mockClear();

    await render(<IconToggleButton icon="bookmark" label="Remove from saved" active onPress={jest.fn()} bare testID="keep" />);

    expect(screen.getByTestId('keep-pop')).toBeOnTheScreen();
    expect(popTimings()).toEqual([]);
  });

  it('settles the filled icon in over the exit duration when it turns on, and swaps back without a pop when it turns off', async () => {
    const view = await render(<IconToggleButton icon="bookmark" label="Save outfit" active={false} onPress={jest.fn()} bare testID="keep" />);
    expect(screen.queryByTestId('keep-pop')).toBeNull();
    jest.mocked(withTiming).mockClear();

    await view.rerender(<IconToggleButton icon="bookmark" label="Remove from saved" active onPress={jest.fn()} bare testID="keep" />);
    expect(screen.getByTestId('keep-pop')).toBeOnTheScreen();
    expect(popTimings()).toHaveLength(1);

    jest.mocked(withTiming).mockClear();
    await view.rerender(<IconToggleButton icon="bookmark" label="Save outfit" active={false} onPress={jest.fn()} bare testID="keep" />);
    expect(screen.queryByTestId('keep-pop')).toBeNull();
    expect(popTimings()).toEqual([]);

    // On again: it settles in again.
    await view.rerender(<IconToggleButton icon="bookmark" label="Remove from saved" active onPress={jest.fn()} bare testID="keep" />);
    expect(popTimings()).toHaveLength(1);
  });

  it('pops again when it turns on after a screen that began saved', async () => {
    const view = await render(<IconToggleButton icon="bookmark" label="Remove from saved" active onPress={jest.fn()} bare testID="keep" />);
    await view.rerender(<IconToggleButton icon="bookmark" label="Save outfit" active={false} onPress={jest.fn()} bare testID="keep" />);
    jest.mocked(withTiming).mockClear();

    await view.rerender(<IconToggleButton icon="bookmark" label="Remove from saved" active onPress={jest.fn()} bare testID="keep" />);

    expect(popTimings()).toHaveLength(1);
  });
});
