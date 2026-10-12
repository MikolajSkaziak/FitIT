import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface EyebrowProps {
  children: string;
  /** A small icon before the words: the group a filter belongs to, a fact about a garment. */
  icon?: IconName;
  /** 12 beside a fact, 16 beside the name of a section. */
  iconSize?: 12 | 16;
  color?: ColorToken;
  /** The label names the list or section under it, so screen readers announce it as a heading. */
  header?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The small uppercase label above a title, a list or a fact. Same as `<AppText variant="eyebrow">`, with room for an icon. */
export function Eyebrow({ children, icon, iconSize = 16, color = 'textSecondary', header = false, style, testID }: EyebrowProps) {
  return (
    <View style={[styles.row, style]}>
      {icon ? <Icon name={icon} size={iconSize} color={color} /> : null}
      <AppText variant="eyebrow" color={color} accessibilityRole={header ? 'header' : undefined} style={styles.words} testID={testID}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  words: { flexShrink: 1 },
});
