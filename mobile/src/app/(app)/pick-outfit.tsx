import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSavedOutfits, outfitKeys } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Skeleton } from '@/components/lists';
import { messageFor, messageForCode } from '@/copy/errors';
import { maxPerDay, suggestLabel, withinHorizon } from '@/features/calendar/copy';
import { finishPickOutfit } from '@/features/calendar/session';
import { entriesOn, todayOf, useCalendarRange, usePlaceToday } from '@/features/calendar/useCalendar';
import { boardSize } from '@/features/styling/board';
import { SavedOutfitTile } from '@/features/visualization/SavedOutfitTile';
import { formatSpokenDay, fromIso } from '@/lib/dates';
import { radius, size, space } from '@/theme';

const columnGap = space[2];

/**
 * The saved outfits, to pick one for a day of the calendar. Picking answers whoever opened the sheet (`usePickOutfit`)
 * and closes it; the saving happens there. Outfits the day already holds are left out. For a day the forecast reaches,
 * there is also a way to have new looks suggested for it.
 */
export default function PickOutfitSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ date: string }>();
  const known = usePlaceToday();
  const day = fromIso(params.date ?? '') ?? known;
  const tileWidth = (width - 2 * size.gutter - columnGap) / 2;

  const saved = useQuery({ queryKey: outfitKeys.saved, queryFn: fetchSavedOutfits });
  const calendar = useCalendarRange(day, day);
  const today = todayOf(calendar.data) ?? known;
  const held = entriesOn(calendar.data, params.date);
  const full = held.length >= (calendar.data?.maxPerDay ?? maxPerDay);
  const free = (saved.data ?? []).filter((outfit) => held.every((entry) => entry.outfit.id !== outfit.id));

  // Closed some other way (swiped down): the opener still gets its answer.
  useEffect(() => () => finishPickOutfit(null), []);

  const suggest = () => {
    finishPickOutfit(null);
    router.replace({ pathname: '/occasion', params: { date: params.date } });
  };

  return (
    <View collapsable={false} style={styles.sheet} testID="pick-outfit-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="eyebrow">{formatSpokenDay(day)}</AppText>
          <AppText variant="heading" accessibilityRole="header">
            Add an outfit
          </AppText>
        </View>
        <IconButton icon="close" label="Close" onPress={() => router.back()} testID="pick-outfit-close" />
      </View>
      {full ? (
        <AppText color="textSecondary" accessibilityRole="alert" testID="pick-outfit-full">
          {messageForCode('calendar_day_full')}
        </AppText>
      ) : (
        <FlatList
          data={free}
          keyExtractor={(outfit) => outfit.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          style={styles.list}
          contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, space[4]) }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            withinHorizon(day, today) ? <Button label={suggestLabel(day, today)} kind="secondary" icon="sparkle" onPress={suggest} testID="pick-outfit-suggest" /> : undefined
          }
          ListEmptyComponent={
            saved.isPending ? (
              <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Loading saved outfits">
                <Skeleton height={boardSize(tileWidth).height} width={tileWidth} radius={radius.thumb} />
                <Skeleton height={boardSize(tileWidth).height} width={tileWidth} radius={radius.thumb} />
              </View>
            ) : (
              <AppText variant="secondary" color="textSecondary" testID="pick-outfit-none">
                {saved.isError
                  ? messageFor(saved.error)
                  : (saved.data ?? []).length > 0
                    ? 'Every outfit you saved is already on this day.'
                    : 'No saved outfits yet. Save a look you like and it’ll be here to pick.'}
              </AppText>
            )
          }
          renderItem={({ item }) => (
            <SavedOutfitTile
              outfit={item}
              width={tileWidth}
              onPress={() => {
                finishPickOutfit(item);
                router.back();
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  titles: { flex: 1, gap: space[1] },
  list: { marginHorizontal: -size.gutter },
  body: { paddingHorizontal: size.gutter, gap: space[4] },
  row: { gap: columnGap },
  skeletons: { flexDirection: 'row', gap: columnGap },
});
