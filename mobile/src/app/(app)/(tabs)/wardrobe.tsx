import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { fetchClothes, fetchWardrobeStats, wardrobeKeys, type ClothesFilter } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/controls';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { GarmentTile, GarmentTileSkeleton } from '@/components/garments';
import { Chip } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { isFiltered, useWardrobeFilters } from '@/features/wardrobe/filters';
import { firstOutfitHint, missingForFirstOutfit } from '@/features/wardrobe/firstOutfit';
import { categoryLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { garments, plural } from '@/lib/plural';
import { useDebounced } from '@/lib/useDebounced';
import { size, space, useTheme } from '@/theme';

const columnGap = space[2];
const skeletons = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function Wardrobe() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * size.gutter - columnGap) / 2;

  const chosen = useWardrobeFilters(useShallow((state) => ({ search: state.search, category: state.category, forgotten: state.forgotten })));
  const { setSearch, setCategory, setForgotten, clear } = useWardrobeFilters(
    useShallow((state) => ({ setSearch: state.setSearch, setCategory: state.setCategory, setForgotten: state.setForgotten, clear: state.clear })),
  );
  // The list follows the search box once typing pauses, not on every letter.
  const settledSearch = useDebounced(chosen.search, 300);
  const filter: ClothesFilter = { ...chosen, search: settledSearch };
  const filtered = isFiltered(filter);

  const clothes = useQuery({
    queryKey: wardrobeKeys.list(filter),
    queryFn: ({ signal }) => fetchClothes(filter, signal),
    placeholderData: keepPreviousData,
    // Asked again every few seconds only while something is still being described.
    refetchInterval: (query) => (query.state.data?.some((item) => item.status === 'processing') ? 2500 : false),
  });
  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const dictionaries = useDictionaries();

  const items = clothes.data ?? [];
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
          Szafa
        </AppText>
        <Button label="Dodaj" accessibilityLabel="Dodaj ubrania" icon="plus" compact inline onPress={openAdd} testID="wardrobe-add" />
      </View>
      {stats.data && stats.data.total > 0 ? (
        <View style={styles.stat}>
          <View style={styles.statLine}>
            <AppText variant="secondaryStrong" tabular>
              W zestawach było {stats.data.wornLast30Days} z {stats.data.total} {plural(stats.data.total, ['ubrania', 'ubrań', 'ubrań'])}
            </AppText>
            <AppText variant="meta" color="textSecondary">
              ostatnie 30 dni
            </AppText>
          </View>
          <ProgressBar progress={stats.data.wornLast30Days / stats.data.total} label="Wykorzystanie szafy" />
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
            accessibilityLabel="Szukaj w szafie"
            value={chosen.search}
            onChangeText={setSearch}
            placeholder="Szukaj po nazwie"
            leadingIcon="search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            testID="wardrobe-search"
          />
          <View style={styles.filters}>
            <Button label="Filtry" kind="secondary" icon="filters" compact inline onPress={() => router.push('/filters')} testID="wardrobe-filters" />
            {chosen.category ? (
              <Chip
                label={categoryLabel(dictionaries.data, chosen.category) ?? 'Kategoria'}
                actionLabel={`Usuń filtr: ${(categoryLabel(dictionaries.data, chosen.category) ?? 'kategoria').toLowerCase()}`}
                onRemove={() => setCategory(null)}
              />
            ) : null}
            {chosen.forgotten ? <Chip label="Zapomniane" actionLabel="Usuń filtr: zapomniane" onRemove={() => setForgotten(false)} testID="chip-forgotten" /> : null}
            <AppText variant="meta" color="textSecondary" tabular style={styles.count}>
              {garments(items.length)}
            </AppText>
          </View>
        </>
      ) : null}
    </View>
  );

  const empty = clothes.isPending ? (
    <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Wczytujemy szafę">
      {skeletons.map((key) => (
        <GarmentTileSkeleton key={key} width={tileWidth} />
      ))}
    </View>
  ) : clothes.isError ? (
    <View style={styles.problem}>
      <AppText color="textSecondary">{messageFor(clothes.error)}</AppText>
      <Button label="Spróbuj ponownie" kind="secondary" inline onPress={() => void clothes.refetch()} />
    </View>
  ) : filtered ? (
    <EmptyState
      icon="hanger"
      title="Nic nie pasuje do filtrów"
      text="Zmień wyszukiwanie albo wyczyść filtry, żeby zobaczyć całą szafę."
      action={{ label: 'Wyczyść filtry', onPress: clear, testID: 'wardrobe-clear-filters' }}
      compact
      testID="wardrobe-no-match"
    />
  ) : (
    <EmptyState
      icon="hanger"
      title="Zacznij od kilkunastu ubrań"
      text="Sfotografuj ubrania, które lubisz, i kilka takich, które leżą bez użycia. Opiszemy je za Ciebie."
      action={{ label: 'Dodaj ubrania', icon: 'plus', onPress: openAdd, testID: 'wardrobe-empty-add' }}
      footnote={
        <AppText variant="meta" color="textSecondary" align="center">
          Pierwszy zestaw ułożymy, gdy w szafie będą góra, dół i buty.
        </AppText>
      }
      testID="wardrobe-empty"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top + space[2] }]} testID="wardrobe-screen">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <GarmentTile item={item} width={tileWidth} onPress={() => router.push({ pathname: '/clothes/[id]', params: { id: item.id } })} />}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  stat: { gap: space[2] },
  statLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  count: { marginLeft: 'auto' },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: space[4] },
  problem: { gap: space[3], paddingTop: space[4] },
});
