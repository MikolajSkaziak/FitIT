import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { onboardingPictures } from '@/components/brand';
import { CareLabel } from '@/components/CareLabel';
import { Eyebrow } from '@/components/Eyebrow';
import { Fade, staggerOf } from '@/components/motion';
import { radius, space, useTheme } from '@/theme';

import { example, resultCopy } from './copy';

const garments = [
  { picture: onboardingPictures.sweaterSuits, label: resultCopy.best },
  { picture: onboardingPictures.sweaterLess, label: resultCopy.soften },
] as const;

/** What the color analysis gives, as a picture: an example palette, and one sweater in a color to wear more of and in one to wear less of. Read out as one image. */
export function ColorExample() {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={example.description} style={styles.example} testID="color-example">
      <Eyebrow icon="palette">{example.label}</Eyebrow>
      <View style={styles.swatches}>
        {example.swatches.map((swatch, index) => (
          <Fade key={swatch.name} {...staggerOf(index, true)} style={styles.cell}>
            <View style={[styles.swatch, { backgroundColor: swatch.hex, borderColor: theme.border }]} />
          </Fade>
        ))}
      </View>
      <View style={styles.garments}>
        {garments.map((garment) => (
          <View key={garment.label} style={[styles.well, { backgroundColor: theme.well }]}>
            <Image source={garment.picture} contentFit="contain" accessible={false} style={styles.picture} />
            <CareLabel label={garment.label} corner="topLeft" />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  example: { gap: space[3] },
  swatches: { flexDirection: 'row', gap: space[2] },
  cell: { flex: 1 },
  swatch: { aspectRatio: 1, borderRadius: radius.well, borderWidth: 1 },
  garments: { flexDirection: 'row', gap: 13 },
  well: { flex: 1, height: 190, borderRadius: radius.well, padding: space[4], paddingTop: space[8] },
  picture: { flex: 1 },
});
