import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { radius, shadow, size, space, useTheme } from '@/theme';

interface LabelHeroProps {
  /** What the tag says in large serif: the current value of the setting. */
  value: string;
  /** The small uppercase line under it, which also names the screen for screen readers ("Profile · gender"). */
  eyebrow: string;
  /** One quiet line more under the eyebrow: a fact about the value. */
  note?: ReactNode;
  testID?: string;
}

/**
 * The band on top of a settings screen: the well colour edge to edge, and on it a white tag with the wordmark, a stitch,
 * the value of the setting and what it is. It starts under the status bar; the screen lays its back button over it.
 */
export function LabelHero({ value, eyebrow, note, testID }: LabelHeroProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { backgroundColor: theme.well, paddingTop: insets.top + space[6] }]} testID={testID}>
      <View style={[styles.tag, shadow, { backgroundColor: theme.wellChip, shadowColor: theme.shadow }]}>
        <AppText variant="caption" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          fit
          <AppText variant="caption" color="action">
            it.
          </AppText>
        </AppText>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stitch}>
          <Svg width="100%" height={1}>
            <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={theme.borderControl} strokeWidth={1} strokeDasharray="4 3" />
          </Svg>
        </View>
        <AppText variant="display" color="onWellChip" align="center" numberOfLines={2}>
          {value}
        </AppText>
        <AppText variant="eyebrow" accessibilityRole="header" align="center">
          {eyebrow}
        </AppText>
        {note}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: size.gutter, paddingBottom: space[8] },
  tag: { maxWidth: '100%', minWidth: 160, paddingVertical: space[4], paddingHorizontal: 28, borderRadius: radius.tag, alignItems: 'center', gap: space[2] },
  stitch: { width: 120, height: 1 },
});
