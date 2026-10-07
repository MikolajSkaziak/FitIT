/**
 * Calendar dates without clocks or time zones: a birth date is the same day everywhere.
 * Nothing here goes through `Date` arithmetic, so no date can shift by a day at midnight.
 */
export interface CalendarDate {
  day: number;
  month: number;
  year: number;
}

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const exists = ({ day, month, year }: CalendarDate): boolean =>
  year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

/** Reads "14.03.1999" (also with "-" or "/"). Returns null for anything that is not a real day. */
export function parseDate(text: string): CalendarDate | null {
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text.trim());
  if (!match) {
    return null;
  }

  const date = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  return exists(date) ? date : null;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** "14.03.1999", the way dates are written in Poland. */
export const formatDate = ({ day, month, year }: CalendarDate): string => `${pad(day)}.${pad(month)}.${pad(year, 4)}`;

/** "1999-03-14", the way the API takes and returns dates. */
export const toIso = ({ day, month, year }: CalendarDate): string => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

export function fromIso(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    return null;
  }

  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return exists(date) ? date : null;
}

/** Turns typed digits into "DD.MM.RRRR" as they arrive, so nobody has to find the dot on a number pad. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter((part) => part.length > 0).join('.');
}

export const fromJsDate = (date: Date): CalendarDate => ({ day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() });

/** Noon, so that the system date picker shows the same day in every time zone. */
export const toJsDate = ({ day, month, year }: CalendarDate): Date => new Date(year, month - 1, day, 12);

export const today = (now: Date = new Date()): CalendarDate => fromJsDate(now);

const compare = (a: CalendarDate, b: CalendarDate): number => a.year - b.year || a.month - b.month || a.day - b.day;

export const isAfter = (a: CalendarDate, b: CalendarDate): boolean => compare(a, b) > 0;

/** The same day `years` later; 29 February lands on the 28th in a year without one (as the server counts it). */
export function addYears(date: CalendarDate, years: number): CalendarDate {
  const year = date.year + years;
  return { year, month: date.month, day: Math.min(date.day, daysInMonth(year, date.month)) };
}

const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'] as const;
const months = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
] as const;

/** "5 października 2026". */
export const formatLongDate = ({ day, month, year }: CalendarDate): string => `${day} ${months[month - 1]} ${year}`;

/** "poniedziałek, 5 października". */
export const formatWeekday = (date: Date): string => `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;

/** "2 października", with the year added when it is not this one: for "added on" lines. */
export function formatDay(date: Date, now: Date = new Date()): string {
  const day = `${date.getDate()} ${months[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}

export interface WallClock {
  date: CalendarDate;
  hour: number;
  minute: number;
}

/**
 * The date and time as written in an ISO timestamp, with whatever offset it carries. The server stamps a forecast with
 * the offset of the place, so this is the clock on the wall there; converting to the phone's zone would be wrong.
 */
export function wallClock(iso: string): WallClock | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) {
    return null;
  }

  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return exists(date) ? { date, hour: Number(match[4]), minute: Number(match[5]) } : null;
}

/** "5 października", for a calendar date; the year is added when it is not the current one. */
export function formatCalendarDay(date: CalendarDate, now: Date = new Date()): string {
  const day = `${date.day} ${months[date.month - 1]}`;
  return date.year === now.getFullYear() ? day : `${day} ${date.year}`;
}

/** "poniedziałek, 5 października", for a calendar date. */
export const formatCalendarWeekday = (date: CalendarDate): string => formatWeekday(toJsDate(date));
