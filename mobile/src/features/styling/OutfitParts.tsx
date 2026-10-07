import { Pressable, StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { formatCalendarDay, fromIso } from '@/lib/dates';
import { radius, size, space, useTheme } from '@/theme';

import { relaxationLines, rulesNote, umbrellaLine } from './copy';

/** "Założony 3 października", or null when the outfit was never worn. */
export function wornLine(outfit: Pick<Outfit, 'wornOn'>): string | null {
  const day = outfit.wornOn ? fromIso(outfit.wornOn) : null;
  return day ? `Założony ${formatCalendarDay(day)}` : null;
}

/** Everything the stylist and the rules have to say about one outfit, quietest last. */
export function OutfitNotes({ outfit }: { outfit: Outfit }) {
  const worn = wornLine(outfit);
  const relaxed = relaxationLines(outfit.relaxations);
  return (
    <View style={styles.notes}>
      <AppText testID="outfit-reasoning">{outfit.reasoning}</AppText>
      {outfit.weatherNote ? (
        <AppText variant="secondary" color="textSecondary">
          {outfit.weatherNote}
        </AppText>
      ) : null}
      {relaxed.map((line) => (
        <AppText key={line} variant="secondary" color="textSecondary">
          {line}
        </AppText>
      ))}
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

interface ToggleIconProps {
  icon: IconName;
  label: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}

/** A 44 by 44 icon that is either off, or on: sage tile and green icon, so the state is not carried by colour alone. */
function ToggleIcon({ icon, label, on, onPress, testID }: ToggleIconProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.toggle, { backgroundColor: on ? theme.sage : 'transparent' }, pressed ? styles.pressed : null]}>
      <Icon name={icon} color={on ? 'action' : 'text'} />
    </Pressable>
  );
}

interface RatingBarProps {
  outfit: Pick<Outfit, 'rating' | 'isSaved'>;
  onRate: (rating: 'like' | 'dislike') => void;
  onKeep: () => void;
}

/** Thumbs up, thumbs down, and keep. A rating teaches the stylist; keeping puts the outfit in the Outfity tab. */
export function RatingBar({ outfit, onRate, onKeep }: RatingBarProps) {
  return (
    <View style={styles.bar}>
      <ToggleIcon icon="thumbsUp" label="Podoba mi się" on={outfit.rating === 'like'} onPress={() => onRate('like')} testID="outfit-like" />
      <ToggleIcon icon="thumbsDown" label="Nie podoba mi się" on={outfit.rating === 'dislike'} onPress={() => onRate('dislike')} testID="outfit-dislike" />
      <ToggleIcon icon="bookmark" label={outfit.isSaved ? 'Usuń z zapisanych' : 'Zapisz zestaw'} on={outfit.isSaved} onPress={onKeep} testID="outfit-keep" />
    </View>
  );
}

const styles = StyleSheet.create({
  notes: { gap: space[2] },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[1] },
  toggle: { width: size.touch, height: size.touch, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
});
