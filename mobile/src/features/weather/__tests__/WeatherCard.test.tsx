import { render, screen } from '@testing-library/react-native';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import type { Weather } from '@/api/weather';
import { resetWeatherGreeting, WeatherCard } from '@/features/weather/WeatherCard';
import { weather } from '@/test/fixtures';
import { motion } from '@/theme';

const under = (sky: Weather['sky']): Weather => ({ ...weather, sky });
const timings = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration] as const);
const count = (to: number, duration: number) => timings().filter(([target, length]) => target === to && length === duration).length;
const shivers = () => timings().filter(([, length]) => length === motion.press / 2).length;

beforeEach(() => {
  resetWeatherGreeting();
  jest.mocked(withTiming).mockClear();
});
afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

describe('the weather card’s greeting', () => {
  it('dips the icon by a falling drop for rain, in two steps that make up the sheet duration', async () => {
    await render(<WeatherCard weather={under('rain')} />);

    expect(count(1, motion.exit)).toBe(1);
    expect(count(0, motion.exit)).toBe(1);
    expect(motion.exit * 2).toBeLessThanOrEqual(motion.sheet);
    expect(shivers()).toBe(0);
  });

  it('turns the icon for a clear sky', async () => {
    await render(<WeatherCard weather={under('sun')} />);

    // The card itself fades in over the enter duration; the sun's turn is the second.
    expect(count(1, motion.enter)).toBe(2);
    expect(count(1, motion.exit)).toBe(0);
  });

  it('shivers the icon for snow', async () => {
    await render(<WeatherCard weather={under('snow')} />);

    expect(shivers()).toBe(5);
  });

  it.each(['cloud', 'cloud_sun'] as const)('does nothing for %s', async (sky) => {
    await render(<WeatherCard weather={under(sky)} />);

    expect(shivers()).toBe(0);
    expect(count(1, motion.exit)).toBe(0);
    expect(count(1, motion.enter)).toBe(1);
  });

  it('greets only once in a run of the app: a second card (a tab switch, a return) and a re-render stay still', async () => {
    const { rerender, unmount } = await render(<WeatherCard weather={under('snow')} />);
    expect(shivers()).toBe(5);

    await rerender(<WeatherCard weather={under('snow')} />);
    expect(shivers()).toBe(5);

    await unmount();
    jest.mocked(withTiming).mockClear();
    await render(<WeatherCard weather={under('snow')} />);
    expect(shivers()).toBe(0);
  });

  it('does nothing under reduced motion, and the card still says everything in one label', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await render(<WeatherCard weather={under('snow')} />);

    expect(shivers()).toBe(0);
    expect(screen.getByTestId('weather-row').props.accessibilityLabel).toContain('Gliwice');
  });
});
