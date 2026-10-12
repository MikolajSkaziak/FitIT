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

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * A birth date as it is entered: the month is chosen by name, the day and the year are typed. There is no
 * "05.06.2004" to misread, because nobody ever writes the month and the day next to each other as digits.
 */
export interface DateParts {
  /** 1 to 12, or null while no month is chosen. */
  month: number | null;
  day: string;
  year: string;
}

export const emptyDateParts: DateParts = { month: null, day: '', year: '' };

/** Nothing entered in any of the three parts. */
export const isBlankDate = ({ month, day, year }: DateParts): boolean => month === null && day === '' && year === '';

/** The parts a calendar date is shown in, for a field that starts with a known date. */
export const toDateParts = ({ day, month, year }: CalendarDate): DateParts => ({ month, day: String(day), year: pad(year, 4) });

/** What a person typed into the day or the year box: digits only, no more than `length` of them. */
export const digitsUpTo = (text: string, length: number): string => text.replace(/\D/g, '').slice(0, length);

/** The date the three parts name, or null when one is missing or there is no such day (31 February). */
export function readDateParts({ month, day, year }: DateParts): CalendarDate | null {
  if (month === null || !/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) {
    return null;
  }

  const date = { day: Number(day), month, year: Number(year) };
  return exists(date) ? date : null;
}

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

export const fromJsDate = (date: Date): CalendarDate => ({ day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() });

/** Noon, so that a calendar date reads as the same day in every time zone. */
export const toJsDate = ({ day, month, year }: CalendarDate): Date => new Date(year, month - 1, day, 12);

export const today = (now: Date = new Date()): CalendarDate => fromJsDate(now);

const compare = (a: CalendarDate, b: CalendarDate): number => a.year - b.year || a.month - b.month || a.day - b.day;

export const isAfter = (a: CalendarDate, b: CalendarDate): boolean => compare(a, b) > 0;

/** The same day `years` later; 29 February lands on the 28th in a year without one (as the server counts it). */
export function addYears(date: CalendarDate, years: number): CalendarDate {
  const year = date.year + years;
  return { year, month: date.month, day: Math.min(date.day, daysInMonth(year, date.month)) };
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "October 5, 2026": the month is always a word, so no reader has to guess which number is the month. */
export const formatLongDate = ({ day, month, year }: CalendarDate): string => `${months[month - 1]} ${day}, ${year}`;

/** "Monday, October 5". */
export const formatWeekday = (date: Date): string => `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;

/** "October 2", with the year added when it is not this one: for "added on" lines. */
export function formatDay(date: Date, now: Date = new Date()): string {
  const day = `${months[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day}, ${date.getFullYear()}`;
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

/** "October 5", for a calendar date; the year is added when it is not the current one. */
export function formatCalendarDay(date: CalendarDate, now: Date = new Date()): string {
  const day = `${months[date.month - 1]} ${date.day}`;
  return date.year === now.getFullYear() ? day : `${day}, ${date.year}`;
}

/** "Monday, October 5", for a calendar date. */
export const formatCalendarWeekday = (date: CalendarDate): string => formatWeekday(toJsDate(date));

/** "3 pm", "3:30 pm", "12 am": the 12-hour clock of American English. */
export function formatClock({ hour, minute }: Pick<WallClock, 'hour' | 'minute'>): string {
  const hours = hour % 12 === 0 ? 12 : hour % 12;
  return `${hours}${minute === 0 ? '' : `:${pad(minute)}`} ${hour < 12 ? 'am' : 'pm'}`;
}

/** Days since 1 January 1970, counted on the calendar alone: no clock and no zone can move a date by a day. */
const dayNumber = ({ day, month, year }: CalendarDate): number => Math.round(Date.UTC(year, month - 1, day) / 86_400_000);

const fromDayNumber = (number: number): CalendarDate => {
  const date = new Date(number * 86_400_000);
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
};

/** The date `days` later (or, below zero, earlier): over the ends of months, leap days and clock changes alike. */
export const addDays = (date: CalendarDate, days: number): CalendarDate => fromDayNumber(dayNumber(date) + days);

/** How many days `to` lies after `from`; below zero when it lies before. */
export const daysBetween = (from: CalendarDate, to: CalendarDate): number => dayNumber(to) - dayNumber(from);

export const isSameDay = (a: CalendarDate, b: CalendarDate): boolean => compare(a, b) === 0;

export const isBefore = (a: CalendarDate, b: CalendarDate): boolean => compare(a, b) < 0;

/** 0 for Sunday to 6 for Saturday, whatever zone the phone is in. */
export const weekdayOf = (date: CalendarDate): number => (((dayNumber(date) + 4) % 7) + 7) % 7;

/** A month of a year, as the calendar pages through them. */
export interface CalendarMonth {
  month: number;
  year: number;
}

export const monthOf = ({ month, year }: CalendarDate): CalendarMonth => ({ month, year });

export const isSameMonth = (a: CalendarMonth, b: CalendarMonth): boolean => a.year === b.year && a.month === b.month;

/** The month `months` later or earlier, across the ends of years. */
export function addMonths({ month, year }: CalendarMonth, months: number): CalendarMonth {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export const firstOfMonth = ({ month, year }: CalendarMonth): CalendarDate => ({ day: 1, month, year });

export const lastOfMonth = ({ month, year }: CalendarMonth): CalendarDate => ({ day: daysInMonth(year, month), month, year });

/**
 * The month as the rows of a calendar page: whole weeks starting on `firstWeekday` (0 Sunday to 6 Saturday), with null
 * where the first and the last week reach into the months beside it.
 */
export function monthGrid(month: CalendarMonth, firstWeekday: number): (CalendarDate | null)[][] {
  const first = firstOfMonth(month);
  const lead = (weekdayOf(first) - firstWeekday + 7) % 7;
  const days = daysInMonth(month.year, month.month);
  const cells: (CalendarDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_unused, index) => ({ day: index + 1, month: month.month, year: month.year })),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_unused, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Countries whose calendars start the week on Sunday; the others here start it on Monday, a few on Saturday. */
const sundayFirst = new Set(['US', 'CA', 'MX', 'BR', 'AR', 'CO', 'PE', 'VE', 'JP', 'KR', 'TW', 'HK', 'PH', 'TH', 'IN', 'ID', 'IL', 'SA', 'ZA', 'KE', 'AU']);
const saturdayFirst = new Set(['AE', 'EG', 'DZ', 'BH', 'IQ', 'JO', 'KW', 'LY', 'OM', 'QA', 'SY', 'AF', 'IR']);

/**
 * The day a week starts on where the phone's language and region are from: 0 Sunday to 6 Saturday. Asked of `Intl` where
 * the engine knows it (Hermes has no `Intl.Locale`), otherwise told from the region in the locale's name; Monday when
 * nothing is known.
 */
export function firstWeekdayOf(locale: string = Intl.DateTimeFormat().resolvedOptions().locale): number {
  try {
    const known = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number }; getWeekInfo?: () => { firstDay?: number } };
    const day = (known.getWeekInfo?.() ?? known.weekInfo)?.firstDay;
    if (typeof day === 'number' && day >= 1 && day <= 7) {
      return day % 7;
    }
  } catch {
    // No `Intl.Locale` here, or not a locale it can read: the name itself may still say the region.
  }

  const region = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(locale)?.[1]?.toUpperCase();
  return region && sundayFirst.has(region) ? 0 : region && saturdayFirst.has(region) ? 6 : 1;
}

/** Noon in Greenwich on the date: `Intl` formats it in that zone, so the names never slip to a neighbouring day. */
const named = (options: Intl.DateTimeFormatOptions) => {
  const format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  return ({ day, month, year }: CalendarDate): string => format.format(new Date(Date.UTC(year, month - 1, day, 12)));
};

/** "Thursday". */
export const weekdayName = named({ weekday: 'long' });

/** "Thu". */
export const weekdayShort = named({ weekday: 'short' });

/** "T": the initial over a column of the month. */
export const weekdayInitial = named({ weekday: 'narrow' });

/** "Oct 15". */
export const formatShortDay = named({ month: 'short', day: 'numeric' });

/** "Thu, Oct 15". */
export const formatShortWeekday = named({ weekday: 'short', month: 'short', day: 'numeric' });

/** "Thursday, October 15", as a screen reader says a day of the calendar. */
export const formatSpokenDay = named({ weekday: 'long', month: 'long', day: 'numeric' });

const monthLong = named({ month: 'long' });

/** "October", with the year added when it is not the given one: the title of a calendar page. */
export const formatMonth = (month: CalendarMonth, thisYear: number): string =>
  month.year === thisYear ? monthLong(firstOfMonth(month)) : `${monthLong(firstOfMonth(month))} ${month.year}`;
