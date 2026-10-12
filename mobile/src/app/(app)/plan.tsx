import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Calendar } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { IconButton, LinkText } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { Fade, PressScale, ToggleFade } from '@/components/motion';
import { calendarCopy, cellLabel, maxPerDay, sheetDays } from '@/features/calendar/copy';
import { DayMark, markHeight } from '@/features/calendar/DayMark';
import { MonthGrid } from '@/features/calendar/MonthGrid';
import { MonthHead } from '@/features/calendar/MonthHead';
import { finishPickDay } from '@/features/calendar/session';
import { entriesOn, todayOf, useCalendarRange, usePlaceToday } from '@/features/calendar/useCalendar';
import { addDays, daysBetween, firstOfMonth, firstWeekdayOf, lastOfMonth, monthOf, toIso, weekdayShort, type CalendarDate, type CalendarMonth } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { radius, size, space, useTheme } from '@/theme';

/** How far ahead the server keeps a plan. */
const maxDaysAhead = 365;

/**
 * "Wear it when?": the next fourteen days as a grid of days, and "Pick another date" for a month to page through.
 * Choosing a day answers whoever opened the sheet (`usePickDay`) and closes it; the saving, and its Undo, happen there.
 * A day that already holds the outfit is marked and cannot be chosen again; a day with three outfits is full and says so.
 */
export default function PlanSheet() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ outfit?: string; date?: string }>();
  const known = usePlaceToday();
  const [month, setMonth] = useState<CalendarMonth | null>(null);

  const fortnight = useCalendarRange(known, addDays(known, sheetDays - 1));
  const today = todayOf(fortnight.data) ?? known;
  const page = useCalendarRange(firstOfMonth(month ?? monthOf(today)), lastOfMonth(month ?? monthOf(today)), month !== null);
  const limit = fortnight.data?.maxPerDay ?? maxPerDay;

  // Closed some other way (swiped down): the opener still gets its answer.
  useEffect(() => () => finishPickDay(null), []);

  const holds = (calendar: Calendar | undefined, date: string) => entriesOn(calendar, date).some((entry) => entry.outfit.id === params.outfit);
  const reasonOn = (calendar: Calendar | undefined, day: CalendarDate): string | null => {
    const date = toIso(day);
    if (holds(calendar, date)) {
      return 'already planned';
    }

    if (entriesOn(calendar, date).length >= limit) {
      return calendarCopy.full.toLowerCase();
    }

    return daysBetween(today, day) > maxDaysAhead ? 'too far ahead' : null;
  };
  const choose = (day: CalendarDate) => {
    finishPickDay(day);
    router.back();
  };

  const days = Array.from({ length: sheetDays }, (_unused, index) => addDays(today, index));
  const anyFull = days.some((day) => entriesOn(fortnight.data, toIso(day)).length >= limit && !holds(fortnight.data, toIso(day)));
  const anyHeld = days.some((day) => holds(fortnight.data, toIso(day)));

  // The root stays a real native view and the first thing in it is not a ScrollView: react-native-screens sizes the sheet
  // from the root, and resizes a ScrollView it finds first to the whole sheet.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="plan-sheet">
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header" style={styles.title}>
          {calendarCopy.sheetTitle}
        </AppText>
        <IconButton icon="close" label="Close" onPress={() => router.back()} testID="plan-close" />
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.days} testID="plan-days">
          {days.map((day, index) => {
            const date = toIso(day);
            const entries = entriesOn(fortnight.data, date);
            const held = holds(fortnight.data, date);
            const reason = reasonOn(fortnight.data, day);
            const preselected = date === params.date && reason === null;
            return (
              <PressScale
                key={date}
                accessibilityRole="button"
                accessibilityLabel={cellLabel(day, entries, { today: index === 0, selected: preselected, refused: held ? null : reason, held })}
                accessibilityState={{ disabled: reason !== null, selected: preselected }}
                disabled={reason !== null}
                haptic="none"
                onPress={() => {
                  haptics.press('primary');
                  choose(day);
                }}
                style={styles.day}
                testID={`plan-day-${date}`}>
                <ToggleFade on={preselected} style={[StyleSheet.absoluteFill, styles.capsule, { backgroundColor: theme.sage }]} />
                <AppText variant="eyebrow" color={reason !== null && !held ? 'disabledText' : preselected ? 'onSage' : 'textSecondary'} numberOfLines={1}>
                  {index === 0 ? 'Today' : weekdayShort(day)}
                </AppText>
                <AppText variant="title" color={reason !== null && !held ? 'disabledText' : preselected ? 'onSage' : 'text'} tabular>
                  {day.day}
                </AppText>
                {held ? (
                  <View style={styles.held} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Icon name="check" size={12} color="action" filled />
                  </View>
                ) : (
                  <DayMark entries={entries} />
                )}
              </PressScale>
            );
          })}
        </View>
        {anyHeld ? (
          <View style={styles.legend} testID="plan-held-note">
            <Icon name="check" size={12} color="action" filled />
            <AppText variant="caption" color="textSecondary" style={styles.shrink}>
              Already planned for the checked days.
            </AppText>
          </View>
        ) : null}
        {anyFull ? (
          <AppText variant="caption" color="textSecondary" testID="plan-full-note">
            Days in gray already have {limit === 3 ? 'three' : limit} outfits.
          </AppText>
        ) : null}

        {month === null ? (
          <LinkText label={calendarCopy.pickAnother} onPress={() => setMonth(monthOf(today))} testID="plan-another" />
        ) : (
          <Fade style={styles.month} testID="plan-month">
            <MonthHead month={month} today={today} onTurn={setMonth} variant="title" testID="plan" />
            {/* A new page cross-fades in; nothing slides. */}
            <Fade key={`${month.year}-${month.month}`}>
              <MonthGrid
                month={month}
                today={today}
                selected={params.date ?? null}
                onSelect={choose}
                calendar={page.data}
                firstWeekday={firstWeekdayOf()}
                refused={(day) => reasonOn(page.data, day)}
                held={(date) => holds(page.data, date)}
                testID="plan-grid"
              />
            </Fade>
          </Fade>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  title: { flex: 1 },
  list: { marginHorizontal: -size.gutter },
  body: { paddingHorizontal: size.gutter, paddingBottom: space[4], gap: space[3] },
  // Seven to a line, so the fourteen days are two weeks one under the other.
  days: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[2] },
  day: { width: `${100 / 7}%`, minHeight: size.touch, paddingVertical: space[2], alignItems: 'center', gap: 2 },
  capsule: { borderRadius: radius.control },
  held: { height: markHeight, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  month: { gap: space[2] },
});
