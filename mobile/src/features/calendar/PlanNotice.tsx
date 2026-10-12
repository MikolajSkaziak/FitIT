import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CalendarEntry } from '@/api/calendar';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Fade, PressScale } from '@/components/motion';
import { fromIso, type CalendarDate } from '@/lib/dates';
import { motion, size, space } from '@/theme';

import { calendarCopy, noticeLingerMs, plannedLabel } from './copy';
import { usePlanNotice } from './session';

interface PlanNoticeProps {
  /** The outfit of this screen: a plan made for another one is not said here. */
  outfitId: string | undefined;
  today: CalendarDate;
  onUndo: (entry: CalendarEntry) => void;
}

/**
 * The quiet line that confirms a plan, in place: "Planned for Thursday." with an Undo beside it. It stays a few seconds
 * and goes by itself; there is no alert to dismiss. Screen readers hear it when it appears.
 */
export function PlanNotice({ outfitId, today, onUndo }: PlanNoticeProps) {
  const planned = usePlanNotice((state) => state.planned);
  const clear = usePlanNotice((state) => state.clear);
  const mine = planned && planned.outfit.id === outfitId ? planned : null;
  const id = mine?.id;

  useEffect(() => {
    if (!id) {
      return undefined;
    }

    const timer = setTimeout(clear, noticeLingerMs);
    return () => clearTimeout(timer);
  }, [id, clear]);

  const date = mine ? fromIso(mine.date) : null;
  if (!mine || !date) {
    return null;
  }

  return (
    <Fade key={mine.id} exit duration={motion.exit} style={styles.notice} testID="plan-notice">
      <View style={styles.words} accessible accessibilityRole="text" accessibilityLiveRegion="polite">
        <Icon name="check" size={16} color="action" />
        <AppText variant="secondary" color="textSecondary" style={styles.text}>
          {plannedLabel(date, today)}.
        </AppText>
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel={`${calendarCopy.undo}: ${plannedLabel(date, today).toLowerCase()}`} haptic="quiet" onPress={() => onUndo(mine)} hitSlop={space[2]} style={styles.undo} testID="plan-undo">
        <AppText variant="title" color="action">
          {calendarCopy.undo}
        </AppText>
      </PressScale>
    </Fade>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  words: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flexShrink: 1 },
  undo: { minHeight: size.touch, justifyContent: 'center' },
});
