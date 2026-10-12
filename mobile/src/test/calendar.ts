import type * as calendarApi from '@/api/calendar';

/**
 * The calendar's API for tests of screens that are not about the calendar: an empty calendar seen on Monday 5 October
 * 2026 and an outfit that stands on no day, so nothing reaches for the network. Use it as the factory of
 * `jest.mock('@/api/calendar', ...)`; a test about the calendar sets its own answers on the same mocks.
 */
export function quietCalendar(): typeof calendarApi {
  const actual = jest.requireActual<typeof calendarApi>('@/api/calendar');
  return {
    ...actual,
    fetchCalendar: jest.fn(async () => ({ today: '2026-10-05', forecastUntil: '2026-10-11', maxPerDay: 3, days: [] })),
    fetchOutfitDays: jest.fn(async () => []),
    addCalendarEntry: jest.fn(),
    updateCalendarEntry: jest.fn(),
    removeCalendarEntry: jest.fn(),
  };
}
