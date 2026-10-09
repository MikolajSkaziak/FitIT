import { StyleSheet, View } from 'react-native';

import type { Occasion, Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { CrossFade, PressScale } from '@/components/motion';
import { occasionIcon, occasionLabel } from '@/copy/labels';
import { formatCalendarDay, fromIso } from '@/lib/dates';
import { radius, size, space, useTheme } from '@/theme';

import { relaxationLines, rulesNote, umbrellaLine } from './copy';

/** The name of an occasion with its icon in front, for the tiles of saved outfits. */
export function OccasionName({ occasion }: { occasion: Occasion }) {
  return (
    <View style={styles.occasion}>
      <Icon name={occasionIcon(occasion)} size={16} color="textSecondary" />
      <AppText variant="secondaryStrong" numberOfLines={1} style={styles.occasionText}>
        {occasionLabel(occasion)}
      </AppText>
    </View>
  );
}

/** "Worn on October 3", or null when the outfit was never worn. */
export function wornLine(outfit: Pick<Outfit, 'wornOn'>): string | null {
  const day = outfit.wornOn ? fromIso(outfit.wornOn) : null;
  return day ? `Worn on ${formatCalendarDay(day)}` : null;
}

/** Everything the stylist and the rules have to say about one outfit, quietest last. */
export function OutfitNotes({ outfit }: { outfit: Outfit }) {
  const worn = wornLine(outfit);
  const relaxed = relaxationLines(outfit.relaxations);
  return (
    <View style={styles.notes}>
      {outfit.reasoning ? <AppText testID="outfit-reasoning">{outfit.reasoning}</AppText> : null}
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
    <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} testID={testID} style={styles.toggle}>
      <CrossFade on={on} style={styles.toggleFrame} faceStyle={styles.toggleFrame}>
        {(lit) => (
          <View style={[styles.toggleFace, { backgroundColor: lit ? theme.sage : 'transparent' }]}>
            <Icon name={icon} color={lit ? 'action' : 'text'} />
          </View>
        )}
      </CrossFade>
    </PressScale>
  );
}

interface RatingBarProps {
  outfit: Pick<Outfit, 'rating' | 'isSaved'>;
  onRate: (rating: 'like' | 'dislike') => void;
  onKeep: () => void;
}

/** Thumbs up, thumbs down, and keep. A rating teaches the stylist; keeping puts the outfit in the Outfits tab. */
export function RatingBar({ outfit, onRate, onKeep }: RatingBarProps) {
  return (
    <View style={styles.bar}>
      <ToggleIcon icon="thumbsUp" label="I like it" on={outfit.rating === 'like'} onPress={() => onRate('like')} testID="outfit-like" />
      <ToggleIcon icon="thumbsDown" label="I don’t like it" on={outfit.rating === 'dislike'} onPress={() => onRate('dislike')} testID="outfit-dislike" />
      <ToggleIcon icon="bookmark" label={outfit.isSaved ? 'Remove from saved' : 'Save outfit'} on={outfit.isSaved} onPress={onKeep} testID="outfit-keep" />
    </View>
  );
}

const styles = StyleSheet.create({
  occasion: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  occasionText: { flexShrink: 1 },
  notes: { gap: space[2] },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[1] },
  toggle: { width: size.touch, height: size.touch },
  toggleFrame: { flex: 1 },
  toggleFace: { flex: 1, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
