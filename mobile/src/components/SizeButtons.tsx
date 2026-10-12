import { StyleSheet, View } from 'react-native';

import type { ClothingSize } from '@/api/account';
import { sizeNames, sizeOptions } from '@/copy/labels';
import * as haptics from '@/lib/haptics';
import { size, useTheme } from '@/theme';

import { AppText } from './AppText';
import { CrossFade, PressScale } from './motion';

interface SizeButtonsProps {
  value: ClothingSize | null;
  onChange: (value: ClothingSize) => void;
  /** Prefixes the test ids of the buttons. */
  testID?: string;
}

/**
 * The six sizes as equal cells on one hairline: a radio group, each read out by its full name ("Extra small"). The chosen
 * cell is ink on a two point green line; the lost one fades out, and no cell changes size.
 */
export function SizeButtons({ value, onChange, testID = 'size' }: SizeButtonsProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Usual size" style={styles.row} testID={testID}>
      {sizeOptions.map((option) => {
        const on = option.value === value;
        return (
          <PressScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={sizeNames[option.value]}
            haptic="none"
            onPress={() => {
              if (!on) {
                haptics.select();
              }

              onChange(option.value);
            }}
            testID={`${testID}-${option.value}`}
            style={styles.cell}>
            <CrossFade on={on} style={styles.fill} faceStyle={styles.fill}>
              {(lit) => (
                <View style={styles.face}>
                  <AppText variant="label" color={lit ? 'text' : 'textSecondary'} numberOfLines={1}>
                    {option.label}
                  </AppText>
                  <View style={[styles.line, { backgroundColor: lit ? theme.action : theme.border, height: lit ? size.bar : 1 }]} />
                </View>
              )}
            </CrossFade>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, height: 52 },
  fill: { flex: 1 },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
