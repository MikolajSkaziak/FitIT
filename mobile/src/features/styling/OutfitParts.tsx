import { StyleSheet, View } from 'react-native';

import type { Outfit, OutfitItem } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { IconToggleButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/lists';
import { groupTitle } from '@/features/builder/copy';
import { groupLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { formatCalendarDay, fromIso } from '@/lib/dates';
import { radius, space } from '@/theme';

import { rulesNote, umbrellaLine } from './copy';

/** "Worn on October 3", or null when the outfit was never worn. */
export function wornLine(outfit: Pick<Outfit, 'wornOn'>): string | null {
  const day = outfit.wornOn ? fromIso(outfit.wornOn) : null;
  return day ? `Worn on ${formatCalendarDay(day)}` : null;
}

/** Everything the stylist and the rules have to say about one outfit, quietest last. */
export function OutfitNotes({ outfit }: { outfit: Outfit }) {
  const worn = wornLine(outfit);
  return (
    <View style={styles.notes}>
      {outfit.reasoning ? (
        <AppText color="textSecondary" testID="outfit-reasoning">
          {outfit.reasoning}
        </AppText>
      ) : null}
      {outfit.weatherNote ? (
        <View style={styles.fact}>
          <Icon name={outfit.umbrella ? 'rain' : 'thermometer'} size={16} color="textSecondary" />
          <AppText variant="caption" color="textSecondary" style={styles.factText}>
            {outfit.weatherNote}
          </AppText>
        </View>
      ) : null}
      {outfit.umbrella ? (
        <AppText variant="secondary" color="textSecondary">
          {umbrellaLine}
        </AppText>
      ) : null}
      {outfit.source === 'rules' ? (
        <AppText variant="meta" color="textSecondary">
          {rulesNote}
        </AppText>
      ) : null}
      {worn ? (
        <AppText variant="meta" color="textSecondary">
          {worn}.
        </AppText>
      ) : null}
    </View>
  );
}

interface OutfitPiecesProps {
  items: readonly OutfitItem[];
  /** Makes each piece a way into the garment, with a chevron. */
  onOpen?: (clothingId: string) => void;
}

/** "In this look": each garment of the outfit as a hairline row with its photo, its name and the group it belongs to. */
export function OutfitPieces({ items, onOpen }: OutfitPiecesProps) {
  const dictionaries = useDictionaries().data;
  return (
    <View testID="outfit-pieces">
      <Eyebrow header>In this look</Eyebrow>
      {items.map(({ slot, clothing }) => (
        <Row
          key={clothing.id}
          leading={<GarmentImage url={clothing.imageUrl} cacheKey={clothing.imageKey} height={56} inset={6} corner={radius.thumb} style={styles.thumbnail} />}
          label={clothing.name ?? 'Item without details'}
          meta={groupLabel(dictionaries, clothing.group) ?? groupTitle[slot]}
          strong
          onPress={onOpen ? () => onOpen(clothing.id) : undefined}
        />
      ))}
    </View>
  );
}

interface KeepButtonProps {
  outfit: Pick<Outfit, 'isSaved'>;
  onKeep: () => void;
}

/** The bookmark: lit while the outfit is among the saved ones. */
export function KeepButton({ outfit, onKeep }: KeepButtonProps) {
  return <IconToggleButton icon="bookmark" label={outfit.isSaved ? 'Remove from saved' : 'Save outfit'} active={outfit.isSaved} onPress={onKeep} haptic="none" bare testID="outfit-keep" />;
}

/** The bookmark on a row of its own, at the trailing edge under a proposal. */
export function KeepBar({ outfit, onKeep }: KeepButtonProps) {
  return (
    <View style={styles.bar}>
      <KeepButton outfit={outfit} onKeep={onKeep} />
    </View>
  );
}

const styles = StyleSheet.create({
  notes: { gap: space[2] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { flexShrink: 1 },
  thumbnail: { width: 56 },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] },
});
