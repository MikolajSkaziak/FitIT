import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Skeleton } from './lists';

interface GarmentImageProps {
  /** Signed address of the picture; it changes every hour. */
  url: string | null | undefined;
  /** What the picture is cached under, so a new signature does not download it again. */
  cacheKey: string | null | undefined;
  height: number;
  /** Space between the picture and the edge of its sage tile. */
  inset?: number;
  corner?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** A garment on its sage tile: the same backdrop everywhere a garment is shown. */
export function GarmentImage({ url, cacheKey, height, inset = 12, corner = radius.well, label, style }: GarmentImageProps) {
  const theme = useTheme();
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[styles.well, { height, padding: inset, borderRadius: corner, backgroundColor: theme.well, borderColor: theme.wellLine }, style]}>
      {url ? <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} contentFit="contain" transition={150} style={styles.image} accessible={false} /> : null}
    </View>
  );
}

/** What the tile says under the name: the one thing worth knowing at a glance. */
export function captionOf(item: Pick<Clothing, 'status' | 'inLaundry' | 'rarelyWorn'>): string | null {
  if (item.status === 'failed') {
    return 'Uzupełnij opis';
  }

  if (item.inLaundry) {
    return 'W praniu';
  }

  return item.rarelyWorn ? 'Rzadko noszę' : null;
}

interface GarmentTileProps {
  item: Clothing;
  width: number;
  onPress: () => void;
}

export const tileImageHeight = 148;

/** One garment in the wardrobe grid. While the server is still describing it, the tile says so. */
export function GarmentTile({ item, width, onPress }: GarmentTileProps) {
  if (item.status === 'processing') {
    return (
      <View style={[styles.tile, { width }]} accessible accessibilityRole="progressbar" accessibilityLabel="Opisujemy zdjęcie" testID={`garment-${item.id}`}>
        <Skeleton height={tileImageHeight} radius={radius.well} />
        <View style={styles.words}>
          <AppText variant="secondaryStrong" color="textSecondary" numberOfLines={1}>
            Opisujemy zdjęcie
          </AppText>
          <AppText variant="meta"> </AppText>
        </View>
      </View>
    );
  }

  const caption = captionOf(item);
  const name = item.name ?? 'Ubranie bez opisu';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${name}, ${caption}` : name}
      onPress={onPress}
      testID={`garment-${item.id}`}
      style={({ pressed }) => [styles.tile, { width }, pressed ? styles.pressed : null]}>
      <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={tileImageHeight} />
      <View style={styles.words}>
        <AppText variant="secondaryStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="meta" color="textSecondary" numberOfLines={1}>
          {caption ?? ' '}
        </AppText>
      </View>
    </Pressable>
  );
}

/** The grid as it will look, while the first answer is on its way. */
export function GarmentTileSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.tile, { width }]}>
      <Skeleton height={tileImageHeight} radius={radius.well} />
      <View style={styles.words}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={10} width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: { borderWidth: 1, overflow: 'hidden' },
  image: { flex: 1 },
  tile: { gap: space[2] },
  words: { gap: 2, paddingHorizontal: space[1] },
  pressed: { opacity: 0.85 },
});
