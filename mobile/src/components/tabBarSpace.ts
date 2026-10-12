import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** How far the floating bar hovers above the bottom edge of the screen. */
export const tabBarOffset = 30;
/** The capsule of tabs: 48 high tabs, 8 of padding above and below, a hairline around. The round "+" beside it is a little lower. */
export const tabBarCapsule = 66;
/** The room the floating bar takes from the bottom of the screen on a phone without a tall system inset. */
export const tabBarHeight = tabBarOffset + tabBarCapsule;

/** Where the bar sits on this phone. The home indicator's inset already holds a little air of its own, so the bar stays at 30 there. */
export function useTabBarOffset(): number {
  return Math.max(tabBarOffset, useSafeAreaInsets().bottom - 4);
}

/**
 * The room the floating bar takes from the bottom of the screen on this phone. The bar lies over the content, so a
 * tab screen that scrolls pads its bottom by this much (plus its own breathing room) to let the last row clear it.
 */
export function useTabBarSpace(): number {
  return useTabBarOffset() + tabBarCapsule;
}
