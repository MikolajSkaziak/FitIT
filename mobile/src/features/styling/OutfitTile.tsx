import { Pressable, StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Collage } from '@/components/Collage';
import { occasionLabel } from '@/copy/labels';
import { rangeOf } from '@/features/weather/copy';
import { formatDay } from '@/lib/dates';
import { radius, space } from '@/theme';

import { wornLine } from './OutfitParts';

/** What stands under a saved outfit: when it was worn, or else when it was put together. */
export const dateLine = (outfit: Pick<Outfit, 'wornOn' | 'createdAt'>): string => wornLine(outfit) ?? `Zapisany ${formatDay(new Date(outfit.createdAt))}`;

interface OutfitTileProps {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}

/** A saved outfit in the list: its collage, the occasion, the date and the weather it was for. */
export function OutfitTile({ outfit, width, onPress }: OutfitTileProps) {
  const range = rangeOf(outfit.weather);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${occasionLabel(outfit.occasion)}, ${dateLine(outfit)}, ${range}`}
      onPress={onPress}
      testID={`outfit-${outfit.id}`}
      style={({ pressed }) => [styles.tile, { width }, pressed ? styles.pressed : null]}>
      <Collage items={outfit.items} width={width} gap={space[1]} inset={6} corner={radius.thumb} />
      <View style={styles.words}>
        <AppText variant="secondaryStrong" numberOfLines={1}>
          {occasionLabel(outfit.occasion)}
        </AppText>
        <AppText variant="meta" color="textSecondary" numberOfLines={1}>
          {dateLine(outfit)}
        </AppText>
        <AppText variant="meta" color="textSecondary" tabular numberOfLines={1}>
          {range}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  words: { gap: 2, paddingHorizontal: space[1] },
  pressed: { opacity: 0.85 },
});
