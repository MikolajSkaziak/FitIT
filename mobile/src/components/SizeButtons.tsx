import { StyleSheet, View } from 'react-native';

import type { ClothingSize } from '@/api/account';
import { sizeNames, sizeOptions } from '@/copy/labels';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { CrossFade, PressScale } from './motion';

interface SizeButtonsProps {
  value: ClothingSize | null;
  onChange: (value: ClothingSize) => void;
  /** Prefixes the test ids of the buttons. */
  testID?: string;
}

/** The six sizes as equal buttons in one row: a radio group, each read out by its full name ("Extra small"). */
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
            onPress={() => onChange(option.value)}
            testID={`${testID}-${option.value}`}
            style={styles.cell}>
            <CrossFade on={on} style={styles.fill} faceStyle={styles.fill}>
              {(lit) => (
                <View
                  style={[
                    styles.face,
                    { backgroundColor: lit ? theme.action : theme.surface, borderColor: lit ? theme.action : theme.borderControl },
                  ]}>
                  <AppText variant="label" color={lit ? 'onAction' : 'text'} numberOfLines={1}>
                    {option.label}
                  </AppText>
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
  row: { flexDirection: 'row', gap: space[1] },
  cell: { flex: 1, height: 52 },
  fill: { flex: 1 },
  face: { flex: 1, borderWidth: 1, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
