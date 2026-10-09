import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

// The mark of the app icon, white on transparent, so it can take the colour of the theme.
const hanger = require('../../assets/images/brand-hanger.png');

interface BrandmarkProps {
  /** 40 mark with a 28 wordmark instead of 56 with 48. */
  small?: boolean;
}

/** The lockup: a hanger on bottle green, then the wordmark "fitit.": "fit" in the text colour, "it." in the bottle green of the mark. */
export function Brandmark({ small = false }: BrandmarkProps) {
  const theme = useTheme();
  const side = small ? 40 : 56;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="fitit." style={[styles.lockup, { gap: small ? space[3] : space[4] }]}>
      <View style={[styles.mark, { width: side, height: side, borderRadius: small ? 10 : 14, backgroundColor: theme.action }]}>
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
  coatNavy: require('../../assets/images/welcome/coat-navy.png'),
  sneakerWhite: require('../../assets/images/welcome/sneaker-white.png'),
  sweaterBurgundy: require('../../assets/images/welcome/sweater-burgundy.png'),
  coatGrey: require('../../assets/images/welcome/coat-grey.png'),
  trousersCamel: require('../../assets/images/welcome/trousers-camel.png'),
  bootBrown: require('../../assets/images/welcome/boot-brown.png'),
} as const;

const mosaicColumns = [
  [welcomePictures.coatNavy, welcomePictures.sneakerWhite],
  [welcomePictures.sweaterBurgundy, welcomePictures.coatGrey],
  [welcomePictures.trousersCamel, welcomePictures.bootBrown],
] as const;

/** Six garments on sage tiles, the middle column set a little lower. Decorative: hidden from screen readers. */
export function GarmentMosaic() {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mosaic}>
      {mosaicColumns.map((column, index) => (
        <View key={index} style={[styles.column, index === 1 ? styles.lowered : null]}>
          {column.map((picture, row) => (
            <View key={row} style={[styles.tile, { backgroundColor: theme.well, borderColor: theme.wellLine }]}>
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
  tile: { height: 132, borderRadius: radius.card, borderWidth: 1, padding: space[4] },
  picture: { flex: 1 },
});
