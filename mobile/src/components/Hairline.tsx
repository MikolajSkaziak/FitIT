import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

interface HairlineProps {
  /** Ink instead of the quiet line: under the chosen row of a list. */
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The one-point rule that separates things instead of a box around them. Decorative. */
export function Hairline({ strong = false, style }: HairlineProps) {
  const theme = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.line, { backgroundColor: strong ? theme.text : theme.border }, style]} />;
}

const styles = StyleSheet.create({
  line: { height: 1, alignSelf: 'stretch', flexShrink: 0 },
});
