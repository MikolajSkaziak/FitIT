import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton, LinkText } from '@/components/controls';
import { addMonths, formatMonth, isSameMonth, monthOf, type CalendarDate, type CalendarMonth } from '@/lib/dates';
import { size, space } from '@/theme';

interface MonthHeadProps {
  month: CalendarMonth;
  today: CalendarDate;
  onTurn: (month: CalendarMonth) => void;
  /** The serif title of a page, or the plain one inside a sheet that has its own title. */
  variant?: 'heading' | 'title';
  testID?: string;
}

/** Over a month: its name, round buttons to the month before and after, and "Today" as a way back when another month is shown. */
export function MonthHead({ month, today, onTurn, variant = 'heading', testID = 'calendar' }: MonthHeadProps) {
  return (
    <View style={styles.head}>
      <AppText variant={variant} accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title} testID={`${testID}-month`}>
        {formatMonth(month, today.year)}
      </AppText>
      {isSameMonth(month, monthOf(today)) ? null : <LinkText label="Today" onPress={() => onTurn(monthOf(today))} testID={`${testID}-today`} />}
      <IconButton icon="back" label="Previous month" onPress={() => onTurn(addMonths(month, -1))} testID={`${testID}-previous`} />
      <IconButton icon="forward" label="Next month" onPress={() => onTurn(addMonths(month, 1))} testID={`${testID}-next`} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { minHeight: size.touch, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1 },
});
