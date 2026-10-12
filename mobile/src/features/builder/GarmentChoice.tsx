import { StyleSheet, View } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { CareLabel } from '@/components/CareLabel';
import { GarmentImage } from '@/components/garments';
import { PressScale, ToggleFade } from '@/components/motion';
import { radius, space, useTheme } from '@/theme';

export const choiceWidth = 150;
const imageHeight = 188;

interface GarmentChoiceProps {
  item: Clothing;
  selected: boolean;
  /** What kind of garment it is, in the words of the wardrobe ("Sweaters and hoodies"), when they are known. */
  kind: string | null;
  /** Takes the width of what it stands in (a cell of a grid) instead of the width of a tile in a row. */
  fill?: boolean;
  onPress: () => void;
}

/** One garment in a row of the picker. Chosen: a green ring and a "Wearing" care label over the picture; the picture and the name never move. */
export function GarmentChoice({ item, selected, kind, fill = false, onPress }: GarmentChoiceProps) {
  const theme = useTheme();
  const name = item.name ?? 'Item without details';
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      testID={`pick-${item.id}`}
      style={[styles.choice, fill ? styles.fill : null]}>
      <View>
        <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={imageHeight} />
        <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} />
        <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
          <CareLabel label="Wearing" icon="check" corner="topLeft" />
        </ToggleFade>
      </View>
      <View style={styles.words}>
        <AppText variant="title" numberOfLines={1}>
          {name}
        </AppText>
        {kind ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {kind}
          </AppText>
        ) : null}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  choice: { width: choiceWidth, gap: space[2] },
  fill: { width: '100%' },
  ring: { borderWidth: 2, borderRadius: radius.well },
  words: { gap: 2 },
});
