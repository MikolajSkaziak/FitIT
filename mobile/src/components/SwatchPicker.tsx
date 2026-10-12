import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { size, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressScale, ToggleFade } from './motion';

export interface SwatchChoice<T extends string | number> {
  value: T;
  /** The name a screen reader says, and the line shown under the row while the swatch is chosen. */
  label: string;
  /** The color as it looks, `#RRGGBB`: content, not interface. Null draws an empty outline, for "other". */
  swatch: string | null;
}

interface SwatchPickerProps<T extends string | number> {
  /** Names the group for screen readers. */
  label: string;
  options: readonly SwatchChoice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Each swatch gets `${testID}-${value}`. */
  testID: string;
}

/** Row width assumed before the first layout, which is also what a 375 point phone gives. */
const assumedWidth = 343;
const disc = 36;

/**
 * One question answered by round swatches. The row holds as many 44 point targets as fit; more than that and the
 * swatches are split into rows of equal length, never one short orphan. The chosen swatch wears a ring in the action
 * color tight around it, and its name shows in one quiet line under the row, whose height is
 * reserved so that choosing never moves anything.
 */
export function SwatchPicker<T extends string | number>({ label, options, value, onChange, testID }: SwatchPickerProps<T>) {
  const theme = useTheme();
  const [width, setWidth] = useState(assumedWidth);
  const fit = Math.max(1, Math.floor(width / size.touch));
  const rowCount = Math.ceil(options.length / fit);
  const perRow = Math.ceil(options.length / rowCount);
  const rows = Array.from({ length: rowCount }, (_, row) => options.slice(row * perRow, (row + 1) * perRow));
  const chosen = options.find((option) => option.value === value);

  const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={measure} style={styles.rows}>
        {rows.map((row) => (
          <View key={String(row[0]?.value)} style={styles.row}>
            {row.map((option) => {
              const on = option.value === value;
              return (
                <View key={String(option.value)} style={styles.cell}>
                  <PressScale
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={option.label}
                    onPress={() => onChange(option.value)}
                    testID={`${testID}-${option.value}`}
                    style={styles.target}>
                    <ToggleFade on={on} style={[styles.ring, { borderColor: theme.action }]} />
                    <View
                      style={[
                        styles.disc,
                        option.swatch ? { backgroundColor: option.swatch, borderColor: theme.border } : { borderColor: theme.borderControl },
                      ]}
                    />
                  </PressScale>
                </View>
              );
            })}
            {Array.from({ length: perRow - row.length }, (_, filler) => (
              <View key={`filler-${filler}`} style={styles.cell} />
            ))}
          </View>
        ))}
      </View>
      <AppText variant="secondary" color="textSecondary" accessibilityLiveRegion="polite" style={styles.caption} testID={`${testID}-caption`}>
        {chosen?.label ?? ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 0 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  target: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  // A 36 point disc with a 3 point ring tight around it, both inside the 44 point target.
  disc: { width: disc, height: disc, borderRadius: disc / 2, borderWidth: 1 },
  ring: { position: 'absolute', width: disc + 6, height: disc + 6, borderRadius: disc / 2 + 3, borderWidth: 3 },
  caption: { minHeight: typography.secondary.lineHeight, marginTop: 4 },
});
