import { usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { shadow, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { CrossFade, PressScale, ToggleFade, Turn } from './motion';
import { useTabBarOffset } from './tabBarSpace';

export { tabBarHeight, useTabBarSpace } from './tabBarSpace';

/** The four places of the app, in the order they appear. Keys are the route names in (tabs). */
const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'sun' },
  wardrobe: { label: 'Wardrobe', icon: 'hanger' },
  outfits: { label: 'Outfits', icon: 'bookmark' },
  profile: { label: 'Profile', icon: 'user' },
};

const addSize = 64;

/**
 * Bottom navigation that floats over the content: a white capsule holding the four places, icon over label, the one
 * you are in on a fill the colour of the well; and beside it, on its own, a round green "+" that is not a tab: it opens
 * the menu of ways to add. Nothing is laid out under the bar, so screens pad their own bottoms (see `useTabBarSpace`).
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const bottom = useTabBarOffset();
  return (
    <View pointerEvents="box-none" style={[styles.bar, { bottom }]}>
      <View accessibilityRole="tablist" style={[styles.capsule, shadow, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
        {state.routes.map((route, index) => {
          const tab = tabs[route.name];
          if (!tab) {
            return null;
          }

          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              testID={`tab-${route.name}`}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptics.press('nav');
                  navigateToTab(route.key);
                }
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tab, pressed ? styles.pressed : null]}>
              <ToggleFade on={focused} style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: theme.sage }]} />
              <CrossFade on={focused} faceStyle={styles.face}>
                {(active) => (
                  <>
                    <Icon name={tab.icon} size={20} color={active ? 'action' : 'textSecondary'} />
                    <AppText variant="micro" color={active ? 'action' : 'textSecondary'} numberOfLines={1}>
                      {tab.label}
                    </AppText>
                  </>
                )}
              </CrossFade>
            </Pressable>
          );
        })}
      </View>
      <AddButton />
    </View>
  );
}

/** The round "+" beside the capsule. Not a tab: it opens the menu of ways to add, and turns into a close mark while that is open. */
function AddButton() {
  const theme = useTheme();
  const router = useRouter();
  // The menu is a sheet over the tabs, so the tab state does not know about it: the path does.
  const open = usePathname() === '/create';
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={open ? 'Close menu' : 'Add'}
      haptic="primary"
      onPress={() => (open ? router.back() : router.push('/create'))}
      testID="tab-add"
      style={[styles.add, shadow, { backgroundColor: theme.action, shadowColor: theme.shadow }]}>
      <Turn on={open}>
        <Icon name="plus" color="onAction" />
      </Turn>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12 },
  capsule: { flexDirection: 'row', flexShrink: 1, gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 32 },
  // 62 wide where there is room; on a narrow phone the four share what is left.
  tab: { flexBasis: 62, flexShrink: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  fill: { borderRadius: 24 },
  face: { alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  add: { width: addSize, height: addSize, borderRadius: addSize / 2, alignItems: 'center', justifyContent: 'center' },
});
