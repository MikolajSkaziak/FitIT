import type { Sky, Weather } from '@/api/weather';
import { wallClock } from '@/lib/dates';

/** Real minus sign: a hyphen would read as part of the range ("-4-1°C"). */
const minus = '−';

const degrees = (value: number): string => `${value < 0 ? minus : ''}${Math.abs(value)}`;

/** "7°C" for one value, "7-18°C" for a range, "−4 do 1°C" when the range crosses or sits below zero. */
export function formatRange(min: number, max: number): string {
  if (min === max) {
    return `${degrees(min)}°C`;
  }

  return min >= 0 ? `${min}-${max}°C` : `${degrees(min)} do ${degrees(max)}°C`;
}

export const rangeOf = (weather: Pick<Weather, 'feelsMin' | 'feelsMax'>): string => formatRange(weather.feelsMin, weather.feelsMax);

export const skyNames: Record<Sky, string> = {
  sun: 'Słonecznie',
  cloud_sun: 'Przejaśnienia',
  cloud: 'Pochmurno',
  rain: 'Deszcz',
  snow: 'Śnieg',
};

/** The glyph component takes the sky with a hyphen. */
export const glyphOf = (sky: Sky): 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' => (sky === 'cloud_sun' ? 'cloud-sun' : sky);

/** Which part of the day an hour on the wall clock of the place belongs to. */
export function partOfDay(hour: number): 'w nocy' | 'rano' | 'po południu' | 'wieczorem' {
  if (hour < 5) {
    return 'w nocy';
  }

  if (hour < 12) {
    return 'rano';
  }

  return hour < 18 ? 'po południu' : 'wieczorem';
}

const capitalize = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

type Forecast = Pick<Weather, 'sky' | 'rain' | 'from' | 'rainFrom'>;

/** " po południu" when the rain starts well after the window does; nothing when it is there from the start. */
function rainStart({ from, rainFrom }: Pick<Weather, 'from' | 'rainFrom'>): string {
  const clock = rainFrom ? wallClock(rainFrom) : null;
  if (!rainFrom || !clock || Date.parse(rainFrom) - Date.parse(from) <= 60 * 60_000) {
    return '';
  }

  return ` ${partOfDay(clock.hour)}`;
}

/** The one-line summary of the sky: "Słonecznie, bez opadów", "Deszcz po południu". */
export function headline(weather: Forecast): string {
  const name = skyNames[weather.sky];
  if (weather.sky === 'rain' || weather.sky === 'snow') {
    return `${name}${rainStart(weather)}`;
  }

  return weather.rain ? `${name}, możliwy deszcz${rainStart(weather)}` : `${name}, bez opadów`;
}

const dry: Record<Weather['band'], string> = {
  hot: 'Gorąco, postaw na lekkie i przewiewne ubrania.',
  warm: 'Ciepło, wystarczą lekkie ubrania.',
  mild: 'Łagodnie, przyda się coś lekkiego na wierzch.',
  cold: 'Zimno, ubierz się ciepło.',
  freezing: 'Mróz, ubierz się naprawdę ciepło.',
};

const wet: Record<Weather['band'], string> = {
  hot: 'Gorąco, ale może padać. Weź coś na deszcz.',
  warm: 'Ciepło, ale może padać. Weź coś na deszcz.',
  mild: 'Mokro i chłodno, przyda się okrycie na deszcz.',
  cold: 'Zimno i mokro, ubierz się ciepło i nieprzemakalnie.',
  freezing: 'Mróz i wilgoć, ubierz się naprawdę ciepło.',
};

/** What to do about it, in one sentence. Rain comes first, then a big swing in the day, then the temperature itself. */
export function advice(weather: Pick<Weather, 'rain' | 'needsLayers' | 'band' | 'coldestAt'>): string {
  if (weather.rain) {
    return wet[weather.band];
  }

  if (weather.needsLayers) {
    const clock = wallClock(weather.coldestAt);
    return `${capitalize(clock ? partOfDay(clock.hour) : 'rano')} chłodno, przyda się warstwa do zdjęcia.`;
  }

  return dry[weather.band];
}

/** "Gliwice", or "Gliwice, jutro" once the evening has come and the forecast is for the next day. */
export const placeLine = (weather: Pick<Weather, 'place' | 'forTomorrow'>): string => (weather.forTomorrow ? `${weather.place}, jutro` : weather.place);

export const locationProblems = {
  denied: 'Nie masz zgody na lokalizację. Wpisz miasto albo włącz ją w ustawieniach telefonu.',
  unavailable: 'Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wpisz miasto.',
} as const;
