import { StyleSheet, View } from 'react-native';

import type { Calendar } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { Skeleton } from '@/components/lists';
import { PressScale, ToggleFade } from '@/components/motion';
import { addDays, isSameDay, monthGrid, toIso, weekdayInitial, weekdayName, type CalendarDate, type CalendarMonth } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { size, space, useTheme } from '@/theme';

import { calendarCopy, cellLabel } from './copy';
import { DayMark, markHeight } from './DayMark';
import { entriesOn } from './useCalendar';

/** The disc behind a day's number: ringed for today, filled for the chosen day. */
const disc = 32;
const cellHeight = disc + markHeight + space[2];

interface MonthGridProps {
  month: CalendarMonth;
  /** The person's own today. */
  today: CalendarDate;
  /** The chosen day, "2026-10-15"; none while nothing is chosen. */
  selected: string | null;
  onSelect: (date: CalendarDate) => void;
  /** What the days hold; left out while it is on its way. */
  calendar?: Calendar;
  /** 0 Sunday to 6 Saturday: the first column. */
  firstWeekday: number;
  /** Why a day cannot be chosen (said after its date), or null when it can. */
  refused?: (date: CalendarDate) => string | null;
  /** Days that already hold the outfit being planned: said so, and marked like a chosen answer. */
  held?: (date: string) => boolean;
  testID?: string;
}

/**
 * One month as a page of a calendar: a row of weekday initials, then the weeks. A cell is a button that says its whole
 * date and what the day holds; today is ringed with a hairline in the action colour, the chosen day is filled with the
 * colour of the well, and a day with an outfit carries a small mark under its number. The marks are a dot and a check
 * rather than board thumbnails: a cell is 47 points wide on a 375 point phone, where a board would be a smudge.
 */
export function MonthGrid({ month, today, selected, onSelect, calendar, firstWeekday, refused, held, testID = 'month-grid' }: MonthGridProps) {
  const theme = useTheme();
  const weeks = monthGrid(month, firstWeekday);
  // Any week names the columns; this one starts on a Sunday.
  const sunday = { day: 4, month: 1, year: 1970 };
  const columns = Array.from({ length: 7 }, (_unused, index) => addDays(sunday, (firstWeekday + index) % 7));

  return (
    <View testID={testID}>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {columns.map((day) => (
          <View key={weekdayName(day)} style={styles.column}>
            <AppText variant="eyebrow">{weekdayInitial(day)}</AppText>
          </View>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) => {
            if (!day) {
              return <View key={`blank-${column}`} style={styles.cell} />;
            }

            const date = toIso(day);
            const chosen = date === selected;
            const isToday = isSameDay(day, today);
            const entries = entriesOn(calendar, date);
            const reason = refused?.(day) ?? null;
            const holds = held?.(date) ?? false;
            return (
              <PressScale
                key={date}
                accessibilityRole="button"
                accessibilityLabel={cellLabel(day, entries, { today: isToday, selected: chosen, refused: reason, held: holds })}
                accessibilityState={{ selected: chosen, disabled: reason !== null }}
                disabled={reason !== null}
                haptic="none"
                onPress={() => {
                  if (!chosen) {
                    haptics.select();
                  }

                  onSelect(day);
                }}
                style={styles.cell}
                testID={`${testID}-${date}`}>
                <View style={[styles.disc, isToday ? { borderWidth: 1, borderColor: theme.action } : null]}>
                  <ToggleFade on={chosen} style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: theme.sage }]} />
                  <AppText variant={isToday || chosen ? 'secondaryStrong' : 'secondary'} color={reason !== null ? 'disabledText' : chosen ? 'onSage' : 'text'} tabular>
                    {day.day}
                  </AppText>
                </View>
                <DayMark entries={entries} />
              </PressScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The page as it will look while the month is on its way: the same rows of discs, shimmering, nothing to press. */
export function MonthGridSkeleton({ month, firstWeekday }: Pick<MonthGridProps, 'month' | 'firstWeekday'>) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={calendarCopy.loading} testID="month-grid-loading">
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_unused, index) => (
          <View key={index} style={styles.column}>
            <Skeleton width={12} height={12} />
          </View>
        ))}
      </View>
      {monthGrid(month, firstWeekday).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) => (
            <View key={column} style={styles.cell}>
              {day ? <Skeleton width={disc} height={disc} radius={disc / 2} /> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  column: { flex: 1, height: space[6], alignItems: 'center', justifyContent: 'center' },
  // A seventh of the column wide (47 points on the narrowest phone) and taller than a touch target.
  cell: { flex: 1, minWidth: size.touch, height: cellHeight, minHeight: size.touch, alignItems: 'center', justifyContent: 'center', gap: 2 },
  disc: { width: disc, height: disc, borderRadius: disc / 2, alignItems: 'center', justifyContent: 'center' },
  fill: { borderRadius: disc / 2 },
});
