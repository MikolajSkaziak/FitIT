import { StyleSheet, View } from 'react-native';

import type { Calendar } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { PressScale, ToggleFade } from '@/components/motion';
import { addDays, toIso, weekdayShort, type CalendarDate } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { radius, size, space, useTheme } from '@/theme';

import { cellLabel, horizonDays } from './copy';
import { DayMark } from './DayMark';
import { entriesOn } from './useCalendar';

interface WeekStripProps {
  /** The person's own today: the first day of the strip. */
  today: CalendarDate;
  /** The chosen day, "2026-10-15". */
  selected: string;
  onSelect: (date: string) => void;
  /** What the days hold, once it is known. */
  calendar?: Calendar;
}

/**
 * The seven days outfits can be dressed for, today first: the weekday over the number, and under it a mark when the day
 * holds an outfit. One of them is chosen and sits on a capsule the colour of the well, like the chosen tab of the bar.
 * Choosing a day turns the page into that day.
 */
export function WeekStrip({ today, selected, onSelect, calendar }: WeekStripProps) {
  const theme = useTheme();
  const days = Array.from({ length: horizonDays }, (_unused, index) => addDays(today, index));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Day" style={styles.strip} testID="week-strip">
      {days.map((day, index) => {
        const date = toIso(day);
        const chosen = date === selected;
        const entries = entriesOn(calendar, date);
        return (
          <PressScale
            key={date}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            accessibilityLabel={cellLabel(day, entries, { today: index === 0, selected: false })}
            haptic="none"
            onPress={() => {
              // Choosing the day that is already chosen changes nothing, so it gives no cue.
              if (!chosen) {
                haptics.select();
                onSelect(date);
              }
            }}
            style={styles.cell}
            testID={`week-day-${date}`}>
            <ToggleFade on={chosen} style={[StyleSheet.absoluteFill, styles.capsule, { backgroundColor: theme.sage }]} />
            <AppText variant="eyebrow" color={chosen ? 'onSage' : 'textSecondary'} numberOfLines={1}>
              {index === 0 ? 'Today' : weekdayShort(day)}
            </AppText>
            <AppText variant="title" color={chosen ? 'onSage' : 'text'} tabular>
              {day.day}
            </AppText>
            <DayMark entries={entries} />
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Seven cells share the column: 47 points each on the narrowest phone, so every one is a full touch target.
  strip: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: size.touch, minHeight: size.touch, paddingVertical: space[2], alignItems: 'center', gap: 2 },
  capsule: { borderRadius: radius.control },
});
