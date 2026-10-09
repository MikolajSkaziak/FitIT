import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OutfitItem } from '@/api/outfits';
import { useSession } from '@/auth/session';
import { figureAspect, figureFor, figureLayout, type FigureItem } from '@/features/styling/figure';
import { inReadingOrder } from '@/features/styling/collage';
import { motion, radius, useTheme } from '@/theme';

import { Fade, staggerOf, useIntro } from './motion';

interface FigureViewProps {
  items: readonly OutfitItem[];
  /** Width of the column; the canvas fills it and is 3:4, the shape of the figure's picture. */
  width: number;
  testID?: string;
}

/**
 * An outfit worn: the garments' cut-outs laid over the person's own silhouette, each where it is worn (see
 * `figureLayout`). Somebody without a silhouette gets the garments in the same places with no body behind them.
 * Read as one picture by screen readers, with the names of the garments.
 */
export function FigureView({ items, width, testID }: FigureViewProps) {
  const theme = useTheme();
  const avatar = useSession((session) => session.user?.avatar);
  const intro = useIntro(true);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const ordered = inReadingOrder(items);
  const names = ordered.map((item) => item.clothing.name ?? 'item without details').join(', ');
  const canvas = { width: Math.round(width), height: Math.round(width / figureAspect) };

  const pieces: FigureItem[] = ordered.map(({ slot, clothing }) => ({ id: clothing.id, slot, type: clothing.subcategory, aspect: aspects[clothing.id] ?? null }));
  const layout = figureLayout(pieces, figureFor(avatar?.bodyType));

  const byId = new Map(ordered.map((item) => [item.clothing.id, item]));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Outfit on a figure: ${names}`}
      style={[styles.canvas, canvas, { backgroundColor: theme.well }]}
      testID={testID}>
      {avatar?.figureUrl ? (
        <Image source={{ uri: avatar.figureUrl }} contentFit="contain" transition={motion.exit} style={StyleSheet.absoluteFill} accessible={false} testID={`${testID ?? 'figure'}-body`} />
      ) : null}
      {layout.layers.map((layer, index) => {
        const item = byId.get(layer.id);
        if (!item) {
          return null;
        }

        // The frame is what shows of the picture: all of it, or only the part a layer worn over it lets through.
        const frame = layer.clip ?? layer.rect;
        const { rect } = layer;
        return (
          <Fade
            key={layer.id}
            {...staggerOf(index, intro)}
            style={[styles.layer, { left: frame.x * canvas.width, top: frame.y * canvas.height, width: frame.width * canvas.width, height: frame.height * canvas.height }]}
            testID={`${testID ?? 'figure'}-${layer.id}`}>
            {item.clothing.imageUrl ? (
              <Image
                source={{ uri: item.clothing.imageUrl, cacheKey: item.clothing.imageKey ?? undefined }}
                // The rectangle is the garment's own, fitted to the body, so the picture fills it.
                contentFit="fill"
                transition={motion.exit}
                style={[
                  styles.layer,
                  { left: (rect.x - frame.x) * canvas.width, top: (rect.y - frame.y) * canvas.height, width: rect.width * canvas.width, height: rect.height * canvas.height },
                ]}
                accessible={false}
                testID={`${testID ?? 'figure'}-${layer.id}-picture`}
                onLoad={(event) => {
                  const { width: pictureWidth, height: pictureHeight } = event.source;
                  if (pictureWidth > 0 && pictureHeight > 0) {
                    setAspects((current) => (current[layer.id] === pictureWidth / pictureHeight ? current : { ...current, [layer.id]: pictureWidth / pictureHeight }));
                  }
                }}
              />
            ) : null}
          </Fade>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { alignSelf: 'center', borderRadius: radius.card, overflow: 'hidden' },
  layer: { position: 'absolute', overflow: 'hidden' },
});
