import { StyleSheet, View } from 'react-native';

import { flow } from '@/features/flow';
import { size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';

interface StepHeaderProps {
  step: number;
  total?: number;
  /** Left out where there is nothing to go back to: the first screen of a flow that cannot be left half way. */
  onBack?: () => void;
}

/** Top of a wizard step: a way back, "Step 2 of 9", and a bar per step. */
export function StepHeader({ step, total = flow.total, onBack }: StepHeaderProps) {
  const theme = useTheme();
  const label = `Step ${step} of ${total}`;
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {onBack ? <IconButton icon="back" label="Back" onPress={onBack} /> : <View style={styles.balance} />}
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
