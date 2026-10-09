import { StyleSheet, View } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { PressScale, ToggleFade } from '@/components/motion';
import { radius, space, useTheme } from '@/theme';

export const choiceWidth = 112;
const imageHeight = 104;

interface GarmentChoiceProps {
  item: Clothing;
  selected: boolean;
  onPress: () => void;
}

/** One garment in a row of the picker. Chosen: a green ring and a check over the picture; the picture and the name never move. */
export function GarmentChoice({ item, selected, onPress }: GarmentChoiceProps) {
  const theme = useTheme();
  const name = item.name ?? 'Item without details';
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      testID={`pick-${item.id}`}
      style={styles.choice}>
      <View>
        <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={imageHeight} inset={8} />
        <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} />
        <ToggleFade on={selected} style={[styles.check, { backgroundColor: theme.action }]}>
          <Icon name="check" size={16} color="onAction" />
        </ToggleFade>
      </View>
      <AppText variant="meta" numberOfLines={1}>
        {name}
      </AppText>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  choice: { width: choiceWidth, gap: space[1] },
  ring: { borderWidth: 2, borderRadius: radius.well },
  check: { position: 'absolute', top: space[1], right: space[1], width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
