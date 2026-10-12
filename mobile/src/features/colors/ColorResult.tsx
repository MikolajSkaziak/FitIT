import { StyleSheet, View } from 'react-native';

import type { ColorAnalysis, ColorSwatch } from '@/api/colors';
import { AppText } from '@/components/AppText';
import { Eyebrow } from '@/components/Eyebrow';
import { Fade, staggerOf, useIntro } from '@/components/motion';
import { motion, radius, space, useTheme } from '@/theme';

import { resultCopy } from './copy';

interface ColorResultProps {
  analysis: ColorAnalysis;
  /** The small label above the type ("Your colors"), for a screen that has no step header above it. */
  eyebrow?: string;
}

/** The type, two sentences about it, the colors to wear more of and the ones to wear less of. */
export function ColorResult({ analysis, eyebrow }: ColorResultProps) {
  // The colors to wear arrive one by one when the result is first shown; a re-render, or a later change, brings no replay.
  const intro = useIntro(true);
  return (
    <Fade rise={6} duration={motion.enter} style={styles.block} testID="color-result">
      <View style={styles.words}>
        {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
        <AppText variant="display" accessibilityRole="header" testID="color-result-name">
          {analysis.name}
        </AppText>
        <AppText color="textSecondary">{analysis.summary}</AppText>
      </View>
      <Swatches title={resultCopy.best} icon swatches={analysis.best} height="square" intro={intro} testID="color-best" />
      <Swatches title={resultCopy.soften} swatches={analysis.soften} height={48} muted testID="color-soften" />
    </Fade>
  );
}

const columns = 4;

interface SwatchesProps {
  title: string;
  swatches: readonly ColorSwatch[];
  /** The first group carries the palette icon. */
  icon?: boolean;
  /** Square chips for the colors to wear, shallow ones for the colors to go easy on. */
  height: 'square' | number;
  /** Names in the secondary colour. */
  muted?: boolean;
  /** The swatches arrive one after another (`staggerOf`), each settling from a little smaller. */
  intro?: boolean;
  testID: string;
}

function Swatches({ title, swatches, icon = false, height, muted = false, intro = false, testID }: SwatchesProps) {
  const theme = useTheme();
  const rows: ColorSwatch[][] = [];
  for (let start = 0; start < swatches.length; start += columns) {
    rows.push(swatches.slice(start, start + columns));
  }

  return (
    <View style={styles.group} testID={testID}>
      <Eyebrow icon={icon ? 'palette' : undefined} header>
        {title}
      </Eyebrow>
      <View style={styles.rows}>
        {rows.map((row, at) => (
          <View key={row[0]?.name} style={styles.row}>
            {row.map((swatch, column) => (
              <Fade key={swatch.name} pop {...staggerOf(at * columns + column, intro)} style={styles.cell} testID={`${testID}-${swatch.name}`}>
                <View accessible accessibilityLabel={swatch.name} style={styles.inner}>
                  <View
                    style={[
                      styles.chip,
                      height === 'square' ? styles.square : { height },
                      { backgroundColor: swatch.hex, borderColor: theme.border },
                    ]}
                  />
                  <AppText variant="caption" color={muted ? 'textSecondary' : 'text'} align="center" numberOfLines={2}>
                    {swatch.name}
                  </AppText>
                </View>
              </Fade>
            ))}
            {Array.from({ length: columns - row.length }, (_, filler) => (
              <View key={`filler-${filler}`} style={styles.cell} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[6] },
  words: { gap: 10 },
  group: { gap: space[3] },
  rows: { gap: space[4] },
  row: { flexDirection: 'row', gap: 13 },
  cell: { flex: 1, minWidth: 0, gap: 6 },
  inner: { gap: 6 },
  chip: { borderRadius: radius.well, borderWidth: 1 },
  square: { aspectRatio: 1 },
});
