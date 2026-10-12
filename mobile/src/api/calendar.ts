import { api, type Schemas } from './client';
import { unwrap } from './problem';

/** One outfit on one day: planned while `worn` is false, also once the day has passed. */
export type CalendarEntry = Schemas['CalendarEntryResponse'];
export type CalendarDay = Schemas['CalendarDayResponse'];
/** A stretch of the calendar: the days that hold something, the person's own today, and how far outfits can be suggested. */
export type Calendar = Schemas['CalendarResponse'];
/** One day an outfit stands on. */
export type OutfitDay = Schemas['OutfitDayResponse'];

/** The days from `from` to `to` (both included, "2026-10-15") that hold something. At most 62 days at a time. */
export const fetchCalendar = (from: string, to: string): Promise<Calendar> => unwrap(api.GET('/api/calendar', { params: { query: { from, to } } }));

/**
 * Puts an outfit on a day. Today and the days ahead are planned; a day that has passed is recorded as worn. The same
 * outfit on the same day again answers with the entry that is already there.
 */
export const addCalendarEntry = (date: string, outfitId: string, worn?: boolean): Promise<CalendarEntry> =>
  unwrap(api.POST('/api/calendar', { body: { date, outfitId, worn: worn ?? null } }));

/** "I wore this" for an entry of today or a day that has passed, or taking it back. */
export const updateCalendarEntry = (id: string, worn: boolean): Promise<CalendarEntry> =>
  unwrap(api.PATCH('/api/calendar/{id}', { params: { path: { id } }, body: { worn } }));

export const removeCalendarEntry = async (id: string): Promise<void> => {
  await unwrap(api.DELETE('/api/calendar/{id}', { params: { path: { id } } }));
};

/** Every day one outfit stands on, oldest first. */
export const fetchOutfitDays = (outfitId: string): Promise<OutfitDay[]> => unwrap(api.GET('/api/outfits/{id}/days', { params: { path: { id: outfitId } } }));

export const calendarKeys = {
  all: ['calendar'] as const,
  ranges: ['calendar', 'range'] as const,
  /** One answer per stretch of days: a month of the grid, the week of the strip, the fortnight of the plan sheet. */
  range: (from: string, to: string) => ['calendar', 'range', from, to] as const,
  outfit: (outfitId: string) => ['calendar', 'outfit', outfitId] as const,
};
