import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  addCalendarEntry,
  calendarKeys,
  fetchCalendar,
  removeCalendarEntry,
  updateCalendarEntry,
  type Calendar,
  type CalendarEntry,
  type OutfitDay,
} from '@/api/calendar';
import { outfitKeys, type Outfit } from '@/api/outfits';
import { wardrobeKeys } from '@/api/wardrobe';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { fromIso, toIso, today, wallClock, type CalendarDate } from '@/lib/dates';
import * as haptics from '@/lib/haptics';

/**
 * The single place to gate planning later (the calendar was sketched as a Plus feature): every way to put an outfit on a
 * day asks here first. Everyone may plan for now.
 */
export function useCanPlan(): boolean {
  return true;
}

/**
 * The day it is where the person's weather place lies, as far as the phone already knows it: from the forecast it holds
 * (stamped with the clock of the place), otherwise the phone's own date. A calendar answer carries its own `today`.
 */
export function usePlaceToday(): CalendarDate {
  // Reads what is already there; it never asks for a forecast by itself.
  const forecast = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs, enabled: false }).data;
  return (forecast ? wallClock(forecast.from)?.date : null) ?? today();
}

/** A stretch of the calendar, both ends included. Each stretch is kept on its own, so a month looked at before is there at once. */
export function useCalendarRange(from: CalendarDate, to: CalendarDate, enabled = true) {
  const first = toIso(from);
  const last = toIso(to);
  return useQuery({ queryKey: calendarKeys.range(first, last), queryFn: () => fetchCalendar(first, last), enabled });
}

/** The entries of one day of an answer; none when the day holds nothing or the answer is not there yet. */
export const entriesOn = (calendar: Calendar | undefined, date: string): readonly CalendarEntry[] =>
  calendar?.days.find((day) => day.date === date)?.entries ?? noEntries;

const noEntries: readonly CalendarEntry[] = [];

/** The person's own today as a calendar answer tells it. */
export const todayOf = (calendar: Calendar | undefined): CalendarDate | null => (calendar ? fromIso(calendar.today) : null);

/** Changes the entries of one day in every stretch the phone holds that reaches it, and in the list of the outfit's own days. */
function editDay(queryClient: QueryClient, date: string, edit: (entries: readonly CalendarEntry[]) => CalendarEntry[]): void {
  for (const [key, calendar] of queryClient.getQueriesData<Calendar>({ queryKey: calendarKeys.ranges })) {
    const [, , from, to] = key as ReturnType<typeof calendarKeys.range>;
    // ISO dates sort as text.
    if (!calendar || date < from || date > to) {
      continue;
    }

    const entries = edit(entriesOn(calendar, date));
    const others = calendar.days.filter((day) => day.date !== date);
    const days = entries.length > 0 ? [...others, { date, entries }].sort((a, b) => a.date.localeCompare(b.date)) : others;
    queryClient.setQueryData<Calendar>(key, { ...calendar, days });
  }
}

function editOutfitDays(queryClient: QueryClient, outfitId: string, edit: (days: OutfitDay[]) => OutfitDay[]): void {
  queryClient.setQueryData<OutfitDay[]>(calendarKeys.outfit(outfitId), (days) => (days ? edit(days).sort((a, b) => a.date.localeCompare(b.date)) : days));
}

interface Planned {
  outfit: Outfit;
  date: string;
  /** The day has passed, or the outfit is worn today: the entry is a worn one from the start. */
  worn: boolean;
}

interface Marked {
  entry: CalendarEntry;
  worn: boolean;
}

/**
 * What a person does on the calendar: puts an outfit on a day, says "I wore this", takes an outfit off a day. Each shows
 * its result at once and goes back if the server refuses; a refusal is in `error`, and felt through `queryClient`, which
 * gives the cue for every action that fails. A worn day changes what the wardrobe says, so those lists are asked again.
 */
export function useCalendarActions() {
  const queryClient = useQueryClient();

  const snapshot = async () => {
    await queryClient.cancelQueries({ queryKey: calendarKeys.all });
    return queryClient.getQueriesData({ queryKey: calendarKeys.all });
  };
  const restore = (before: Awaited<ReturnType<typeof snapshot>> | undefined) => {
    for (const [key, data] of before ?? []) {
      queryClient.setQueryData(key, data);
    }
  };
  const settled = (worn: boolean) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    if (worn) {
      // When an outfit was last worn, and how much of the wardrobe is in use, follow from the calendar.
      void queryClient.invalidateQueries({ queryKey: outfitKeys.all });
      void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
      void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
    }
  };

  const add = useMutation({
    mutationFn: ({ outfit, date, worn }: Planned) => addCalendarEntry(date, outfit.id, worn || undefined),
    onMutate: async ({ outfit, date, worn }) => {
      const before = await snapshot();
      const pending: CalendarEntry = { id: pendingId(outfit.id, date), date, worn, outfit, createdAt: new Date().toISOString() };
      editDay(queryClient, date, (entries) => (entries.some((entry) => entry.outfit.id === outfit.id) ? [...entries] : [...entries, pending]));
      editOutfitDays(queryClient, outfit.id, (days) => (days.some((day) => day.date === date) ? days : [...days, { id: pending.id, date, worn }]));
      return before;
    },
    onError: (_error, _planned, before) => restore(before),
    onSuccess: (entry, { outfit, date }) => {
      editDay(queryClient, date, (entries) => entries.map((found) => (found.outfit.id === outfit.id ? entry : found)));
      editOutfitDays(queryClient, outfit.id, (days) => days.map((day) => (day.date === date ? { id: entry.id, date, worn: entry.worn } : day)));
    },
    onSettled: (entry, _error, { worn }) => settled(worn || entry?.worn === true),
  });

  const mark = useMutation({
    mutationFn: ({ entry, worn }: Marked) => updateCalendarEntry(entry.id, worn),
    onMutate: async ({ entry, worn }) => {
      const before = await snapshot();
      editDay(queryClient, entry.date, (entries) => entries.map((found) => (found.id === entry.id ? { ...found, worn } : found)));
      editOutfitDays(queryClient, entry.outfit.id, (days) => days.map((day) => (day.id === entry.id ? { ...day, worn } : day)));
      return before;
    },
    onError: (_error, _marked, before) => restore(before),
    onSuccess: (_entry, { worn }) => {
      if (worn) {
        haptics.success();
      }
    },
    onSettled: () => settled(true),
  });

  const remove = useMutation({
    mutationFn: (entry: CalendarEntry) => removeCalendarEntry(entry.id),
    onMutate: async (entry) => {
      const before = await snapshot();
      editDay(queryClient, entry.date, (entries) => entries.filter((found) => found.id !== entry.id));
      editOutfitDays(queryClient, entry.outfit.id, (days) => days.filter((day) => day.id !== entry.id));
      return before;
    },
    onError: (_error, _entry, before) => restore(before),
    onSettled: (_nothing, _error, entry) => settled(entry.worn),
  });

  return {
    /** Puts the outfit on the day; answers with the entry once the server has it, or null when it refused. */
    add: (outfit: Outfit, date: string, worn = false): Promise<CalendarEntry | null> => add.mutateAsync({ outfit, date, worn }).catch(() => null),
    /** "I wore this". */
    confirm: (entry: CalendarEntry) => mark.mutate({ entry, worn: true }),
    /** Takes the outfit off the day; answers whether the server did. */
    remove: (entry: CalendarEntry): Promise<boolean> =>
      remove.mutateAsync(entry).then(
        () => true,
        () => false,
      ),
    /** The last thing the server refused, if any. */
    error: add.error ?? mark.error ?? remove.error,
    adding: add.isPending,
  };
}

/** The id an entry has on the phone until the server has given it one. */
export const pendingId = (outfitId: string, date: string): string => `pending:${outfitId}:${date}`;

export const isPending = (entry: Pick<CalendarEntry, 'id'>): boolean => entry.id.startsWith('pending:');
