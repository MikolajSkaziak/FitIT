import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { ThermalPreference } from '@/api/account';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

// The mark of the app icon, white on transparent, so it can take the colour of the theme.
const hanger = require('../../assets/images/brand-hanger.png');

interface BrandmarkProps {
  /** 40 mark with a 28 wordmark instead of 56 with 48. */
  small?: boolean;
}

/** The lockup: a hanger on a round bottle-green mark, then the serif wordmark "fitit.": "fit" in ink, "it." in the bottle green of the mark. */
export function Brandmark({ small = false }: BrandmarkProps) {
  const theme = useTheme();
  const side = small ? 40 : 56;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="fitit." style={[styles.lockup, { gap: small ? space[3] : space[4] }]}>
      <View style={[styles.mark, { width: side, height: side, borderRadius: side / 2, backgroundColor: theme.action }]}>
        <Image source={hanger} tintColor={theme.onAction} contentFit="contain" accessible={false} style={{ width: small ? 26 : 36, height: small ? 26 : 36 }} />
      </View>
      <AppText variant={small ? 'logoSmall' : 'logo'}>
        fit<AppText variant={small ? 'logoSmall' : 'logo'} color="action">it.</AppText>
      </AppText>
    </View>
  );
}

/** Illustrated garments for the start screen, cut out on a transparent background. */
export const welcomePictures = {
  /** The photograph that opens the app: one outfit laid out on the colour of the well. */
  hero: require('../../assets/images/welcome/hero.jpg'),
  /** Its wide companion over the log in and reset screens: the top-left corner is empty, for the back button. */
  heroWide: require('../../assets/images/welcome/hero-wide.jpg'),
  coatNavy: require('../../assets/images/welcome/coat-navy.png'),
  sneakerWhite: require('../../assets/images/welcome/sneaker-white.png'),
  sweaterBurgundy: require('../../assets/images/welcome/sweater-burgundy.png'),
  coatGrey: require('../../assets/images/welcome/coat-grey.png'),
  trousersCamel: require('../../assets/images/welcome/trousers-camel.png'),
  bootBrown: require('../../assets/images/welcome/boot-brown.png'),
} as const;

/** Pictures of the sign-up and the steps after it. */
export const onboardingPictures = {
  /** A rail of clothes on the colour of the well: shown where a look would be, while there are too few pieces to make one. */
  rail: require('../../assets/images/onboarding/rail.jpg'),
  /** The same sweater twice, cut out: in a colour of the example palette, and in one that palette goes easy on. */
  sweaterSuits: require('../../assets/images/onboarding/sweater-suits.png'),
  sweaterLess: require('../../assets/images/onboarding/sweater-less.png'),
} as const;

const mosaicColumns = [
  [welcomePictures.coatNavy, welcomePictures.sneakerWhite],
  [welcomePictures.sweaterBurgundy, welcomePictures.coatGrey],
  [welcomePictures.trousersCamel, welcomePictures.bootBrown],
] as const;

/** Six garments on wells, the middle column set a little lower. Decorative: hidden from screen readers. */
export function GarmentMosaic() {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mosaic}>
      {mosaicColumns.map((column, index) => (
        <View key={index} style={[styles.column, index === 1 ? styles.lowered : null]}>
          {column.map((picture, row) => (
            <View key={row} style={[styles.tile, { backgroundColor: theme.well }]}>
              <Image source={picture} contentFit="contain" style={styles.picture} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
  mosaic: { flexDirection: 'row', gap: space[2] },
  column: { flex: 1, gap: space[2] },
  lowered: { marginTop: space[6] },
  tile: { height: 132, borderRadius: radius.well, padding: space[4] },
  picture: { flex: 1 },
});

/** The fitting room of the try-on picture: a closed curtain in two halves, cut from one picture, that slide apart to show the outfit. */
export const tryOnPictures = {
  curtainLeft: require('../../assets/images/tryon/curtain-left.jpg'),
  curtainRight: require('../../assets/images/tryon/curtain-right.jpg'),
} as const;

/**
 * The same mannequin, pose and backdrop dressed for each answer to how the person feels the cold (layers differ and nothing else):
 * `f` is the women's set, `m` the men's. 900 points tall, 3:4.
 */
export const thermalPictures: Record<'f' | 'm', Record<ThermalPreference, number>> = {
  f: {
    runs_cold: require('../../assets/images/thermal/f-cold.jpg'),
    normal: require('../../assets/images/thermal/f-normal.jpg'),
    runs_warm: require('../../assets/images/thermal/f-warm.jpg'),
  },
  m: {
    runs_cold: require('../../assets/images/thermal/m-cold.jpg'),
    normal: require('../../assets/images/thermal/m-normal.jpg'),
    runs_warm: require('../../assets/images/thermal/m-warm.jpg'),
  },
};
