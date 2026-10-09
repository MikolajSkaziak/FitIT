import { usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { CrossFade, PressScale, ToggleFade, Turn } from './motion';

/** The four places of the app, in the order they appear. Keys are the route names in (tabs). */
const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'sun' },
  wardrobe: { label: 'Wardrobe', icon: 'hanger' },
  outfits: { label: 'Outfits', icon: 'bookmark' },
  profile: { label: 'Profile', icon: 'user' },
};

export const tabBarHeight = 64;
/** The raised button is 56 across; the slot it sits in is a little wider so the four tabs around it stay equal. */
const addSize = 56;
const addSlot = 72;
/** About a third of the button rises above the top edge of the bar. */
const addLift = 19;

/**
 * Bottom navigation: icon over label, and a short bar hanging from the top edge over the place you are in.
 * Between Wardrobe and Outfits sits a raised round "+" that is not a tab: it opens the menu of ways to add.
 */
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
        return (
          <Fragment key={route.key}>
            {route.name === 'outfits' ? <AddButton /> : null}
            <Pressable
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
              <ToggleFade on={focused} style={[styles.indicator, { backgroundColor: theme.action }]} />
              <CrossFade on={focused} faceStyle={styles.face}>
                {(active) => (
                  <>
                    <View style={styles.icon}>
                      <Icon name={tab.icon} color={active ? 'action' : 'textSecondary'} />
                    </View>
                    <AppText variant="metaStrong" color={active ? 'action' : 'textSecondary'} numberOfLines={1}>
                      {tab.label}
                    </AppText>
                  </>
                )}
              </CrossFade>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** A slot in the row with the button lifted out of its top. Not a tab: it opens the menu of ways to add. */
function AddButton() {
  const theme = useTheme();
  const router = useRouter();
  // The menu is a sheet over the tabs, so the tab state does not know about it: the path does.
  const open = usePathname() === '/create';
  return (
    <View style={styles.addSlot}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close menu' : 'Add'}
        onPress={() => (open ? router.back() : router.push('/create'))}
        testID="tab-add"
        style={[styles.add, { backgroundColor: theme.action }]}>
        <Turn on={open}>
          <Icon name="plus" color="onAction" />
        </Turn>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, height: tabBarHeight, alignItems: 'center' },
  indicator: { width: 24, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  face: { alignItems: 'center' },
  icon: { marginTop: 9, marginBottom: 4 },
  pressed: { opacity: 0.7 },
  addSlot: { width: addSlot, height: tabBarHeight, alignItems: 'center', overflow: 'visible', zIndex: 1 },
  add: { width: addSize, height: addSize, borderRadius: addSize / 2, marginTop: -addLift, alignItems: 'center', justifyContent: 'center' },
});
