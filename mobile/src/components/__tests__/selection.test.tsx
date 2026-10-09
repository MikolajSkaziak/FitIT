import { fireEvent, render, screen } from '@testing-library/react-native';
import { withTiming } from 'react-native-reanimated';

import { OptionTile, Segmented } from '@/components/controls';
import { Pill } from '@/components/toggles';
import { motion } from '@/theme';

const timings = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));

/** A choice is chosen on the frame it is tapped: it never fades in, and only the one that lost the choice fades out, in `motion.press`. */
describe('choosing an option', () => {
  beforeEach(() => jest.mocked(withTiming).mockClear());

  it('shows the chosen look without a timed fade-in, and fades the lost look out over the press duration', async () => {
    const { rerender } = await render(<Pill label="Tops" selected={false} onPress={jest.fn()} />);
    jest.mocked(withTiming).mockClear();

    await rerender(<Pill label="Tops" selected onPress={jest.fn()} />);
    expect(timings().filter(({ to }) => to === 1)).toEqual([]);

    await rerender(<Pill label="Tops" selected={false} onPress={jest.fn()} />);
    expect(timings()).toEqual([{ to: 0, duration: motion.press }]);
  });

  it('does the same for tiles and segments', async () => {
    const tile = await render(<OptionTile label="Casual" selected={false} onPress={jest.fn()} />);
    const options = [
      { value: 'a', label: 'Women' },
      { value: 'b', label: 'Men' },
    ] as const;
    const segments = await render(<Segmented label="Gender" options={options} value="a" onChange={jest.fn()} />);
    jest.mocked(withTiming).mockClear();

    await tile.rerender(<OptionTile label="Casual" selected onPress={jest.fn()} />);
    await segments.rerender(<Segmented label="Gender" options={options} value="b" onChange={jest.fn()} />);

    expect(timings().filter(({ to }) => to === 1)).toEqual([]);
    expect(timings().every(({ duration }) => duration === motion.press)).toBe(true);
  });

  it('calls onPress at once, without waiting for the press to end', async () => {
    const press = jest.fn();
    await render(<Pill label="Tops" selected={false} onPress={press} />);

    await fireEvent(screen.getByRole('checkbox', { name: 'Tops' }), 'pressIn');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tops' }));

    expect(press).toHaveBeenCalledTimes(1);
  });
});
