import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { LegLength } from '@/api/account';
import { legDetails, legOptions } from '@/copy/labels';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressScale, ToggleFade } from './motion';

/** The figure is drawn on a 64 by 188 sheet; the waist line reaches 6 past it on each side. Only the torso/leg split differs. */
const sheet = { width: 64, height: 188, reach: 6 } as const;
const torsoOf: Record<LegLength, number> = { shorter: 84, average: 72, longer: 60 };

/** A rectangle with its own top and bottom corner radius. */
function bar(x: number, y: number, width: number, height: number, top: number, bottom: number): string {
  return [
    `M${x},${y + top}`,
    `a${top},${top} 0 0 1 ${top},${-top}`,
    `H${x + width - top}`,
    `a${top},${top} 0 0 1 ${top},${top}`,
    `V${y + height - bottom}`,
    `a${bottom},${bottom} 0 0 1 ${-bottom},${bottom}`,
    `H${x + bottom}`,
    `a${bottom},${bottom} 0 0 1 ${-bottom},${-bottom}`,
    'Z',
  ].join(' ');
}

interface FigureProps {
  length: LegLength;
  chosen: boolean;
}

/** A schematic person: head, neck, torso, two legs and a dashed waist line, from plain shapes. Decorative. */
function Figure({ length, chosen }: FigureProps) {
  const theme = useTheme();
  const torso = torsoOf[length];
  const legTop = 32 + torso + 2;
  const legHeight = sheet.height - 34 - torso;
  const torsoFill = chosen ? theme.figureTorsoOn : theme.figureTorso;
  const legsFill = chosen ? theme.figureLegsOn : theme.figureLegs;
  const width = sheet.width + sheet.reach * 2;
  return (
    <Svg width={width} height={sheet.height} viewBox={`${-sheet.reach} 0 ${width} ${sheet.height}`}>
      <Circle cx={32} cy={12} r={12} fill={torsoFill} />
      <Rect x={27} y={22} width={10} height={12} fill={torsoFill} />
      <Path d={bar(8, 32, 48, torso, 12, 4)} fill={torsoFill} />
      <Path d={bar(10, legTop, 20, legHeight, 3, 8)} fill={legsFill} />
      <Path d={bar(34, legTop, 20, legHeight, 3, 8)} fill={legsFill} />
      <Line x1={-sheet.reach} y1={legTop + 1} x2={sheet.width + sheet.reach} y2={legTop + 1} stroke={chosen ? theme.text : theme.figureLine} strokeWidth={2} strokeDasharray="4 3" />
    </Svg>
  );
}

interface LegFiguresProps {
  value: LegLength | null;
  onChange: (value: LegLength) => void;
  /** Prefixes the test ids of the columns. */
  testID?: string;
}

/**
 * Three figures side by side on the sage well, a radio group: the chosen column gets a white card, a green border and
 * darker legs (instant in, a 100 ms fade out). The drawings are decorative; each column is read out by its word.
 */
export function LegFigures({ value, onChange, testID = 'legs' }: LegFiguresProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Leg length" style={[styles.well, { backgroundColor: theme.well }]} testID={testID}>
      {legOptions.map((option) => {
        const on = option.value === value;
        const { caption } = legDetails[option.value];
        return (
          <PressScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            accessibilityHint={caption}
            onPress={() => onChange(option.value)}
            testID={`${testID}-${option.value}`}
            style={styles.column}>
            <ToggleFade on={on} style={[StyleSheet.absoluteFill, styles.face, { backgroundColor: theme.surface, borderColor: theme.action }]} />
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.figure}>
              <Figure length={option.value} chosen={false} />
              <ToggleFade on={on} style={StyleSheet.absoluteFill}>
                <Figure length={option.value} chosen />
              </ToggleFade>
            </View>
            <View style={styles.words}>
              <AppText variant="label" numberOfLines={1}>
                {option.label}
              </AppText>
              <AppText variant="meta" color="textSecondary" numberOfLines={1}>
                {caption}
              </AppText>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { height: 292, borderRadius: radius.card, padding: space[3], flexDirection: 'row', gap: space[2] },
  column: { flex: 1, minWidth: 0, borderRadius: radius.well, paddingTop: 14, paddingBottom: 10, paddingHorizontal: space[1], alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  face: { borderRadius: radius.well, borderWidth: 2 },
  figure: { alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center' },
});
