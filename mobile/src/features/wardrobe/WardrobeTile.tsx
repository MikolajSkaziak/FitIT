import { StyleSheet, View } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { captionOf, GarmentImage, GarmentTile, tileImageHeight } from '@/components/garments';
import { Fade, PressScale, useChanged } from '@/components/motion';
import { motion, space } from '@/theme';

interface WardrobeTileProps {
  item: Clothing;
  width: number;
  /** Where the garment belongs ("Jackets and coats"): the quiet line under its name, unless something needs saying about its state. */
  kind: string | null;
  onPress: () => void;
}

/**
 * One garment in the wardrobe grid, as designed: its photo on a well, its name, and the group it belongs to underneath.
 * A state worth knowing at a glance ("In the laundry", "Add details") takes the place of the group. While the server is
 * still describing the photo, the shared tile says so.
 */
export function WardrobeTile({ item, width, kind, onPress }: WardrobeTileProps) {
  // A tile that was already ready when it appeared does not animate; one that becomes ready while it is on screen does.
  const changed = useChanged(item.status === 'processing');
  if (item.status === 'processing') {
    return <GarmentTile item={item} width={width} onPress={onPress} />;
  }

  const caption = captionOf(item) ?? kind;
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

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  words: { gap: 2 },
});
