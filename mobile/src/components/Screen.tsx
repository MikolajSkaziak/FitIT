import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { size, space, useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Pinned under the content: the primary action of a form. Stays above the keyboard. */
  footer?: ReactNode;
  /** Content may be taller than the screen. On by default; switch off when the screen manages its own list. */
  scroll?: boolean;
  /** The screen sits above a tab bar, which already covers the bottom safe area. */
  aboveTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The frame of every screen: canvas colour, 16 gutter, safe areas, and room for the keyboard. */
export function Screen({ children, footer, scroll = true, aboveTabBar = false, contentStyle, testID }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + space[2];
  const bottom = aboveTabBar ? space[4] : Math.max(insets.bottom, space[4]) + (footer ? 0 : space[2]);
  const content = [styles.content, { paddingTop: top, paddingBottom: footer ? space[4] : bottom }, contentStyle];
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: theme.canvas }]} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={[content, styles.grow]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[content, styles.fill]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: bottom + space[2] }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: size.gutter },
  grow: { flexGrow: 1 },
  fill: { flex: 1 },
  footer: { paddingHorizontal: size.gutter, paddingTop: space[2], gap: space[1], alignItems: 'stretch' },
});
