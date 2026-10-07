import { addYears, formatCalendarDay, formatCalendarWeekday, formatDate, formatLongDate, formatWeekday, fromIso, fromJsDate, isAfter, maskDate, parseDate, toIso, toJsDate, wallClock } from '@/lib/dates';

describe('parseDate', () => {
  it.each([
    ['14.03.1999', { day: 14, month: 3, year: 1999 }],
    ['1.3.1999', { day: 1, month: 3, year: 1999 }],
    ['14-03-1999', { day: 14, month: 3, year: 1999 }],
    ['14/03/1999', { day: 14, month: 3, year: 1999 }],
    [' 29.02.2024 ', { day: 29, month: 2, year: 2024 }],
  ])('reads %s', (text, expected) => {
    expect(parseDate(text)).toEqual(expected);
  });

  it.each(['', '14.03', '14.03.99', '31.04.1999', '29.02.2023', '29.02.1900', '00.01.2000', '12.13.2000', 'abc', '1999-03-14'])(
    'refuses %p',
    (text) => {
      expect(parseDate(text)).toBeNull();
    },
  );

  it('knows that 2000 was a leap year', () => {
    expect(parseDate('29.02.2000')).not.toBeNull();
  });
});

describe('formatting', () => {
  const date = { day: 5, month: 10, year: 2026 };

  it('writes a date the Polish way and the way the API takes it', () => {
    expect(formatDate(date)).toBe('05.10.2026');
    expect(toIso(date)).toBe('2026-10-05');
    expect(formatLongDate(date)).toBe('5 października 2026');
  });

  it('reads the date the API sends back', () => {
    expect(fromIso('1999-03-14')).toEqual({ day: 14, month: 3, year: 1999 });
    expect(fromIso('1999-03-14T00:00:00Z')).toEqual({ day: 14, month: 3, year: 1999 });
    expect(fromIso('14.03.1999')).toBeNull();
    expect(fromIso('1999-02-30')).toBeNull();
  });

  it('names the weekday and the month in the genitive', () => {
    expect(formatWeekday(new Date(2026, 9, 5))).toBe('poniedziałek, 5 października');
    expect(formatWeekday(new Date(2027, 0, 3))).toBe('niedziela, 3 stycznia');
  });

  it('goes to a system date and back without moving a day', () => {
    const picked = toJsDate({ day: 31, month: 12, year: 1999 });
    expect(fromJsDate(picked)).toEqual({ day: 31, month: 12, year: 1999 });
  });
});

describe('maskDate', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['14', '14'],
    ['140', '14.0'],
    ['1403', '14.03'],
    ['14031', '14.03.1'],
    ['14031999', '14.03.1999'],
    ['140319991', '14.03.1999'],
    ['14.03.1999', '14.03.1999'],
    ['14.', '14'],
    ['14.03.', '14.03'],
    ['1a4', '14'],
  ])('turns %p into %p', (typed, shown) => {
    expect(maskDate(typed)).toBe(shown);
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
    expect(formatCalendarDay({ day: 3, month: 10, year: 2026 }, now)).toBe('3 października');
    expect(formatCalendarDay({ day: 28, month: 12, year: 2025 }, now)).toBe('28 grudnia 2025');
    expect(formatCalendarWeekday({ day: 5, month: 10, year: 2026 })).toBe('poniedziałek, 5 października');
  });
});
