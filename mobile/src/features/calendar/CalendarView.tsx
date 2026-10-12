import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { Fade } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import {
  firstOfMonth,
  firstWeekdayOf,
  formatSpokenDay,
  fromIso,
  isBefore,
  isSameMonth,
  lastOfMonth,
  monthOf,
  toIso,
  type CalendarDate,
  type CalendarMonth,
} from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { motion, space } from '@/theme';

import { calendarCopy } from './copy';
import { DayEntries } from './DaySection';
import { MonthGrid, MonthGridSkeleton } from './MonthGrid';
import { MonthHead } from './MonthHead';
import { usePickOutfit } from './session';
import { entriesOn, todayOf, useCalendarActions, useCalendarRange, useCanPlan, usePlaceToday } from './useCalendar';

interface CalendarViewProps {
  /** The day to open on ("2026-10-15"): the calendar starts on its month with it chosen. Today when left out. */
  openOn?: string;
}

/**
 * The calendar of the Outfits tab: a month at a time, and under it the day that is chosen with the outfits it holds.
 * Looking back it is what was worn; looking ahead it is what is planned. Months are asked for one by one and kept, so
 * paging back to one is instant; a new page cross-fades in, nothing slides.
 */
export function CalendarView({ openOn }: CalendarViewProps) {
  const known = usePlaceToday();
  const start = (openOn ? fromIso(openOn) : null) ?? known;
  const [month, setMonth] = useState<CalendarMonth>(monthOf(start));
  const [selected, setSelected] = useState<CalendarDate>(start);
  const firstWeekday = firstWeekdayOf();
  const canPlan = useCanPlan();
  const pickOutfit = usePickOutfit();
  const actions = useCalendarActions();

  const calendar = useCalendarRange(firstOfMonth(month), lastOfMonth(month));
  // The server says what day it is where the person is; until it answers, the forecast's clock or the phone's stands in.
  const today = todayOf(calendar.data) ?? known;
  const date = toIso(selected);
  const entries = entriesOn(calendar.data, date);
  const page = `${month.year}-${month.month}`;

  const turn = (to: CalendarMonth) => {
    setMonth(to);
    // The day under the grid belongs to the page shown: today on its own month, the first of any other.
    setSelected(isSameMonth(to, monthOf(today)) ? today : firstOfMonth(to));
  };

  const add = async () => {
    const outfit = await pickOutfit(date);
    if (outfit && (await actions.add(outfit, date, isBefore(selected, today)))) {
      haptics.success();
    }
  };

  return (
    <View style={styles.calendar} testID="calendar-view">
      <MonthHead month={month} today={today} onTurn={turn} />

      {calendar.isPending ? (
        <Fade key={`loading-${page}`} enter={false} exit duration={motion.exit}>
          <MonthGridSkeleton month={month} firstWeekday={firstWeekday} />
        </Fade>
      ) : calendar.isError ? (
        <Fade key={`problem-${page}`} style={styles.message} testID="calendar-problem">
          <AppText color="textSecondary">{messageFor(calendar.error)}</AppText>
          <Button label="Try again" kind="secondary" inline busy={calendar.isFetching} onPress={() => void calendar.refetch()} testID="calendar-retry" />
        </Fade>
      ) : (
        <Fade key={page} duration={motion.enter}>
          <MonthGrid month={month} today={today} selected={date} onSelect={setSelected} calendar={calendar.data} firstWeekday={firstWeekday} />
        </Fade>
      )}

      {calendar.isSuccess ? (
        <View style={styles.day} testID="calendar-day">
          <AppText variant="eyebrow" accessibilityRole="header" testID="calendar-day-title">
            {selected.year === today.year ? formatSpokenDay(selected) : `${formatSpokenDay(selected)}, ${selected.year}`}
          </AppText>
          {entries.length > 0 ? (
            <DayEntries entries={entries} today={today} size="row" onConfirm={actions.confirm} onRemove={(entry) => void actions.remove(entry)} style={styles.entries} />
          ) : (
            <AppText variant="secondary" color="textSecondary" testID="calendar-day-empty">
              {calendarCopy.empty}
            </AppText>
          )}
          <FormError message={actions.error ? messageFor(actions.error) : null} />
          {canPlan ? <Button label={calendarCopy.add} kind="text" icon="plus" compact inline onPress={() => void add()} style={styles.flush} testID="calendar-add" /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: space[4] },
  message: { gap: space[3], alignItems: 'flex-start' },
  day: { gap: space[3] },
  entries: { gap: space[3] },
  // A text button carries its own horizontal padding; here it has none, so it starts at the page's left edge.
  flush: { paddingHorizontal: 0 },
});
