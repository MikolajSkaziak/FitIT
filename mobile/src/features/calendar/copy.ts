import type { CalendarEntry, OutfitDay } from '@/api/calendar';
import { daysBetween, formatShortDay, formatShortWeekday, formatSpokenDay, fromIso, weekdayName, type CalendarDate } from '@/lib/dates';

/** How many days the forecast reaches, today included: outfits can be suggested for these. */
export const horizonDays = 7;

/** How many days the plan sheet offers at once before "Pick another date". */
export const sheetDays = 14;

/** How many outfits a day can be planned with, until the server says otherwise. */
export const maxPerDay = 3;

/** How long the line that confirms a plan stays, with its Undo. */
export const noticeLingerMs = 6000;

/**
 * The day as it is said after "for": "today", "tomorrow", the weekday within the coming week ("Thursday"), and the date
 * beyond it or behind us ("Oct 15").
 */
export function dayWord(date: CalendarDate, today: CalendarDate): string {
  const ahead = daysBetween(today, date);
  if (ahead === 0) {
    return 'today';
  }

  if (ahead === 1) {
    return 'tomorrow';
  }

  return ahead > 1 && ahead < horizonDays ? weekdayName(date) : formatShortDay(date);
}

export const planLabel = (date: CalendarDate, today: CalendarDate): string => `Plan for ${dayWord(date, today)}`;

export const plannedLabel = (date: CalendarDate, today: CalendarDate): string => `Planned for ${dayWord(date, today)}`;

/** Over the outfits of a day on the Today page: "Planned for Thursday", and "Worn today" once nothing on it is still a plan. */
export const daySectionTitle = (entries: readonly Pick<CalendarEntry, 'worn'>[], date: CalendarDate, today: CalendarDate): string =>
  entries.length > 0 && entries.every((entry) => entry.worn) ? `Worn ${dayWord(date, today)}` : plannedLabel(date, today);

export const suggestLabel = (date: CalendarDate, today: CalendarDate): string => `Suggest looks for ${dayWord(date, today)}`;

/** The title of proposals made for a day: "Looks for Thursday". */
export const looksTitle = (date: CalendarDate, today: CalendarDate): string => `Looks for ${dayWord(date, today)}`;

/** Whether outfits can be suggested for the day: today or one of the next six. */
export const withinHorizon = (date: CalendarDate, today: CalendarDate): boolean => {
  const ahead = daysBetween(today, date);
  return ahead >= 0 && ahead < horizonDays;
};

/** The small label on an entry: what the day holds it as. */
export const entryTag = (entry: Pick<CalendarEntry, 'worn'>): 'Worn' | 'Planned' => (entry.worn ? 'Worn' : 'Planned');

const count = (value: number, one: string, many: string): string => `${value} ${value === 1 ? one : many}`;

/** "1 planned outfit", "2 worn outfits", "1 worn and 1 planned outfit"; nothing for an empty day. */
export function entriesWords(entries: readonly Pick<CalendarEntry, 'worn'>[]): string | null {
  const worn = entries.filter((entry) => entry.worn).length;
  const planned = entries.length - worn;
  if (worn > 0 && planned > 0) {
    return `${worn} worn and ${count(planned, 'planned outfit', 'planned outfits')}`;
  }

  return worn > 0 ? count(worn, 'worn outfit', 'worn outfits') : planned > 0 ? count(planned, 'planned outfit', 'planned outfits') : null;
}

interface CellState {
  today: boolean;
  selected: boolean;
  /** Why the day cannot be chosen, when it cannot. */
  refused?: string | null;
  /** The outfit being planned already stands on this day. */
  held?: boolean;
}

/** What a screen reader says for a day of the calendar: "Thursday, October 15, today, 1 planned outfit, selected". */
export const cellLabel = (date: CalendarDate, entries: readonly Pick<CalendarEntry, 'worn'>[], state: CellState): string =>
  [formatSpokenDay(date), state.today ? 'today' : null, entriesWords(entries), state.held ? 'this outfit is planned here' : null, state.refused ?? null, state.selected ? 'selected' : null]
    .filter(Boolean)
    .join(', ');

/**
 * One quiet line about the days an outfit stands on: the next planned day first ("Planned for Thu, Oct 15"), otherwise
 * the last worn one ("Worn Oct 6"), with how many more there are. Null when it stands on none.
 */
export function outfitDaysLine(days: readonly OutfitDay[], today: CalendarDate): { text: string; date: string } | null {
  const dated = days.flatMap((day) => {
    const date = fromIso(day.date);
    return date ? [{ ...day, on: date }] : [];
  });
  const upcoming = dated.filter((day) => !day.worn && daysBetween(today, day.on) >= 0).sort((a, b) => daysBetween(b.on, a.on));
  const worn = dated.filter((day) => day.worn).sort((a, b) => daysBetween(a.on, b.on));
  const lead = upcoming[0] ?? worn[0] ?? dated[dated.length - 1];
  if (!lead) {
    return null;
  }

  const more = dated.length - 1;
  const words = lead.worn ? `Worn ${formatShortDay(lead.on)}` : `Planned for ${formatShortWeekday(lead.on)}`;
  return { text: more > 0 ? `${words} and ${more} more` : words, date: lead.date };
}

export const calendarCopy = {
  wore: 'I wore this',
  remove: 'Remove from this day',
  add: 'Add an outfit to this day',
  empty: 'Nothing here yet.',
  pickSaved: 'Pick from saved outfits',
  planADay: 'Plan for a day',
  otherDay: 'Plan for another day',
  sheetTitle: 'Wear it when?',
  pickAnother: 'Pick another date',
  full: 'This day already has three outfits',
  undo: 'Undo',
  loading: 'Loading the calendar',
} as const;
