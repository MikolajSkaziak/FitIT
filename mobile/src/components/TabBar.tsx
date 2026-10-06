import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** The four places of the app, in the order they appear. Keys are the route names in (tabs). */
const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Dziś', icon: 'sun' },
  wardrobe: { label: 'Szafa', icon: 'hanger' },
  outfits: { label: 'Outfity', icon: 'bookmark' },
  profile: { label: 'Profil', icon: 'user' },
};

export const tabBarHeight = 64;

/** Bottom navigation: icon over label, and a short bar hanging from the top edge over the place you are in. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = tabs[route.name];
        if (!tab) {
          return null;
        }

        const focused = state.index === index;
        const color = focused ? 'action' : 'textSecondary';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            testID={`tab-${route.name}`}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.tab, pressed ? styles.pressed : null]}>
            <View style={[styles.indicator, { backgroundColor: focused ? theme.action : 'transparent' }]} />
            <View style={styles.icon}>
              <Icon name={tab.icon} color={color} />
            </View>
            <AppText variant="metaStrong" color={color} numberOfLines={1}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, height: tabBarHeight, alignItems: 'center' },
  indicator: { width: 24, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  icon: { marginTop: 9, marginBottom: 4 },
  pressed: { opacity: 0.7 },
});
