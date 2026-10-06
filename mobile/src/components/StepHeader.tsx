import { StyleSheet, View } from 'react-native';

import { size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';

interface StepHeaderProps {
  step: number;
  total?: number;
  onBack: () => void;
}

/** Top of a wizard step: a way back, "Krok 2 z 5", and a bar per step. */
export function StepHeader({ step, total = 5, onBack }: StepHeaderProps) {
  const theme = useTheme();
  const label = `Krok ${step} z ${total}`;
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <IconButton icon="back" label="Wróć" onPress={onBack} />
        <AppText variant="secondaryStrong" color="textSecondary">
          {label}
        </AppText>
        <View style={styles.balance} />
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: step }} style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.bar, { backgroundColor: index < step ? theme.action : theme.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[2] },
  // The 24 icon sits in a 44 target; pulling the row out by 10 lines the icon up with the text edge below.
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -10 },
  balance: { width: size.touch, height: size.touch },
  bars: { flexDirection: 'row', gap: space[1] },
  bar: { flex: 1, height: size.bar, borderRadius: size.bar / 2 },
});
