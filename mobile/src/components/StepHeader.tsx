import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fillStart, flow, type FlowStep } from '@/features/flow';
import { motion, size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';
import { ProgressFill } from './motion';

interface StepHeaderProps {
  /** Which step of the journey this is (see `flow`): it decides the words and how full the line is. */
  step: FlowStep;
  /** Left out where there is nothing to go back to: the first screen of a flow that cannot be left half way. */
  onBack?: () => void;
}

/** The step whose header was in view last: the next one to come into view grows its line from there. */
let lastShown: FlowStep | null = null;

/**
 * Top of a wizard step: a round way back, a two point line that is never empty, and under it what is left until the
 * next thing the person gets ("Two more steps to your first look"). Put the title, or the picture, right under it.
 */
export function StepHeader({ step, onBack }: StepHeaderProps) {
  const theme = useTheme();
  const { label, progress } = flow[step];
  // The line grows (or, coming back, shrinks) from where the step before it left it, each time this screen comes into view.
  const focused = useIsFocused();
  const [view, setView] = useState({ focused: false, started: false, from: fillStart(step, lastShown), turn: 0 });
  if (focused !== view.focused) {
    const again = focused && view.started;
    setView({ focused, started: view.started || focused, from: again ? fillStart(step, lastShown) : view.from, turn: view.turn + (again ? 1 : 0) });
  }

  useEffect(() => {
    if (focused) {
      lastShown = step;
    }
  }, [focused, step]);

  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="back" label="Back" onPress={onBack} /> : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        style={[styles.track, { backgroundColor: theme.border }]}>
        <ProgressFill key={view.turn} progress={progress} from={view.from} delay={motion.exit} duration={motion.sheet} style={{ backgroundColor: theme.action }} />
      </View>
      <AppText variant="eyebrow">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[4], alignItems: 'flex-start' },
  track: { alignSelf: 'stretch', height: size.bar, overflow: 'hidden' },
});
