import { StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { BoardView } from '@/components/BoardView';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion';
import { occasionLabel } from '@/copy/labels';
import { rangeOf } from '@/features/weather/copy';
import { fromIso, months } from '@/lib/dates';
import { space } from '@/theme';

/** What a saved outfit is called: the name the person gave it, or else its occasion. */
export const titleOf = (outfit: Pick<Outfit, 'name' | 'occasion'>): string => outfit.name ?? occasionLabel(outfit.occasion);

/** "Worn Oct 6", or "Not worn yet". */
export function wornShort(outfit: Pick<Outfit, 'wornOn'>): string {
  const day = outfit.wornOn ? fromIso(outfit.wornOn) : null;
  return day ? `Worn ${months[day.month - 1]?.slice(0, 3) ?? ''} ${day.day}` : 'Not worn yet';
}

/** What a screen reader says for a tile: the title, whether it was worn, and the weather it was for. */
export const tileLabel = (outfit: Outfit, ...more: string[]): string =>
  [titleOf(outfit), wornShort(outfit), outfit.weather ? rangeOf(outfit.weather) : null, ...more].filter(Boolean).join(', ');

/** Under a tile of the Outfits grid: the title, and one quiet line that says whether the outfit was worn. */
export function TileWords({ outfit }: { outfit: Outfit }) {
  return (
    <View style={styles.words}>
      <AppText variant="title" numberOfLines={1}>
        {titleOf(outfit)}
      </AppText>
      <View style={styles.worn}>
        {outfit.wornOn ? <Icon name="check" size={12} color="textSecondary" /> : null}
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.wornText}>
          {wornShort(outfit)}
        </AppText>
      </View>
    </View>
  );
}

interface OutfitTileProps {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}

/** A saved outfit in the list: its board (the person's own arrangement, or the automatic one), its title and whether it was worn. */
export function OutfitTile({ outfit, width, onPress }: OutfitTileProps) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={tileLabel(outfit)} onPress={onPress} testID={`outfit-${outfit.id}`} style={[styles.tile, { width }]}>
      <BoardView items={outfit.items} width={width} layout={outfit.layout} testID={`outfit-board-${outfit.id}`} />
      <TileWords outfit={outfit} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  words: { gap: 2 },
  worn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wornText: { flexShrink: 1 },
});
