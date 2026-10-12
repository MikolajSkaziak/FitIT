import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { PressScale } from '@/components/motion';
import { boardSize } from '@/features/styling/board';
import { OutfitTile, TileWords, tileLabel } from '@/features/styling/OutfitTile';
import { motion, radius, space, useTheme } from '@/theme';

import { tryOnView } from './copy';

interface SavedOutfitTileProps {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}

/** A saved outfit in the Outfits grid: the picture on the silhouette once there is one, its board until then. */
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

/** The same tile as the board one, leading with the picture. It keeps the board's 3:4 height, so the rows stay even. */
function PictureTile({ outfit, width, url, cacheKey, onPress }: PictureTileProps) {
  const theme = useTheme();
  const { height } = boardSize(width);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={tileLabel(outfit, tryOnView.toLowerCase())}
      onPress={onPress}
      testID={`outfit-${outfit.id}`}
      style={[styles.tile, { width }]}>
      <View style={[styles.thumbnail, { width, height, backgroundColor: theme.well }]} testID={`outfit-picture-${outfit.id}`}>
        <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} contentFit="cover" transition={motion.exit} style={styles.fill} accessible={false} />
      </View>
      <TileWords outfit={outfit} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  thumbnail: { borderRadius: radius.thumb, overflow: 'hidden' },
  fill: { flex: 1 },
});
