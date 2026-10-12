import { StyleSheet, View } from 'react-native';

import type { CalendarEntry } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { BoardView } from '@/components/BoardView';
import { Button } from '@/components/Button';
import { CareLabel } from '@/components/CareLabel';
import { Hairline } from '@/components/Hairline';
import { Icon } from '@/components/Icon';
import { Fade, PressScale } from '@/components/motion';
import { occasionLabel } from '@/copy/labels';
import { titleOf } from '@/features/styling/OutfitTile';
import { radius, space } from '@/theme';

import { calendarCopy, entryTag } from './copy';
import { isPending } from './useCalendar';

/** The board of an entry: large enough on the Today page to read the outfit, a thumbnail in the calendar's list. */
const boardWidth = { card: 132, row: 72 } as const;

interface EntryRowProps {
  entry: CalendarEntry;
  /** `card` leads with a larger board carrying the care label (the Today page); `row` is the calendar's list. */
  size: 'card' | 'row';
  onOpen: () => void;
  /** "I wore this": given for a planned entry of today or a day that has passed. */
  onConfirm?: () => void;
  onRemove: () => void;
}

/**
 * One outfit on one day: its board, what it is called, a care label that says whether it is planned or worn, and a
 * chevron into the outfit. Under it, as quiet words, what can be done about the day: "I wore this" and "Remove from this
 * day". An entry the server has not confirmed yet shows no actions.
 */
export function EntryRow({ entry, size, onOpen, onConfirm, onRemove }: EntryRowProps) {
  const { outfit } = entry;
  const title = titleOf(outfit);
  const tag = entryTag(entry);
  const waiting = isPending(entry);
  return (
    <Fade exit style={styles.entry} testID={`calendar-entry-${outfit.id}`}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${tag.toLowerCase()}`}
        accessibilityHint="Opens the outfit"
        onPress={onOpen}
        style={styles.row}
        testID={`calendar-entry-open-${outfit.id}`}>
        <View style={styles.board} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BoardView items={outfit.items} width={boardWidth[size]} layout={outfit.layout} testID={`calendar-board-${outfit.id}`} />
          {size === 'card' ? <CareLabel label={tag} icon={entry.worn ? 'check' : undefined} corner="topLeft" style={styles.onBoard} /> : null}
        </View>
        <View style={styles.words}>
          <AppText variant="title" numberOfLines={2}>
            {title}
          </AppText>
          {outfit.name ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {occasionLabel(outfit.occasion)}
            </AppText>
          ) : null}
          {size === 'row' ? <CareLabel label={tag} icon={entry.worn ? 'check' : undefined} style={styles.inRow} testID={`calendar-entry-tag-${outfit.id}`} /> : null}
        </View>
        <Icon name="forward" size={20} color="textSecondary" />
      </PressScale>
      {waiting ? null : (
        <View style={styles.actions}>
          {onConfirm ? <Button label={calendarCopy.wore} kind="text" icon="check" compact inline onPress={onConfirm} style={styles.flush} testID={`calendar-wore-${outfit.id}`} /> : null}
          {/* Taking a plan off a day destroys nothing: the outfit stays. A light tap, no confirmation. */}
          <Button label={calendarCopy.remove} kind="text" compact inline haptic="secondary" onPress={onRemove} style={styles.flush} testID={`calendar-remove-${outfit.id}`} />
        </View>
      )}
      <Hairline />
    </Fade>
  );
}

const styles = StyleSheet.create({
  entry: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  board: { borderRadius: radius.well, overflow: 'hidden' },
  // The board is small here: the label keeps to its corner with less air than on a full tile.
  onBoard: { left: space[2], top: space[2] },
  words: { flex: 1, gap: space[1] },
  inRow: { marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[6] },
  // A text button carries its own horizontal padding; here it has none, so it starts at the page's left edge.
  flush: { paddingHorizontal: 0 },
});
