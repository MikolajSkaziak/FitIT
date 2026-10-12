import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { size, space, useTheme } from '@/theme';

import { useScrollable } from './scrollLock';
import { useTabBarSpace } from './tabBarSpace';

interface ScreenProps {
  children: ReactNode;
  /** Pinned under the content: the primary action of a form. The keyboard covers it, so it never hides what is being typed. */
  footer?: ReactNode;
  /** Content may be taller than the screen. On by default; switch off when the screen manages its own list. */
  scroll?: boolean;
  /** The screen is one of the tabs: the bar floats over its bottom, so the content is padded to scroll clear of it. */
  aboveTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The frame of every screen: canvas colour, 20 gutter, safe areas. With the keyboard up, the content scrolls clear of it
 * and the footer stays where it is, underneath: the field in use matters more than the button that follows it.
 */
export function Screen({ children, footer, scroll = true, aboveTabBar = false, contentStyle, testID }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + space[2];
  const tabBarSpace = useTabBarSpace();
  const scrollable = useScrollable();
  const bottom = aboveTabBar ? tabBarSpace + space[4] : Math.max(insets.bottom, space[4]) + (footer ? 0 : space[2]);
  const content = [styles.content, { paddingTop: top, paddingBottom: footer ? space[4] : bottom }, contentStyle];
  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[content, styles.grow]}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollable}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[content, styles.fill]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: bottom + space[2] }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: size.gutter },
  grow: { flexGrow: 1 },
  fill: { flex: 1 },
  footer: { paddingHorizontal: size.gutter, paddingTop: space[2], gap: space[1], alignItems: 'stretch' },
});
