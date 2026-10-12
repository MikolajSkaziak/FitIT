import { StyleSheet, View } from 'react-native';

import type { StarterPiece } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { CareLabel } from '@/components/CareLabel';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { PressScale, ToggleFade } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { space, useTheme } from '@/theme';

export const tileImageHeight = 212;
const disc = 32;

interface StarterTileProps {
  piece: StarterPiece;
  /** The quiet line under the name: where the piece belongs. */
  caption: string;
  selected: boolean;
  onPress: () => void;
}

/** One common piece on its well. Left alone it wears a white plus; chosen, a care label that says "Added", so color is never the only sign. */
export function StarterTile({ piece, caption, selected, onPress }: StarterTileProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={piece.name}
      haptic="none"
      onPress={() => {
        haptics.select();
        onPress();
      }}
      testID={`starter-${piece.code}`}
      style={styles.tile}>
      <GarmentImage url={piece.imageUrl} cacheKey={`starter-${piece.code}`} height={tileImageHeight} inset={space[4]}>
        <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
          <CareLabel label="Added" icon="check" corner="topLeft" />
        </ToggleFade>
        <ToggleFade on={!selected} style={[styles.plus, { backgroundColor: theme.wellChip }]}>
          <Icon name="plus" size={16} color="onWellChip" />
        </ToggleFade>
      </GarmentImage>
      <View style={styles.words}>
        <AppText variant="title" numberOfLines={1}>
          {piece.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {caption}
        </AppText>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  words: { gap: 2 },
  plus: { position: 'absolute', top: 10, right: 10, width: disc, height: disc, borderRadius: disc / 2, alignItems: 'center', justifyContent: 'center' },
});
