import { StyleSheet, View } from 'react-native';

import type { CalendarEntry } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

interface DayMarkProps {
  entries: readonly Pick<CalendarEntry, 'worn'>[];
}

/**
 * What a day of the calendar holds, in the room under its number: a green dot for a planned outfit, a check for a worn
 * one (two shapes, so the difference does not rest on colour), and "+1" when the day holds more. The room is kept on an
 * empty day too, so every cell is the same height. Decorative: the cell says it in words.
 */
export function DayMark({ entries }: DayMarkProps) {
  const theme = useTheme();
  const first = entries[0];
  return (
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {first ? first.worn ? <Icon name="check" size={12} color="text" /> : <View style={[styles.dot, { backgroundColor: theme.action }]} /> : null}
      {entries.length > 1 ? (
        <AppText variant="micro" color="textSecondary" tabular>
          +{entries.length - 1}
        </AppText>
      ) : null}
    </View>
  );
}

/** The height of the mark's room; a cell is a number above it. */
export const markHeight = 14;

const styles = StyleSheet.create({
  mark: { height: markHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
