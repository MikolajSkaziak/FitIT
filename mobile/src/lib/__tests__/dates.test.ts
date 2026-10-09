import {
  addYears,
  digitsUpTo,
  emptyDateParts,
  formatCalendarDay,
  formatCalendarWeekday,
  formatClock,
  formatLongDate,
  formatWeekday,
  fromIso,
  fromJsDate,
  isAfter,
  isBlankDate,
  months,
  readDateParts,
  toDateParts,
  toIso,
  toJsDate,
  wallClock,
} from '@/lib/dates';

describe('readDateParts', () => {
  it.each([
    [{ month: 3, day: '14', year: '1999' }, { day: 14, month: 3, year: 1999 }],
    [{ month: 3, day: '1', year: '1999' }, { day: 1, month: 3, year: 1999 }],
    [{ month: 3, day: '01', year: '1999' }, { day: 1, month: 3, year: 1999 }],
    [{ month: 2, day: '29', year: '2024' }, { day: 29, month: 2, year: 2024 }],
    [{ month: 2, day: '29', year: '2000' }, { day: 29, month: 2, year: 2000 }],
  ])('reads %p', (parts, expected) => {
    expect(readDateParts(parts)).toEqual(expected);
  });

  it.each([
    [{ month: null, day: '14', year: '1999' }],
    [{ month: 3, day: '', year: '1999' }],
    [{ month: 3, day: '14', year: '' }],
    [{ month: 3, day: '14', year: '99' }],
    [{ month: 4, day: '31', year: '1999' }],
    [{ month: 2, day: '29', year: '2023' }],
    [{ month: 2, day: '29', year: '1900' }],
    [{ month: 1, day: '0', year: '2000' }],
    [{ month: 3, day: 'ab', year: '1999' }],
  ])('refuses %p', (parts) => {
    expect(readDateParts(parts)).toBeNull();
  });

  it('knows an empty form from a half-filled one', () => {
    expect(isBlankDate(emptyDateParts)).toBe(true);
    expect(isBlankDate({ month: 3, day: '', year: '' })).toBe(false);
    expect(isBlankDate({ month: null, day: '1', year: '' })).toBe(false);
  });

  it('shows a known date in the three parts, and reads it back', () => {
    const date = { day: 5, month: 10, year: 2026 };
    expect(toDateParts(date)).toEqual({ month: 10, day: '5', year: '2026' });
    expect(readDateParts(toDateParts(date))).toEqual(date);
  });

  it('keeps only digits in the day and year boxes, and no more than they take', () => {
    expect(digitsUpTo('1a4', 2)).toBe('14');
    expect(digitsUpTo('140', 2)).toBe('14');
    expect(digitsUpTo('19.99', 4)).toBe('1999');
  });
});

describe('formatting', () => {
  const date = { day: 5, month: 10, year: 2026 };

  it('writes a date the way the API takes it, and for people with the month as a word', () => {
    expect(toIso(date)).toBe('2026-10-05');
    expect(formatLongDate(date)).toBe('October 5, 2026');
    expect(formatLongDate({ day: 6, month: 5, year: 2004 })).toBe('May 6, 2004');
  });

  it('never writes the month as a number', () => {
    expect(months).toHaveLength(12);
    for (const month of [1, 5, 6, 10, 12]) {
      expect(formatLongDate({ day: 6, month, year: 2004 })).toMatch(/^[A-Z][a-z]+ 6, 2004$/);
    }
  });

  it('writes the time on the 12-hour clock', () => {
    expect(formatClock({ hour: 0, minute: 0 })).toBe('12 am');
    expect(formatClock({ hour: 9, minute: 5 })).toBe('9:05 am');
    expect(formatClock({ hour: 12, minute: 0 })).toBe('12 pm');
    expect(formatClock({ hour: 12, minute: 30 })).toBe('12:30 pm');
    expect(formatClock({ hour: 15, minute: 0 })).toBe('3 pm');
    expect(formatClock({ hour: 23, minute: 45 })).toBe('11:45 pm');
  });

  it('reads the date the API sends back', () => {
    expect(fromIso('1999-03-14')).toEqual({ day: 14, month: 3, year: 1999 });
    expect(fromIso('1999-03-14T00:00:00Z')).toEqual({ day: 14, month: 3, year: 1999 });
    expect(fromIso('14.03.1999')).toBeNull();
    expect(fromIso('1999-02-30')).toBeNull();
  });

  it('names the weekday and the month', () => {
    expect(formatWeekday(new Date(2026, 9, 5))).toBe('Monday, October 5');
    expect(formatWeekday(new Date(2027, 0, 3))).toBe('Sunday, January 3');
  });

  it('goes to a system date and back without moving a day', () => {
    const picked = toJsDate({ day: 31, month: 12, year: 1999 });
    expect(fromJsDate(picked)).toEqual({ day: 31, month: 12, year: 1999 });
  });
});

describe('comparing', () => {
  it('orders days', () => {
    expect(isAfter({ day: 2, month: 1, year: 2000 }, { day: 1, month: 1, year: 2000 })).toBe(true);
    expect(isAfter({ day: 1, month: 1, year: 2000 }, { day: 1, month: 1, year: 2000 })).toBe(false);
    expect(isAfter({ day: 31, month: 12, year: 1999 }, { day: 1, month: 1, year: 2000 })).toBe(false);
  });

  it('adds years, landing on 28 February when there is no 29th', () => {
    expect(addYears({ day: 29, month: 2, year: 2008 }, 16)).toEqual({ day: 29, month: 2, year: 2024 });
    expect(addYears({ day: 29, month: 2, year: 2008 }, 17)).toEqual({ day: 28, month: 2, year: 2025 });
    expect(addYears({ day: 5, month: 10, year: 2026 }, -120)).toEqual({ day: 5, month: 10, year: 1906 });
  });
});

describe('wallClock', () => {
  it('keeps the clock of the place the timestamp is stamped with', () => {
    expect(wallClock('2026-10-05T07:00:00+02:00')).toEqual({ date: { day: 5, month: 10, year: 2026 }, hour: 7, minute: 0 });
    // Seven in the morning in Tokyo is still the fifth there, though it is the fourth in UTC.
    expect(wallClock('2026-10-05T07:30:00+09:00')).toEqual({ date: { day: 5, month: 10, year: 2026 }, hour: 7, minute: 30 });
    expect(wallClock('2026-10-05T23:15:00-07:00')?.hour).toBe(23);
  });

  it('refuses what is not a timestamp', () => {
    expect(wallClock('2026-10-05')).toBeNull();
    expect(wallClock('2026-02-30T07:00:00Z')).toBeNull();
    expect(wallClock('soon')).toBeNull();
  });
});

describe('calendar days', () => {
  it('names a calendar date, adding the year only when it is not this one', () => {
    const now = new Date(2026, 9, 5);
    expect(formatCalendarDay({ day: 3, month: 10, year: 2026 }, now)).toBe('October 3');
    expect(formatCalendarDay({ day: 28, month: 12, year: 2025 }, now)).toBe('December 28, 2025');
    expect(formatCalendarWeekday({ day: 5, month: 10, year: 2026 })).toBe('Monday, October 5');
  });
});
