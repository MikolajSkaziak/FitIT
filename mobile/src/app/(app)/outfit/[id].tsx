import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calendarKeys, fetchOutfitDays } from '@/api/calendar';
import { fetchOutfit, outfitKeys } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Fade, PressScale } from '@/components/motion';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { occasionIcon, occasionLabel } from '@/copy/labels';
import { calendarCopy, outfitDaysLine, planLabel, plannedLabel } from '@/features/calendar/copy';
import { PlanNotice } from '@/features/calendar/PlanNotice';
import { usePlanning } from '@/features/calendar/session';
import { useCanPlan, usePlaceToday } from '@/features/calendar/useCalendar';
import { KeepButton, OutfitNotes, OutfitPieces } from '@/features/styling/OutfitParts';
import { findCachedOutfit, useOutfitActions } from '@/features/styling/useOutfitActions';
import { OutfitVisualization, TryOnButton, useOutfitViewer } from '@/features/visualization/OutfitVisualization';
import { rangeOf } from '@/features/weather/copy';
import { daysBetween, formatDay, fromIso } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { motion, radius, size, space } from '@/theme';

const outfitGone = 'This outfit isn’t here anymore.';

/** One saved outfit: the garments, what the stylist said about them, and what can be done with it. */
export default function OutfitDetail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // `date` is the day ahead the person came from (the week strip, the calendar): the outfit is then being looked at for that day.
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const actions = useOutfitActions();
  const planning = usePlanning();
  const canPlan = useCanPlan();
  const today = usePlaceToday();
  const [worn, setWorn] = useState(false);

  const found = useQuery({
    queryKey: outfitKeys.one(id),
    queryFn: () => fetchOutfit(id),
    // Shown at once from the list the person came from, then confirmed with the server.
    initialData: () => findCachedOutfit(queryClient, id),
    initialDataUpdatedAt: 0,
  });
  const outfit = found.data;
  const viewer = useOutfitViewer(outfit, undefined);
  const days = useQuery({ queryKey: calendarKeys.outfit(id), queryFn: () => fetchOutfitDays(id), enabled: canPlan && Boolean(outfit) });

  if (!outfit) {
    return (
      <Screen testID="outfit-screen">
        <View style={styles.content}>
          <View style={styles.head}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
          {found.isError ? (
            <View style={styles.problem}>
              <AppText color="textSecondary">{codeOf(found.error) === 'not_found' ? outfitGone : messageFor(found.error)}</AppText>
              {codeOf(found.error) === 'not_found' ? null : <Button label="Try again" kind="secondary" inline onPress={() => void found.refetch()} />}
            </View>
          ) : (
            <View style={styles.problem} accessibilityRole="progressbar" accessibilityLabel="Loading outfit">
              <Skeleton height={size.touch} width="60%" />
              <Skeleton height={240} radius={radius.well} />
              <Skeleton height={16} />
              <Skeleton height={16} width="70%" />
            </View>
          )}
        </View>
      </Screen>
    );
  }

  const name = `${occasionLabel(outfit.occasion)}, ${formatDay(new Date(outfit.createdAt))}`;
  const confirmRemoval = () =>
    Alert.alert(`Delete outfit “${name}”?`, 'We’ll remove it from your saved outfits. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete outfit',
        style: 'destructive',
        onPress: () => {
          haptics.destroy();
          actions.remove(outfit, () => router.back());
        },
      },
    ]);
  const meta = outfit.weather ? `${formatDay(new Date(outfit.createdAt))}, ${rangeOf(outfit.weather)}` : formatDay(new Date(outfit.createdAt));
  const buttonTop = insets.top + space[2];
  // Reached from a day that is still ahead: the main action is about that day, not about today.
  const forDay = date ? fromIso(date) : null;
  const planFor = canPlan && forDay && daysBetween(today, forDay) > 0 ? forDay : null;
  const onThatDay = planFor !== null && (days.data ?? []).some((day) => day.date === date);
  const daysLine = outfitDaysLine(days.data ?? [], today);
  const failed = actions.error ?? planning.error;

  return (
    <Screen
      testID="outfit-screen"
      contentStyle={styles.screen}
      footer={
        <View style={styles.footer}>
          <FormError message={failed ? (codeOf(failed) === 'not_found' ? outfitGone : messageFor(failed)) : null} />
          <PlanNotice outfitId={outfit.id} today={today} onUndo={(entry) => void planning.undo(entry)} />
          <View style={styles.actions}>
            {planFor ? (
              <Fade key={onThatDay ? 'planned' : 'plan'} enter={onThatDay} exit duration={motion.exit} style={styles.wear}>
                <Button
                  label={onThatDay ? plannedLabel(planFor, today) : planLabel(planFor, today)}
                  icon={onThatDay ? 'check' : 'calendar'}
                  kind={onThatDay ? 'secondary' : 'primary'}
                  busy={planning.planning}
                  // Planned already: the button only says so; the day is taken off again from the calendar or with Undo.
                  onPress={onThatDay ? undefined : () => void planning.plan(outfit, planFor, today)}
                  testID="outfit-plan-day"
                />
              </Fade>
            ) : (
              <Fade key={worn ? 'worn' : 'wear'} enter={worn} exit duration={motion.exit} style={styles.wear}>
                <Button
                  label={worn ? 'Worn' : 'Wear this today'}
                  icon="check"
                  kind={worn ? 'secondary' : 'primary'}
                  busy={actions.wearing}
                  onPress={() => actions.wear(outfit, () => setWorn(true))}
                  testID="outfit-wear"
                />
              </Fade>
            )}
            <TryOnButton viewer={viewer} inline />
          </View>
          {canPlan ? (
            <Button
              label={planFor ? calendarCopy.otherDay : calendarCopy.planADay}
              kind="text"
              icon="calendar"
              compact
              onPress={() => void planning.choose(outfit, today, date)}
              testID="outfit-plan"
            />
          ) : null}
        </View>
      }>
      <View style={styles.content}>
        <OutfitVisualization
          viewer={viewer}
          outfit={outfit}
          width={width}
          onArrange={(layout) => actions.arrange(outfit, layout)}
          onArrangeFigure={(layout) => actions.arrangeFigure(outfit, layout)}
          trailing={<KeepButton outfit={outfit} onKeep={() => actions.keep(outfit)} />}
          hero={{
            top: buttonTop,
            overlay: <IconButton icon="back" label="Back" onPress={() => router.back()} style={[styles.corner, { top: buttonTop, left: size.gutter }]} />,
          }}
        />
        <View style={styles.titles}>
          {outfit.name ? (
            <Eyebrow icon={occasionIcon(outfit.occasion)} iconSize={16}>
              {occasionLabel(outfit.occasion)}
            </Eyebrow>
          ) : null}
          <AppText variant="display" accessibilityRole="header">
            {outfit.name ?? occasionLabel(outfit.occasion)}
          </AppText>
          <View style={styles.fact}>
            <Icon name="calendar" size={16} color="textSecondary" />
            <AppText variant="caption" color="textSecondary" style={styles.factText}>
              {meta}
            </AppText>
          </View>
          {daysLine ? (
            // The days this outfit stands on, in one quiet line that opens the calendar on that month.
            <PressScale
              accessibilityRole="link"
              accessibilityLabel={`${daysLine.text}. Opens the calendar`}
              haptic="quiet"
              onPress={() => router.navigate({ pathname: '/outfits', params: { view: 'calendar', day: daysLine.date } })}
              style={styles.days}
              testID="outfit-days">
              <AppText variant="secondary" color="action" style={styles.factText}>
                {daysLine.text}
              </AppText>
              <Icon name="forward" size={16} color="action" />
            </PressScale>
          ) : null}
        </View>
        {outfit.occasionNote ? (
          <AppText variant="secondary" color="textSecondary">
            Note: {outfit.occasionNote}
          </AppText>
        ) : null}
        <OutfitNotes outfit={outfit} />
        <OutfitPieces items={outfit.items} onOpen={(clothingId) => router.push({ pathname: '/clothes/[id]', params: { id: clothingId } })} />
        <Button label="Delete outfit" kind="dangerText" busy={actions.removing} onPress={confirmRemoval} testID="outfit-delete" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The picture runs to the top of the screen, under the status bar.
  screen: { paddingTop: 0 },
  content: { gap: space[6] },
  head: { flexDirection: 'row', alignItems: 'center' },
  problem: { gap: space[3] },
  titles: { gap: space[2] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { flexShrink: 1 },
  days: { alignSelf: 'flex-start', minHeight: size.touch, flexDirection: 'row', alignItems: 'center', gap: space[1] },
  corner: { position: 'absolute' },
  footer: { gap: space[1] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  wear: { flex: 1 },
});
