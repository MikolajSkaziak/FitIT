import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Weather = Schemas['WeatherResponse'];
export type Sky = Schemas['Sky'];

/** The weather the next outfit is chosen for: the hours until the evening, or tomorrow once it is late. */
export const fetchWeatherToday = (): Promise<Weather> => unwrap(api.GET('/api/weather/today'));

/**
 * The weather of one day of the person's calendar, today or one of the next six. A day ahead covers that whole day and
 * has no `now`; the hours are spread from its morning to its evening.
 */
export type DayWeather = Schemas['DayWeatherResponse'];

export const fetchWeatherForDay = (date: string): Promise<DayWeather> => unwrap(api.GET('/api/weather/day', { params: { query: { date } } }));

export const weatherKeys = {
  all: ['weather'] as const,
  today: ['weather', 'today'] as const,
  day: (date: string) => ['weather', 'day', date] as const,
};

/** A forecast is good for a while; the place and the thermal preference change it, and both invalidate it. */
export const weatherStaleMs = 10 * 60_000;
