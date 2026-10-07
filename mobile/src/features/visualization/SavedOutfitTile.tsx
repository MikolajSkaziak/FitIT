import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { AppText } from '@/components/AppText';
import { occasionLabel } from '@/copy/labels';
import { collageHeight, collageLayout, rowHeightFor } from '@/features/styling/collage';
import { dateLine, OutfitTile } from '@/features/styling/OutfitTile';
import { rangeOf } from '@/features/weather/copy';
import { radius, space, useTheme } from '@/theme';

import { silhouetteView } from './copy';

interface SavedOutfitTileProps {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}

/** The gap the collage tile uses, and with it the height a tile of this outfit takes. */
const gap = space[1];

/** A saved outfit in the Outfity grid: the picture on the silhouette once there is one, the collage of photos until then. */
export function SavedOutfitTile({ outfit, width, onPress }: SavedOutfitTileProps) {
  const newest = visualizationOf(outfit);
  return newest?.status === 'completed' && newest.imageUrl ? (
    <PictureTile outfit={outfit} width={width} url={newest.imageUrl} cacheKey={newest.imageKey} onPress={onPress} />
  ) : (
    <OutfitTile outfit={outfit} width={width} onPress={onPress} />
  );
}

interface PictureTileProps extends SavedOutfitTileProps {
  url: string;
  cacheKey: string | null;
}

/** The same tile as the collage one, leading with the picture. It keeps the collage's height, so the rows stay even. */
function PictureTile({ outfit, width, url, cacheKey, onPress }: PictureTileProps) {
  const theme = useTheme();
  const range = rangeOf(outfit.weather);
  const height = collageHeight(collageLayout(outfit.items.length).rows, rowHeightFor(width, gap), gap);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${occasionLabel(outfit.occasion)}, ${dateLine(outfit)}, ${range}, ${silhouetteView.toLowerCase()}`}
      onPress={onPress}
      testID={`outfit-${outfit.id}`}
      style={({ pressed }) => [styles.tile, { width }, pressed ? styles.pressed : null]}>
      <View style={[styles.thumbnail, { width, height, backgroundColor: theme.well }]} testID={`outfit-picture-${outfit.id}`}>
        <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} contentFit="cover" transition={150} style={styles.fill} accessible={false} />
      </View>
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
  thumbnail: { borderRadius: radius.thumb, overflow: 'hidden' },
  fill: { flex: 1 },
  words: { gap: 2, paddingHorizontal: space[1] },
  pressed: { opacity: 0.85 },
});
