import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import type { ClothingSize } from '@/api/account';
import { sizeNames, sizeOptions } from '@/copy/labels';
import { radius, shadow, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Slide } from './motion';

const ticks = Array.from({ length: 36 }, (_, index) => (index % 6 === 0 ? 20 : index % 3 === 0 ? 13 : 8));

/** Where the marker stands along the tape, as a share of its width: the six sizes in turn, the middle when nothing is chosen. */
export function markerShare(value: ClothingSize | null): number {
  const index = sizeOptions.findIndex((option) => option.value === value);
  return index < 0 ? 0.5 : 0.12 + index * 0.152;
}

interface SizeRailProps {
  value: ClothingSize | null;
}

/** A tailor's tape along the bottom of the well, with a green marker that slides to the chosen size. Decorative. */
export function SizeRail({ value }: SizeRailProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="size-tape"
      style={[styles.tape, { backgroundColor: theme.paper, borderTopColor: theme.paperLine }]}>
      <View style={styles.ticks}>
        {ticks.map((height, index) => (
          <View key={index} style={{ width: 1, height, backgroundColor: theme.paperInk }} />
        ))}
      </View>
      {width > 0 ? (
        <Slide x={markerShare(value) * width - 1} visible={value !== null} style={[styles.marker, { backgroundColor: theme.paperMark }]} />
      ) : null}
    </View>
  );
}

interface SizeLabelProps {
  value: ClothingSize | null;
}

/**
 * The size as a sewn-in garment label: a white tag hanging from a bottle-green rail on the well, the chosen size
 * as a very large serif letter, and the tape along the bottom. The letter is a live region, so a change is read out politely.
 */
export function SizeLabel({ value }: SizeLabelProps) {
  const theme = useTheme();
  const letter = sizeOptions.find((option) => option.value === value)?.label ?? '–';
  const name = value ? sizeNames[value] : 'Not set';
  // One line whatever the size: the serif is wide, so each extra letter takes the type down a step, and the system
  // shrinks it further if a phone's font still leaves it too wide for the label.
  const fontSize = letter.length > 2 ? 54 : letter.length > 1 ? 76 : 104;
  const type = { fontSize, lineHeight: Math.round(fontSize * 1.22) };
  // A long name ("Double extra large") needs the whole line; a short one shares it with what the size is for.
  const roomy = name.length <= 8;
  return (
    <View style={[styles.well, { backgroundColor: theme.well }]} testID="size-label">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.rail, { backgroundColor: theme.wellRail }]} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.railStitch}>
        <Svg width="100%" height={2}>
          <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.wellStitch} strokeWidth={2} strokeDasharray="6 4" />
        </Svg>
      </View>
      <View style={[styles.label, shadow, { backgroundColor: theme.wellChip, shadowColor: theme.shadow }]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stitch}>
          <Svg width="100%" height={2}>
            <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.borderControl} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="6 4" />
          </Svg>
        </View>
        <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants" variant="caption">
          fit<AppText variant="caption" color="action">it.</AppText>
        </AppText>
        <View style={styles.letterBox}>
          <AppText
            variant="display"
            color={value ? 'onWellChip' : 'borderControl'}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Usual size: ${name}`}
            maxFontSizeMultiplier={1}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.letter, type]}
            testID="size-letter">
            {letter}
          </AppText>
        </View>
        <View style={[styles.footer, roomy ? null : styles.footerAlone, { borderTopColor: theme.paperLine }]}>
          <AppText variant="eyebrow" numberOfLines={1} adjustsFontSizeToFit style={styles.footerName}>
            {name}
          </AppText>
          {roomy ? (
            <AppText variant="eyebrow" numberOfLines={1}>
              try-on fit
            </AppText>
          ) : null}
        </View>
      </View>
      <SizeRail value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: { height: 312, borderRadius: radius.card, overflow: 'hidden', alignItems: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, top: 0, height: 22 },
  railStitch: { position: 'absolute', left: 0, right: 0, top: 22, height: 2 },
  label: {
    marginTop: 10,
    width: 176,
    height: 236,
    paddingTop: 26,
    paddingHorizontal: space[4],
    paddingBottom: 18,
    alignItems: 'center',
    gap: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  stitch: { position: 'absolute', left: 14, right: 14, top: 10, height: 2 },
  letterBox: { flexGrow: 1, alignSelf: 'stretch', justifyContent: 'center' },
  letter: { letterSpacing: -1, includeFontPadding: false, textAlign: 'center' },
  footer: { alignSelf: 'stretch', borderTopWidth: 1, paddingTop: space[2], flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  footerAlone: { justifyContent: 'center' },
  footerName: { flexShrink: 1 },
  tape: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, borderTopWidth: 1 },
  ticks: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 10 },
  marker: { position: 'absolute', left: 0, bottom: 0, width: 3, height: 40 },
});
