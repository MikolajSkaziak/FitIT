import { StyleSheet, View } from 'react-native';

import type { StarterPiece } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { PressScale, ToggleFade } from '@/components/motion';
import { radius, space, useTheme } from '@/theme';

const imageHeight = 108;
const badge = 24;

interface StarterTileProps {
  piece: StarterPiece;
  selected: boolean;
  onPress: () => void;
}

/** One common piece on its sage tile. Chosen: a green ring and a check, so color is never the only sign. */
export function StarterTile({ piece, selected, onPress }: StarterTileProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={piece.name}
      onPress={onPress}
      testID={`starter-${piece.code}`}
      style={styles.tile}>
      <View>
        <GarmentImage url={piece.imageUrl} cacheKey={`starter-${piece.code}`} height={imageHeight} inset={space[2]} />
        <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} />
        <ToggleFade on={selected} style={[styles.badge, { backgroundColor: theme.action }]}>
          <Icon name="check" size={16} color="onAction" />
        </ToggleFade>
      </View>
      <AppText variant="secondaryStrong" numberOfLines={2} style={styles.name}>
        {piece.name}
      </AppText>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  ring: { borderWidth: 2, borderRadius: radius.well },
  badge: { position: 'absolute', top: space[1], right: space[1], width: badge, height: badge, borderRadius: badge / 2, alignItems: 'center', justifyContent: 'center' },
  name: { paddingHorizontal: space[1], minHeight: 42 },
});
