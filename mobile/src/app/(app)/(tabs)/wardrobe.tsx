import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { fetchClothes, wardrobeKeys, type Clothing, type ClothesFilter, type GarmentGroup } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconToggleButton } from '@/components/controls';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { GarmentTileSkeleton } from '@/components/garments';
import { Fade, staggerOf, useIntro } from '@/components/motion';
import { useTabBarSpace } from '@/components/tabBarSpace';
import { TextTabs } from '@/components/TextTabs';
import { messageFor } from '@/copy/errors';
import { StarterStrip } from '@/features/onboarding/StarterStrip';
import { groupClothes, sortClothes, toRows, type ListRow } from '@/features/wardrobe/arrange';
import { filterCount, isFiltered, subFilterTypes, useWardrobeFilters } from '@/features/wardrobe/filters';
import { firstOutfitHint, missingForFirstOutfit } from '@/features/wardrobe/firstOutfit';
import { groupLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { WardrobeTile } from '@/features/wardrobe/WardrobeTile';
import { plural } from '@/lib/plural';
import { useDebounced } from '@/lib/useDebounced';
import { motion, size, space, useTheme } from '@/theme';

const columnGap = space[3];
const skeletons = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function Wardrobe() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The tab bar floats over the list, so the last row needs room to scroll clear of it.
  const tabBarSpace = useTabBarSpace();
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
  const { setSearch, setGroup, clearGroups, toggleType, clear } = useWardrobeFilters(
    useShallow((state) => ({ setSearch: state.setSearch, setGroup: state.setGroup, clearGroups: state.clearGroups, toggleType: state.toggleType, clear: state.clear })),
  );
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
  const kindOf = (item: Clothing) => groupLabel(dictionaries.data, item.group);

  // The spinner belongs to the pull only: tied to every background refetch, iOS leaves it hanging over the list.
  const [pulled, setPulled] = useState(false);
  const refresh = async () => {
    setPulled(true);
    await clothes.refetch();
    setPulled(false);
  };

  const showTools = items.length > 0 || filtered;
  // "All" and one tab for each of the groups; the groups chosen in the filters sheet light their tabs too.
  const groupTabs = [{ value: 'all' as GarmentGroup | 'all', label: 'All' }, ...(dictionaries.data?.groups ?? []).map((entry) => ({ value: entry.code as GarmentGroup | 'all', label: entry.label }))];

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          {showTools ? (
            <AppText variant="eyebrow" tabular>
              {items.length} {plural(items.length, ['piece', 'pieces'])}
            </AppText>
          ) : null}
          <AppText variant="display" accessibilityRole="header">
            Wardrobe
          </AppText>
        </View>
        <IconToggleButton
          icon="filters"
          label={active > 0 ? `Filters, ${active} active` : 'Filters'}
          active={active > 0}
          onPress={() => router.push('/filters')}
          testID="wardrobe-filters"
        />
      </View>
      {showTools ? (
        <>
          <Field
            accessibilityLabel="Search your wardrobe"
            value={chosen.search}
            onChangeText={setSearch}
            placeholder="Search your wardrobe"
            leadingIcon="search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            testID="wardrobe-search"
          />
          <View>
            {dictionaries.data ? (
              <TextTabs
                label="Groups"
                tabs
                options={groupTabs}
                value={chosen.groups.length > 0 ? chosen.groups : ['all']}
                onChange={(group) => (group === 'all' ? clearGroups() : setGroup(group))}
                testID="wardrobe-groups"
              />
            ) : null}
            {types ? (
              <TextTabs
                label={`${groupLabel(dictionaries.data, chosen.groups[0]) ?? 'Group'}: types`}
                options={types.map((type) => ({ value: type.code, label: type.label }))}
                value={chosen.types}
                onChange={toggleType}
                testID="wardrobe-types-row"
              />
            ) : null}
          </View>
          {hint ? (
            <AppText variant="meta" color="textSecondary">
              {hint}
            </AppText>
          ) : null}
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
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + space[4] }]}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={filtered ? null : <StarterStrip />}
        renderItem={({ item: row }) =>
          row.kind === 'heading' ? (
            <View style={styles.heading}>
              <AppText variant="eyebrow" accessibilityRole="header">
                {row.title}
              </AppText>
              <AppText variant="meta" color="textSecondary" tabular>
                {row.count}
              </AppText>
            </View>
          ) : (
            <TileRow row={row} tileWidth={tileWidth} intro={intro} kindOf={kindOf} />
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
function TileRow({ row, tileWidth, intro, kindOf }: { row: Extract<ListRow, { kind: 'tiles' }>; tileWidth: number; intro: boolean; kindOf: (item: Clothing) => string | null }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {row.items.map((item, at) => (
        <Fade key={item.id} {...staggerOf(row.firstIndex + at, intro)} exit shrink>
          <WardrobeTile item={item} width={tileWidth} kind={kindOf(item)} onPress={() => router.push({ pathname: '/clothes/[id]', params: { id: item.id } })} />
        </Fade>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: size.gutter, paddingBottom: space[4], gap: size.gutter },
  row: { flexDirection: 'row', gap: columnGap },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: space[2] },
  header: { gap: space[6], paddingBottom: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[4] },
  titles: { flexShrink: 1, gap: space[2] },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: size.gutter },
  problem: { gap: space[3], paddingTop: space[4] },
});
