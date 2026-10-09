import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { fetchClothes, fetchWardrobeStats, wardrobeKeys, type ClothesFilter } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconToggleButton, ProgressBar } from '@/components/controls';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { GarmentTile, GarmentTileSkeleton } from '@/components/garments';
import { Fade, staggerOf, useIntro } from '@/components/motion';
import { Pill } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { StarterStrip } from '@/features/onboarding/StarterStrip';
import { groupClothes, sortClothes, toRows, type ListRow } from '@/features/wardrobe/arrange';
import { filterCount, isFiltered, subFilterTypes, useWardrobeFilters } from '@/features/wardrobe/filters';
import { firstOutfitHint, missingForFirstOutfit } from '@/features/wardrobe/firstOutfit';
import { groupLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { garments, plural } from '@/lib/plural';
import { useDebounced } from '@/lib/useDebounced';
import { motion, size, space, useTheme } from '@/theme';

const columnGap = space[2];
const skeletons = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function Wardrobe() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * size.gutter - columnGap) / 2;

  const chosen = useWardrobeFilters(
    useShallow((state) => ({
      search: state.search,
      groups: state.groups,
      types: state.types,
      colors: state.colors,
      seasons: state.seasons,
      materials: state.materials,
      usage: state.usage,
      forgotten: state.forgotten,
    })),
  );
  const { sort, groupBy } = useWardrobeFilters(useShallow((state) => ({ sort: state.sort, groupBy: state.groupBy })));
  const { setSearch, toggleType, clear } = useWardrobeFilters(useShallow((state) => ({ setSearch: state.setSearch, toggleType: state.toggleType, clear: state.clear })));
  // The list follows the search box once typing pauses, not on every letter.
  const settledSearch = useDebounced(chosen.search, 300);
  const filter: ClothesFilter = { ...chosen, search: settledSearch };
  const filtered = isFiltered(filter);
  const active = filterCount(chosen);

  const clothes = useQuery({
    queryKey: wardrobeKeys.list(filter),
    queryFn: ({ signal }) => fetchClothes(filter, signal),
    placeholderData: keepPreviousData,
    // Asked again every few seconds only while something is still being described.
    refetchInterval: (query) => (query.state.data?.some((item) => item.status === 'processing') ? 2500 : false),
  });
  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const dictionaries = useDictionaries();

  const items = useMemo(() => clothes.data ?? [], [clothes.data]);
  // Sorting and grouping happen here, on the list the app already holds (the server sends at most 500 garments).
  const rows = useMemo(() => toRows(groupClothes(sortClothes(items, sort, dictionaries.data), groupBy, dictionaries.data)), [items, sort, groupBy, dictionaries.data]);
  // Under the search box: the types of the one chosen group. With no group, or several, there is no row.
  const types = subFilterTypes(dictionaries.data, chosen.groups);
  // The first screenful of tiles arrives in turn when the first answer does; scrolling and refetching never replay it.
  const intro = useIntro(clothes.data !== undefined);
  const hint = !filtered && clothes.data ? firstOutfitHint(missingForFirstOutfit(clothes.data)) : null;
  const openAdd = () => router.push('/add');

  // The spinner belongs to the pull only: tied to every background refetch, iOS leaves it hanging over the list.
  const [pulled, setPulled] = useState(false);
  const refresh = async () => {
    setPulled(true);
    await Promise.all([clothes.refetch(), stats.refetch()]);
    setPulled(false);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header">
          Wardrobe
        </AppText>
        <View style={styles.actions}>
          <IconToggleButton
            icon="filters"
            label={active > 0 ? `Filters, ${active} active` : 'Filters'}
            active={active > 0}
            onPress={() => router.push('/filters')}
            testID="wardrobe-filters"
          />
          <Button label="Add" accessibilityLabel="Add clothes" icon="plus" compact inline onPress={openAdd} testID="wardrobe-add" />
        </View>
      </View>
      {stats.data && stats.data.total > 0 ? (
        <View style={styles.stat}>
          <View style={styles.statLine}>
            <AppText variant="secondaryStrong" tabular>
              {stats.data.wornLast30Days} of {stats.data.total} {plural(stats.data.total, ['item', 'items'])} worn in outfits
            </AppText>
            <AppText variant="meta" color="textSecondary">
              last 30 days
            </AppText>
          </View>
          <ProgressBar progress={stats.data.wornLast30Days / stats.data.total} label="Wardrobe usage" />
          {hint ? (
            <AppText variant="meta" color="textSecondary">
              {hint}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {items.length > 0 || filtered ? (
        <>
          <Field
            accessibilityLabel="Search your wardrobe"
            value={chosen.search}
            onChangeText={setSearch}
            placeholder="Search by name"
            leadingIcon="search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            testID="wardrobe-search"
          />
          {types ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.typesBar}
              contentContainerStyle={styles.types}
              accessibilityLabel={`${groupLabel(dictionaries.data, chosen.groups[0]) ?? 'Group'}: types`}
              testID="wardrobe-types-row">
              {types.map((type) => (
                <Pill key={type.code} label={type.label} selected={chosen.types.includes(type.code)} onPress={() => toggleType(type.code)} testID={`type-${type.code}`} />
              ))}
            </ScrollView>
          ) : null}
          <AppText variant="meta" color="textSecondary" tabular style={styles.count}>
            {garments(items.length)}
          </AppText>
        </>
      ) : null}
    </View>
  );

  const empty = clothes.isPending ? (
    <Fade key="loading" enter={false} exit duration={motion.exit}>
      <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Loading your wardrobe">
        {skeletons.map((key) => (
          <GarmentTileSkeleton key={key} width={tileWidth} />
        ))}
      </View>
    </Fade>
  ) : clothes.isError ? (
    <Fade key="problem" style={styles.problem}>
      <AppText color="textSecondary">{messageFor(clothes.error)}</AppText>
      <Button label="Try again" kind="secondary" inline onPress={() => void clothes.refetch()} />
    </Fade>
  ) : filtered ? (
    <EmptyState
      icon="hanger"
      title="No matches"
      text="Try a different search, or clear the filters to see your whole wardrobe."
      action={{ label: 'Clear filters', onPress: clear, testID: 'wardrobe-clear-filters' }}
      compact
      testID="wardrobe-no-match"
    />
  ) : (
    <EmptyState
      icon="hanger"
      title="Add a dozen or so pieces"
      text="Take photos of clothes you love, plus a few that never get worn. We’ll describe each one for you."
      action={{ label: 'Add clothes', icon: 'plus', onPress: openAdd, testID: 'wardrobe-empty-add' }}
      footnote={
        <AppText variant="meta" color="textSecondary" align="center">
          Once you’ve added tops, bottoms and shoes, we can build your first outfit.
        </AppText>
      }
      testID="wardrobe-empty"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top + space[2] }]} testID="wardrobe-screen">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={filtered ? null : <StarterStrip />}
        renderItem={({ item: row }) =>
          row.kind === 'heading' ? (
            <View style={styles.heading}>
              <AppText variant="subheading" accessibilityRole="header">
                {row.title}
              </AppText>
              <AppText variant="meta" color="textSecondary" tabular>
                {row.count}
              </AppText>
            </View>
          ) : (
            <TileRow row={row} tileWidth={tileWidth} intro={intro} />
          )
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulled} onRefresh={() => void refresh()} tintColor={theme.action} />}
      />
    </View>
  );
}

/** Two tiles side by side; a lone last tile keeps its column. */
function TileRow({ row, tileWidth, intro }: { row: Extract<ListRow, { kind: 'tiles' }>; tileWidth: number; intro: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {row.items.map((item, at) => (
        <Fade key={item.id} {...staggerOf(row.firstIndex + at, intro)}>
          <GarmentTile item={item} width={tileWidth} onPress={() => router.push({ pathname: '/clothes/[id]', params: { id: item.id } })} />
        </Fade>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: size.gutter, paddingBottom: space[4], gap: space[4] },
  row: { flexDirection: 'row', gap: columnGap },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: space[2] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  header: { gap: space[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  stat: { gap: space[2] },
  statLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] },
  // The types of the chosen group sit in one line that scrolls sideways and runs to both screen edges. It is always one pill high, so the list below never moves.
  typesBar: { marginHorizontal: -size.gutter, flexGrow: 0 },
  types: { paddingHorizontal: size.gutter, gap: space[2], alignItems: 'center' },
  count: { alignSelf: 'flex-end' },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: space[4] },
  problem: { gap: space[3], paddingTop: space[4] },
});
