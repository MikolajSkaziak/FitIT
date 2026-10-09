import { ScrollView, StyleSheet, View } from 'react-native';

import type { Occasion } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { PressScale, ToggleFade } from '@/components/motion';
import { radius, size, space, useTheme } from '@/theme';

import { occasionPills } from './copy';

interface OccasionPillsProps {
  occasion: Occasion;
  onOccasion: (occasion: Occasion) => void;
}

/**
 * One row of occasions that scrolls sideways; the chosen one is filled green. The label is drawn once and its chosen
 * face lies over it, so choosing moves nothing: on at once, off over `motion.press`, like every selection.
 */
export function OccasionPills({ occasion, onOccasion }: OccasionPillsProps) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Occasion"
      style={styles.bleed}
      contentContainerStyle={styles.row}
      testID="today-occasions">
      {occasionPills.map(({ value, label }) => {
        const chosen = value === occasion;
        return (
          <PressScale
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            accessibilityLabel={label}
            onPress={() => onOccasion(value)}
            style={styles.pill}
            testID={`today-occasion-${value}`}>
            <View style={[StyleSheet.absoluteFill, styles.face, { backgroundColor: theme.surface, borderColor: theme.borderControl }]} />
            <AppText variant="label" numberOfLines={1}>
              {label}
            </AppText>
            <ToggleFade on={chosen} style={[StyleSheet.absoluteFill, styles.face, styles.chosen, { backgroundColor: theme.action, borderColor: theme.action }]}>
              <AppText variant="label" color="onAction" numberOfLines={1}>
                {label}
              </AppText>
            </ToggleFade>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -size.gutter },
  row: { paddingHorizontal: size.gutter, gap: space[2] },
  pill: { height: size.touch, paddingHorizontal: space[4], alignItems: 'center', justifyContent: 'center' },
  face: { borderRadius: radius.pill, borderWidth: 1 },
  chosen: { alignItems: 'center', justifyContent: 'center' },
});
