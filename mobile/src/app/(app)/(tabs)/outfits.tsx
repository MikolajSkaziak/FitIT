import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calendarKeys } from '@/api/calendar';
import { fetchSavedOutfits, outfitKeys } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Fade, staggerOf, useIntro } from '@/components/motion';
import { Skeleton } from '@/components/lists';
import { useTabBarSpace } from '@/components/tabBarSpace';
import { TextTabs } from '@/components/TextTabs';
import { messageFor } from '@/copy/errors';
import { CalendarView } from '@/features/calendar/CalendarView';
import { boardSize } from '@/features/styling/board';
import { matchesOutfit } from '@/features/styling/search';
import { SavedOutfitTile } from '@/features/visualization/SavedOutfitTile';
import { motion, radius, size, space, useTheme } from '@/theme';

const columnGap = space[2];
const skeletons = ['a', 'b', 'c', 'd'];

/** The saved outfits, or the calendar: what was worn on which day, and what is planned. */
type Shelf = 'saved' | 'calendar';
const shelves: readonly { value: Shelf; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'calendar', label: 'Calendar' },
];

export default function Outfits() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  // The tab bar floats over the list, so the last row needs room to scroll clear of it.
  const tabBarSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * size.gutter - columnGap) / 2;
  const [search, setSearch] = useState('');
  // An outfit's page sends the person here to see one of its days: `view=calendar&day=2026-10-15`.
  const params = useLocalSearchParams<{ view?: string; day?: string }>();
  const asked = params.view === 'calendar' ? (params.day ?? 'calendar') : null;
  const [shelf, setShelf] = useState<Shelf>(asked ? 'calendar' : 'saved');
  // Sent here again while the tab is alive (it keeps its state between visits): the calendar comes to the front again.
  const [answered, setAnswered] = useState(asked);
  if (asked !== answered) {
    setAnswered(asked);
    if (asked) {
      setShelf('calendar');
    }
  }

  const saved = useQuery({ queryKey: outfitKeys.saved, queryFn: fetchSavedOutfits });
  const all = saved.data ?? [];
  // The first screenful of tiles arrives in turn when the first answer does; searching and refetching never replay it.
  const intro = useIntro(saved.data !== undefined);
  const items = shelf === 'saved' ? all.filter((outfit) => matchesOutfit(outfit, search)) : [];
  const searching = search.trim().length > 0;

  // The spinner belongs to the pull only: tied to every background refetch, iOS leaves it hanging over the list.
  const [pulled, setPulled] = useState(false);
  const refresh = async () => {
    setPulled(true);
    await Promise.all([saved.refetch(), queryClient.invalidateQueries({ queryKey: calendarKeys.all })]);
    setPulled(false);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titles}>
        {all.length > 0 ? (
          <AppText variant="eyebrow" tabular testID="outfits-count">
            {all.length} saved
          </AppText>
        ) : null}
        <AppText variant="display" accessibilityRole="header">
          Outfits
        </AppText>
      </View>
      <TextTabs<Shelf> label="Outfits shown" tabs layout="row" options={shelves} value={shelf} onChange={setShelf} testID="outfits-shelf" />
      {shelf === 'calendar' ? (
        // Opened for a day: the calendar starts on its month, and a new day asked for later starts it again.
        <Fade key={params.day ?? 'calendar'}>
          <CalendarView openOn={params.day} />
        </Fade>
      ) : all.length > 0 ? (
        <Field
          accessibilityLabel="Search saved outfits"
          value={search}
          onChangeText={setSearch}
          placeholder="Search by occasion or item"
          leadingIcon="search"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="outfits-search"
        />
      ) : null}
    </View>
  );

  const empty = saved.isPending ? (
    <Fade key="loading" enter={false} exit duration={motion.exit}>
      <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Loading saved outfits">
        {skeletons.map((key) => (
          <Skeleton key={key} height={boardSize(tileWidth).height} width={tileWidth} radius={radius.thumb} />
        ))}
      </View>
    </Fade>
  ) : saved.isError ? (
    <Fade key="problem" style={styles.problem}>
      <AppText color="textSecondary">{messageFor(saved.error)}</AppText>
      <Button label="Try again" kind="secondary" inline onPress={() => void saved.refetch()} testID="outfits-retry" />
    </Fade>
  ) : searching ? (
    <EmptyState
      icon="bookmark"
      title="No matches"
      text="Try a different occasion or item."
      action={{ label: 'Clear search', onPress: () => setSearch(''), testID: 'outfits-clear-search' }}
      compact
      testID="outfits-no-match"
    />
  ) : (
    <EmptyState
      icon="bookmark"
      title="Saved outfits live here"
      text="Save an outfit you like and it’ll be waiting for you here."
      action={{ label: 'Open Today', icon: 'sun', onPress: () => router.navigate('/'), testID: 'outfits-open-today' }}
      testID="outfits-empty"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top + space[2] }]} testID="outfits-screen">
      <FlatList
        data={items}
        keyExtractor={(outfit) => outfit.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + space[4] }]}
        ListHeaderComponent={header}
        ListEmptyComponent={shelf === 'saved' ? empty : undefined}
        renderItem={({ item, index }) => (
          <Fade {...staggerOf(index, intro)} exit shrink>
            <SavedOutfitTile outfit={item} width={tileWidth} onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: item.id } })} />
          </Fade>
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulled} onRefresh={() => void refresh()} tintColor={theme.action} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: size.gutter, paddingBottom: space[4], gap: space[4] },
  row: { gap: columnGap },
  header: { gap: space[3] },
  titles: { gap: space[2] },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: space[4] },
  problem: { gap: space[3], paddingTop: space[4] },
});
