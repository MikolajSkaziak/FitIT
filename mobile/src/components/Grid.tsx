import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityRole } from 'react-native';

import { space } from '@/theme';

interface GridProps<T> {
  items: readonly T[];
  columns: 2 | 3;
  renderItem: (item: T, index: number) => ReactNode;
  keyOf: (item: T) => string;
  /** Vertical gap between rows; the gap between columns is always 8. */
  rowGap?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}

/**
 * A small fixed grid for a handful of choices: equal columns, and a short last row keeps the column width
 * instead of stretching. Long, scrolling collections use a list instead.
 */
export function Grid<T>({ items, columns, renderItem, keyOf, rowGap = space[2], accessibilityRole, accessibilityLabel }: GridProps<T>) {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    rows.push(items.slice(start, start + columns));
  }

  return (
    <View accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} style={{ gap: rowGap }}>
      {rows.map((row, rowIndex) => (
        <View key={keyOf(row[0] as T)} style={styles.row}>
          {row.map((item, column) => (
            <View key={keyOf(item)} style={styles.cell}>
              {renderItem(item, rowIndex * columns + column)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, filler) => (
            <View key={`filler-${filler}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  cell: { flex: 1, minWidth: 0 },
});
