import type { Sky, Weather } from '@/api/weather';
import { formatClock, wallClock } from '@/lib/dates';

/** Real minus sign: a hyphen would read as part of the range ("-4-1°C"). */
const minus = '−';

const degrees = (value: number): string => `${value < 0 ? minus : ''}${Math.abs(value)}`;

/** "7°C" for one value, "7-18°C" for a range, "−4 to 1°C" when the range crosses or sits below zero. */
export function formatRange(min: number, max: number): string {
  if (min === max) {
    return `${degrees(min)}°C`;
  }

  return min >= 0 ? `${min}-${max}°C` : `${degrees(min)} to ${degrees(max)}°C`;
}

/** "14°", the way a single reading is written on the weather card. */
export const formatDegrees = (value: number): string => `${degrees(value)}°`;

export const rangeOf = (weather: Pick<Weather, 'feelsMin' | 'feelsMax'>): string => formatRange(weather.feelsMin, weather.feelsMax);

export const skyNames: Record<Sky, string> = {
  sun: 'Sunny',
  cloud_sun: 'Partly cloudy',
  cloud: 'Cloudy',
  rain: 'Rain',
  snow: 'Snow',
};

/** The glyph component takes the sky with a hyphen. */
export const glyphOf = (sky: Sky): 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' => (sky === 'cloud_sun' ? 'cloud-sun' : sky);

/** Which part of the day an hour on the wall clock of the place belongs to. */
export function partOfDay(hour: number): 'at night' | 'in the morning' | 'in the afternoon' | 'in the evening' {
  if (hour < 5) {
    return 'at night';
  }

  if (hour < 12) {
    return 'in the morning';
  }

  return hour < 18 ? 'in the afternoon' : 'in the evening';
}

type Forecast = Pick<Weather, 'sky' | 'rain' | 'from' | 'rainFrom'>;

/** " from 3 pm" when the rain starts well after the window does; nothing when it is there from the start. */
function rainStart({ from, rainFrom }: Pick<Weather, 'from' | 'rainFrom'>): string {
  const clock = rainFrom ? wallClock(rainFrom) : null;
  if (!rainFrom || !clock || Date.parse(rainFrom) - Date.parse(from) <= 60 * 60_000) {
    return '';
  }

  return ` from ${formatClock(clock)}`;
}

/** The one-line summary of the sky: "Sunny, no rain", "Rain from 3 pm". */
export function headline(weather: Forecast): string {
  const name = skyNames[weather.sky];
  if (weather.sky === 'rain' || weather.sky === 'snow') {
    return `${name}${rainStart(weather)}`;
  }

  return weather.rain ? `${name}, chance of rain${rainStart(weather)}` : `${name}, no rain`;
}

const dry: Record<Weather['band'], string> = {
  hot: 'Hot out. Wear something light and breathable.',
  warm: 'Warm. Light clothes will do.',
  mild: 'Mild. A light layer will come in handy.',
  cold: 'Cold. Bundle up.',
  freezing: 'Freezing. Wear your warmest layers.',
};

const wet: Record<Weather['band'], string> = {
  hot: 'Hot, but rain is possible. Bring something for the rain.',
  warm: 'Warm, but rain is possible. Bring something for the rain.',
  mild: 'Cool and wet. A rain jacket is a good idea.',
  cold: 'Cold and wet. Dress warm and stay dry.',
  freezing: 'Freezing and damp. Wear your warmest layers.',
};

/** What to do about it, in one sentence. Rain comes first, then a big swing in the day, then the temperature itself. */
export function advice(weather: Pick<Weather, 'rain' | 'needsLayers' | 'band' | 'coldestAt'>): string {
  if (weather.rain) {
    return wet[weather.band];
  }

  if (weather.needsLayers) {
    const clock = wallClock(weather.coldestAt);
    return `It’ll be cool ${clock ? partOfDay(clock.hour) : 'in the morning'}. Wear a layer you can take off.`;
  }

  return dry[weather.band];
}

const wetWords: Partial<Record<Sky, string>> = { rain: 'rain', snow: 'snow' };

export interface HourSlot {
  key: string;
  /** "Now" for the current hour, then the clock of the place: "3 pm". */
  label: string;
  /** "13°", with the word for what falls when something does: "13° rain". */
  value: string;
}

/** The hours of the strip under the weather: what it feels like from now to the evening. */
export const hourSlots = (weather: Pick<Weather, 'hours'>): HourSlot[] =>
  weather.hours.map((hour, index) => {
    const clock = wallClock(hour.time);
    const wet = wetWords[hour.sky];
    return { key: hour.time, label: index === 0 || !clock ? 'Now' : formatClock(clock), value: `${formatDegrees(hour.feels)}${wet ? ` ${wet}` : ''}` };
  });

/** How the day is greeted at this hour of the clock. */
export function greetingAt(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  return hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** "Gliwice", or "Gliwice, tomorrow" once the evening has come and the forecast is for the next day. */
export const placeLine = (weather: Pick<Weather, 'place' | 'forTomorrow'>): string => (weather.forTomorrow ? `${weather.place}, tomorrow` : weather.place);

export const locationProblems = {
  denied: 'Location is turned off. Choose a city, or turn it on in your phone’s Settings.',
  unavailable: 'We couldn’t find your location. Try again, or choose a city.',
} as const;
