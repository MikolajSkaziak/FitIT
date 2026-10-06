import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface BrandmarkProps {
  /** 40 mark with a 28 wordmark instead of 56 with 48. */
  small?: boolean;
}

/** The lockup: a hanger on bottle green, then "Fit" and "It" in two colours so the capital I never reads as an l. */
export function Brandmark({ small = false }: BrandmarkProps) {
  const theme = useTheme();
  const side = small ? 40 : 56;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="FitIt" style={[styles.lockup, { gap: small ? space[3] : space[4] }]}>
      <View style={[styles.mark, { width: side, height: side, borderRadius: small ? 10 : 14, backgroundColor: theme.action }]}>
        <Icon name="hanger" size={small ? 22 : 30} color="onAction" />
      </View>
      <AppText variant={small ? 'logoSmall' : 'logo'}>
        Fit<AppText variant={small ? 'logoSmall' : 'logo'} color="action">It</AppText>
      </AppText>
    </View>
  );
}

/** Flat garment drawings that stand in for photos where there are none yet (the mosaic on the start screen). */
const garments = {
  shirt: { body: 'M34 14 L44 10 L50 17 L56 10 L66 14 L88 62 L78 67 L68 44 L68 90 L32 90 L32 44 L22 67 L12 62 Z', seam: 'M50 17 L50 90' },
  sweater: { body: 'M34 14 L43 11 Q50 18 57 11 L66 14 L88 62 L78 67 L68 44 L68 90 L32 90 L32 44 L22 67 L12 62 Z', seam: 'M32 83 L68 83' },
  trousers: { body: 'M30 10 L70 10 L76 92 L57 92 L50 34 L43 92 L24 92 Z', seam: 'M30 18 L70 18' },
  coat: { body: 'M34 10 L45 7 L50 16 L55 7 L66 10 L90 58 L80 63 L70 42 L72 95 L28 95 L30 42 L20 63 L10 58 Z', seam: 'M50 16 L50 95' },
  sneakers: { body: 'M8 64 Q8 52 20 52 L34 52 Q40 60 58 62 Q84 64 92 72 L92 78 L8 78 Z', seam: 'M8 72 L92 72' },
  boots: { body: 'M26 20 L50 20 L50 54 Q70 58 84 66 Q92 70 92 78 L26 78 Z', seam: 'M26 72 L92 72' },
} as const;

/** Colours of the drawn garments. They are picture content, not interface colours. */
const cloth = { navy: '#27344F', burgundy: '#6F2536', camel: '#C9B48A', white: '#F3F2EE', grey: '#8E8E8A', brown: '#6A4B35' } as const;

const mosaicColumns: readonly (readonly [keyof typeof garments, keyof typeof cloth])[][] = [
  [['shirt', 'navy'], ['sneakers', 'white']],
  [['sweater', 'burgundy'], ['coat', 'grey']],
  [['trousers', 'camel'], ['boots', 'brown']],
];

/** Six garments on sage tiles, the middle column set a little lower. Decorative: hidden from screen readers. */
export function GarmentMosaic() {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mosaic}>
      {mosaicColumns.map((column, index) => (
        <View key={index} style={[styles.column, index === 1 ? styles.lowered : null]}>
          {column.map(([kind, colour]) => (
            <View key={kind} style={[styles.tile, { backgroundColor: theme.well, borderColor: theme.wellLine }]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Path d={garments[kind].body} fill={cloth[colour]} stroke="rgba(31,42,37,0.28)" strokeWidth={1.5} strokeLinejoin="round" />
                <Path d={garments[kind].seam} fill="none" stroke="rgba(31,42,37,0.36)" strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
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
  tile: { height: 132, borderRadius: radius.card, borderWidth: 1, padding: 20 },
});
