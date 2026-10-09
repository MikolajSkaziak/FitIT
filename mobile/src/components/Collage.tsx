import { StyleSheet, View } from 'react-native';

import type { OutfitItem } from '@/api/outfits';
import { cellFrame, collageHeight, collageLayout, inReadingOrder, rowHeightFor } from '@/features/styling/collage';
import { radius, space } from '@/theme';

import { GarmentImage } from './garments';

interface CollageProps {
  items: readonly OutfitItem[];
  /** Width of the whole collage; the tiles share it. */
  width: number;
  gap?: number;
  /** Space between a garment and the edge of its tile. */
  inset?: number;
  corner?: number;
  testID?: string;
}

/**
 * An outfit as a plain grid of garment tiles, laid out by role (see `collageLayout`). No frame around it: the tiles are
 * the outfit. Read as one picture by screen readers, with the names of the garments.
 */
export function Collage({ items, width, gap = space[2], inset = 12, corner = radius.well, testID }: CollageProps) {
  const ordered = inReadingOrder(items);
  const layout = collageLayout(ordered.length);
  const rowHeight = rowHeightFor(width, gap);
  const names = ordered.map((item) => item.clothing.name ?? 'item without details').join(', ');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Outfit: ${names}`}
      style={{ width, height: collageHeight(layout.rows, rowHeight, gap) }}
      testID={testID}>
      {layout.cells.map((cell) => {
        const item = ordered[cell.index];
        if (!item) {
          return null;
        }

        const frame = cellFrame(cell, width, rowHeight, gap);
        return (
          <GarmentImage
            key={item.clothing.id}
            url={item.clothing.imageUrl}
            cacheKey={item.clothing.imageKey}
            height={frame.height}
            inset={inset}
            corner={corner}
            style={[styles.tile, { left: frame.left, top: frame.top, width: frame.width }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute' },
});
