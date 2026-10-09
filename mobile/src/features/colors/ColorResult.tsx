import { StyleSheet, View } from 'react-native';

import type { ColorAnalysis, ColorSwatch } from '@/api/colors';
import { AppText } from '@/components/AppText';
import { Fade } from '@/components/motion';
import { motion, space, useTheme } from '@/theme';

import { resultCopy } from './copy';

interface ColorResultProps {
  analysis: ColorAnalysis;
}

/** The type, two sentences about it, the colors to wear more of and the ones to go easy on. */
export function ColorResult({ analysis }: ColorResultProps) {
  return (
    <Fade rise={6} duration={motion.enter} style={styles.block} testID="color-result">
      <View style={styles.words}>
        <AppText variant="display" accessibilityRole="header" testID="color-result-name">
          {analysis.name}
        </AppText>
        <AppText color="textSecondary">{analysis.summary}</AppText>
      </View>
      <Swatches title={resultCopy.best} swatches={analysis.best} testID="color-best" />
      <Swatches title={resultCopy.soften} swatches={analysis.soften} testID="color-soften" />
    </Fade>
  );
}

function Swatches({ title, swatches, testID }: { title: string; swatches: readonly ColorSwatch[]; testID: string }) {
  const theme = useTheme();
  return (
    <View style={styles.group} testID={testID}>
      <AppText variant="subheading" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.row}>
        {swatches.map((swatch) => (
          <View key={swatch.name} accessible accessibilityLabel={swatch.name} style={styles.swatch}>
            <View style={[styles.dot, { backgroundColor: swatch.hex, borderColor: theme.borderControl }]} />
            <AppText variant="meta" color="textSecondary" align="center" numberOfLines={2}>
              {swatch.name}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[6] },
  words: { gap: space[2] },
  group: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  swatch: { width: 72, alignItems: 'center', gap: space[1] },
  dot: { width: 48, height: 48, borderRadius: 24, borderWidth: 1 },
});
