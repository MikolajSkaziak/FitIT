import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { AppText } from '@/components/AppText';
import { PressScale } from '@/components/motion';
import { occasionLabel } from '@/copy/labels';
import { collageHeight, collageLayout, rowHeightFor } from '@/features/styling/collage';
import { OccasionName } from '@/features/styling/OutfitParts';
import { dateLine, OutfitTile } from '@/features/styling/OutfitTile';
import { rangeOf } from '@/features/weather/copy';
import { motion, radius, space, useTheme } from '@/theme';

import { tryOnView } from './copy';

interface SavedOutfitTileProps {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}

/** The gap the collage tile uses, and with it the height a tile of this outfit takes. */
const gap = space[1];

/** A saved outfit in the Outfits grid: the picture on the silhouette once there is one, the collage of photos until then. */
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
  const range = outfit.weather ? rangeOf(outfit.weather) : null;
  const height = collageHeight(collageLayout(outfit.items.length).rows, rowHeightFor(width, gap), gap);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={[occasionLabel(outfit.occasion), dateLine(outfit), range, tryOnView.toLowerCase()].filter(Boolean).join(', ')}
      onPress={onPress}
      testID={`outfit-${outfit.id}`}
      style={[styles.tile, { width }]}>
      <View style={[styles.thumbnail, { width, height, backgroundColor: theme.well }]} testID={`outfit-picture-${outfit.id}`}>
        <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} contentFit="cover" transition={motion.exit} style={styles.fill} accessible={false} />
      </View>
      <View style={styles.words}>
        <OccasionName occasion={outfit.occasion} />
        <AppText variant="meta" color="textSecondary" numberOfLines={1}>
          {dateLine(outfit)}
        </AppText>
        {range ? (
          <AppText variant="meta" color="textSecondary" tabular numberOfLines={1}>
            {range}
          </AppText>
        ) : null}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  thumbnail: { borderRadius: radius.thumb, overflow: 'hidden' },
  fill: { flex: 1 },
  words: { gap: 2, paddingHorizontal: space[1] },
});
