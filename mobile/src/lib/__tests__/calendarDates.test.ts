import {
  addDays,
  addMonths,
  daysBetween,
  firstOfMonth,
  firstWeekdayOf,
  formatMonth,
  formatShortDay,
  formatShortWeekday,
  formatSpokenDay,
  fromIso,
  isBefore,
  isSameDay,
  isSameMonth,
  lastOfMonth,
  monthGrid,
  monthOf,
  toIso,
  wallClock,
  weekdayInitial,
  weekdayName,
  weekdayOf,
  weekdayShort,
  type CalendarDate,
} from '@/lib/dates';

const date = (iso: string): CalendarDate => fromIso(iso)!;
const after = (iso: string, days: number): string => toIso(addDays(date(iso), days));

describe('adding days', () => {
  it('crosses the ends of months and years, and leap days, without losing a day', () => {
    expect(after('2026-10-05', 6)).toBe('2026-10-11');
    expect(after('2026-10-29', 6)).toBe('2026-11-04');
    expect(after('2026-12-28', 6)).toBe('2027-01-03');
    expect(after('2028-02-26', 6)).toBe('2028-03-03');
    expect(after('2027-02-26', 6)).toBe('2027-03-04');
    expect(after('2026-03-01', -1)).toBe('2026-02-28');
    expect(after('2024-03-01', -1)).toBe('2024-02-29');
    expect(after('2026-10-05', 0)).toBe('2026-10-05');
  });

  it('is not moved by the nights the clocks change, in any zone', () => {
    // Europe goes to summer time on 29 March 2026 and back on 25 October; the United States on 8 March and 1 November.
    for (const start of ['2026-03-28', '2026-10-24', '2026-03-07', '2026-10-31']) {
      const next = Array.from({ length: 3 }, (_unused, index) => after(start, index));
      expect(new Set(next).size).toBe(3);
      expect(daysBetween(date(start), date(next[2]!))).toBe(2);
    }

    expect(after('2026-10-24', 1)).toBe('2026-10-25');
    expect(after('2026-10-25', 1)).toBe('2026-10-26');
    expect(after('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('counts the days between two dates, either way', () => {
    expect(daysBetween(date('2026-10-05'), date('2026-10-08'))).toBe(3);
    expect(daysBetween(date('2026-10-08'), date('2026-10-05'))).toBe(-3);
    expect(daysBetween(date('2026-12-31'), date('2027-01-01'))).toBe(1);
    expect(daysBetween(date('2026-10-05'), date('2027-10-05'))).toBe(365);
    expect(isBefore(date('2026-10-04'), date('2026-10-05'))).toBe(true);
    expect(isBefore(date('2026-10-05'), date('2026-10-05'))).toBe(false);
    expect(isSameDay(date('2026-10-05'), { day: 5, month: 10, year: 2026 })).toBe(true);
  });
});

describe('the day at the place', () => {
  it('is the date stamped on the forecast, also when Greenwich and the phone are on another one', () => {
    // 23:30 on the 6th in Pago Pago is the 7th in Greenwich and the 8th in Kiritimati.
    const pagoPago = wallClock('2026-10-06T23:30:00-11:00')!.date;
    const kiritimati = wallClock('2026-10-08T00:30:00+14:00')!.date;

    expect(toIso(pagoPago)).toBe('2026-10-06');
    expect(toIso(kiritimati)).toBe('2026-10-08');
    // A week from there is counted from that day.
    expect(toIso(addDays(pagoPago, 6))).toBe('2026-10-12');
    expect(toIso(addDays(kiritimati, 6))).toBe('2026-10-14');
    expect(weekdayName(pagoPago)).toBe('Tuesday');
    expect(weekdayName(kiritimati)).toBe('Thursday');
  });

  it('turns over at the place’s own midnight', () => {
    expect(toIso(wallClock('2026-12-31T23:59:00+09:00')!.date)).toBe('2026-12-31');
    expect(toIso(wallClock('2027-01-01T00:00:00+09:00')!.date)).toBe('2027-01-01');
  });
});

describe('weekdays', () => {
  it('knows the day of the week of any date', () => {
    expect(weekdayOf(date('1970-01-01'))).toBe(4);
    expect(weekdayOf(date('2026-10-04'))).toBe(0);
    expect(weekdayOf(date('2026-10-05'))).toBe(1);
    expect(weekdayOf(date('2026-10-10'))).toBe(6);
    expect(weekdayOf(date('1969-12-31'))).toBe(3);
    expect(weekdayOf(date('2000-02-29'))).toBe(2);
  });

  it('names days and months in words', () => {
    const thursday = date('2026-10-15');
    expect(weekdayName(thursday)).toBe('Thursday');
    expect(weekdayShort(thursday)).toBe('Thu');
    expect(weekdayInitial(thursday)).toBe('T');
    expect(formatShortDay(thursday)).toBe('Oct 15');
    expect(formatShortWeekday(thursday)).toBe('Thu, Oct 15');
    expect(formatSpokenDay(thursday)).toBe('Thursday, October 15');
    expect(formatMonth({ month: 10, year: 2026 }, 2026)).toBe('October');
    expect(formatMonth({ month: 1, year: 2027 }, 2026)).toBe('January 2027');
  });

  it('names the first and the last day of a year for what they are', () => {
    expect(formatSpokenDay(date('2026-01-01'))).toBe('Thursday, January 1');
    expect(formatSpokenDay(date('2026-12-31'))).toBe('Thursday, December 31');
  });

  it('starts the week where the region does, and on Monday when it does not know', () => {
    expect(firstWeekdayOf('en-US')).toBe(0);
    expect(firstWeekdayOf('en-GB')).toBe(1);
    expect(firstWeekdayOf('pl-PL')).toBe(1);
    expect(firstWeekdayOf('de-DE')).toBe(1);
    expect(firstWeekdayOf('ja-JP')).toBe(0);
    expect(firstWeekdayOf('ar-EG')).toBe(6);
    expect(firstWeekdayOf('not a locale')).toBe(1);
    expect([0, 1, 6]).toContain(firstWeekdayOf());
  });

  it('reads the region from the locale’s name on an engine without Intl.Locale', () => {
    const intl = Intl as { Locale?: unknown };
    const original = intl.Locale;
    intl.Locale = undefined;
    try {
      expect(firstWeekdayOf('en-US')).toBe(0);
      expect(firstWeekdayOf('en_US')).toBe(0);
      expect(firstWeekdayOf('zh-Hant-TW')).toBe(0);
      expect(firstWeekdayOf('ar-EG')).toBe(6);
      expect(firstWeekdayOf('fr-FR')).toBe(1);
      expect(firstWeekdayOf('en')).toBe(1);
    } finally {
      intl.Locale = original;
    }
  });
});

describe('months', () => {
  it('pages across the ends of years', () => {
    expect(addMonths({ month: 10, year: 2026 }, 1)).toEqual({ month: 11, year: 2026 });
    expect(addMonths({ month: 12, year: 2026 }, 1)).toEqual({ month: 1, year: 2027 });
    expect(addMonths({ month: 1, year: 2026 }, -1)).toEqual({ month: 12, year: 2025 });
    expect(addMonths({ month: 10, year: 2026 }, -22)).toEqual({ month: 12, year: 2024 });
    expect(addMonths({ month: 10, year: 2026 }, 0)).toEqual({ month: 10, year: 2026 });
    expect(isSameMonth(monthOf(date('2026-10-31')), { month: 10, year: 2026 })).toBe(true);
    expect(isSameMonth({ month: 10, year: 2026 }, { month: 10, year: 2027 })).toBe(false);
  });

  it('knows where a month starts and ends, leap years included', () => {
    expect(toIso(firstOfMonth({ month: 2, year: 2028 }))).toBe('2028-02-01');
    expect(toIso(lastOfMonth({ month: 2, year: 2028 }))).toBe('2028-02-29');
    expect(toIso(lastOfMonth({ month: 2, year: 2027 }))).toBe('2027-02-28');
    expect(toIso(lastOfMonth({ month: 10, year: 2026 }))).toBe('2026-10-31');
    expect(toIso(lastOfMonth({ month: 11, year: 2026 }))).toBe('2026-11-30');
  });

  it('lays a month out in whole weeks from the first day of the week', () => {
    // October 2026 starts on a Thursday.
    const monday = monthGrid({ month: 10, year: 2026 }, 1);
    expect(monday).toHaveLength(5);
    expect(monday.every((week) => week.length === 7)).toBe(true);
    expect(monday[0]!.map((day) => day?.day ?? null)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(monday[4]!.map((day) => day?.day ?? null)).toEqual([26, 27, 28, 29, 30, 31, null]);

    const sunday = monthGrid({ month: 10, year: 2026 }, 0);
    expect(sunday[0]!.map((day) => day?.day ?? null)).toEqual([null, null, null, null, 1, 2, 3]);
    expect(sunday[4]!.map((day) => day?.day ?? null)).toEqual([25, 26, 27, 28, 29, 30, 31]);

    const saturday = monthGrid({ month: 10, year: 2026 }, 6);
    expect(saturday[0]!.map((day) => day?.day ?? null)).toEqual([null, null, null, null, null, 1, 2]);
  });

  it('gives every day of the month once, whatever shape the month has', () => {
    // February 2026 is four whole weeks from a Sunday; August 2026 needs six rows from a Monday.
    expect(monthGrid({ month: 2, year: 2026 }, 0)).toHaveLength(4);
    expect(monthGrid({ month: 8, year: 2026 }, 1)).toHaveLength(6);
    for (const month of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const days = monthGrid({ month, year: 2028 }, 1).flat().filter((day) => day !== null);
      expect(days.map((day) => day.day)).toEqual(Array.from({ length: lastOfMonth({ month, year: 2028 }).day }, (_unused, index) => index + 1));
      expect(days.every((day) => day.month === month && day.year === 2028)).toBe(true);
    }
  });
});
