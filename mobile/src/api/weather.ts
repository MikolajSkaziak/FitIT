import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Weather = Schemas['WeatherResponse'];
export type Sky = Schemas['Sky'];
export type TemperatureBand = Schemas['TemperatureBand'];

/** The weather the next outfit is chosen for: the hours until the evening, or tomorrow once it is late. */
export const fetchWeatherToday = (): Promise<Weather> => unwrap(api.GET('/api/weather/today'));

export const weatherKeys = {
  all: ['weather'] as const,
  today: ['weather', 'today'] as const,
};

/** A forecast is good for a while; the place and the thermal preference change it, and both invalidate it. */
export const weatherStaleMs = 10 * 60_000;
