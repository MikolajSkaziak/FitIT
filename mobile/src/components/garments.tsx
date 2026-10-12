import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { motion, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Skeleton } from './lists';
import { Fade, PressScale, useChanged } from './motion';

interface GarmentImageProps {
  /** Signed address of the picture; it changes every hour. */
  url: string | null | undefined;
  /** What the picture is cached under, so a new signature does not download it again. */
  cacheKey: string | null | undefined;
  height: number;
  /** Space between the picture and the edge of its well. */
  inset?: number;
  corner?: number;
  label?: string;
  /** Laid over the picture: a care label in a corner. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A garment on its well: the same quiet backdrop everywhere a garment is shown. Lay a `CareLabel` over it by passing it as a child. */
export function GarmentImage({ url, cacheKey, height, inset = 12, corner = radius.well, label, children, style }: GarmentImageProps) {
  const theme = useTheme();
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[styles.well, { height, padding: inset, borderRadius: corner, backgroundColor: theme.well }, style]}>
      {url ? <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} contentFit="contain" transition={motion.exit} style={styles.image} accessible={false} /> : null}
      {children}
    </View>
  );
}

/** What the tile says under the name: the one thing worth knowing at a glance. */
export function captionOf(item: Pick<Clothing, 'status' | 'inLaundry' | 'rarelyWorn'>): string | null {
  if (item.status === 'failed') {
    return 'Add details';
  }

  if (item.inLaundry) {
    return 'In the laundry';
  }

  return item.rarelyWorn ? 'Rarely worn' : null;
}

interface GarmentTileProps {
  item: Clothing;
  width: number;
  onPress: () => void;
}

export const tileImageHeight = 212;

/** One garment in the wardrobe grid: its photo on a well, its name and one quiet line underneath, no box. While the server is still describing it, the tile says so. */
export function GarmentTile({ item, width, onPress }: GarmentTileProps) {
  // A tile that was already ready when it appeared does not animate; one that becomes ready while it is on screen does.
  const changed = useChanged(item.status === 'processing');
  if (item.status === 'processing') {
    return (
      <Fade key="processing" enter={false} exit duration={motion.exit}>
        <View style={[styles.tile, { width }]} accessible accessibilityRole="progressbar" accessibilityLabel="Describing the photo" testID={`garment-${item.id}`}>
          <Skeleton height={tileImageHeight} radius={radius.well} />
          <View style={styles.words}>
            <AppText variant="title" color="textSecondary" numberOfLines={1}>
              Describing the photo
            </AppText>
            <AppText variant="caption"> </AppText>
          </View>
        </View>
      </Fade>
    );
  }

  const caption = captionOf(item);
  const name = item.name ?? 'Item without details';
  return (
    <Fade key="ready" enter={changed} exit duration={motion.enter}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={caption ? `${name}, ${caption}` : name}
        onPress={onPress}
        testID={`garment-${item.id}`}
        style={[styles.tile, { width }]}>
        <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={tileImageHeight} />
        <View style={styles.words}>
          <AppText variant="title" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {caption ?? ' '}
          </AppText>
        </View>
      </PressScale>
    </Fade>
  );
}

/** The grid as it will look, while the first answer is on its way. */
export function GarmentTileSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.tile, { width }]}>
      <Skeleton height={tileImageHeight} radius={radius.well} />
      <View style={styles.words}>
        <Skeleton height={16} width="70%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: { overflow: 'hidden' },
  image: { flex: 1 },
  tile: { gap: space[2] },
  words: { gap: 2 },
});
