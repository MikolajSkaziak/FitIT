import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSavedOutfits, outfitKeys } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Skeleton } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { matchesOutfit } from '@/features/styling/search';
import { SavedOutfitTile } from '@/features/visualization/SavedOutfitTile';
import { plural } from '@/lib/plural';
import { radius, size, space, useTheme } from '@/theme';

const columnGap = space[2];
const skeletons = ['a', 'b', 'c', 'd'];

export default function Outfits() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * size.gutter - columnGap) / 2;
  const [search, setSearch] = useState('');

  const saved = useQuery({ queryKey: outfitKeys.saved, queryFn: fetchSavedOutfits });
  const all = saved.data ?? [];
  const items = all.filter((outfit) => matchesOutfit(outfit, search));
  const searching = search.trim().length > 0;

  // The spinner belongs to the pull only: tied to every background refetch, iOS leaves it hanging over the list.
  const [pulled, setPulled] = useState(false);
  const refresh = async () => {
    setPulled(true);
    await saved.refetch();
    setPulled(false);
  };

  const header = (
    <View style={styles.header}>
      <View>
        <AppText variant="display" accessibilityRole="header">
          Outfity
        </AppText>
        {all.length > 0 ? (
          <AppText variant="secondary" color="textSecondary" tabular testID="outfits-count">
            {all.length} {plural(all.length, ['zapisany zestaw', 'zapisane zestawy', 'zapisanych zestawów'])}
          </AppText>
        ) : null}
      </View>
      {all.length > 0 ? (
        <Field
          accessibilityLabel="Szukaj w zapisanych zestawach"
          value={search}
          onChangeText={setSearch}
          placeholder="Szukaj po okazji lub ubraniu"
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
    <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Wczytujemy zapisane zestawy">
      {skeletons.map((key) => (
        <Skeleton key={key} height={tileWidth} width={tileWidth} radius={radius.thumb} />
      ))}
    </View>
  ) : saved.isError ? (
    <View style={styles.problem}>
      <AppText color="textSecondary">{messageFor(saved.error)}</AppText>
      <Button label="Spróbuj ponownie" kind="secondary" inline onPress={() => void saved.refetch()} testID="outfits-retry" />
    </View>
  ) : searching ? (
    <EmptyState
      icon="bookmark"
      title="Nic nie pasuje do wyszukiwania"
      text="Wpisz inną okazję albo nazwę ubrania."
      action={{ label: 'Wyczyść wyszukiwanie', onPress: () => setSearch(''), testID: 'outfits-clear-search' }}
      compact
      testID="outfits-no-match"
    />
  ) : (
    <EmptyState
      icon="bookmark"
      title="Tu trafią zapisane zestawy"
      text="Zapisz propozycję, która Ci się spodoba, a znajdziesz ją tutaj, kiedy tylko zechcesz."
      action={{ label: 'Otwórz Dziś', icon: 'sun', onPress: () => router.navigate('/'), testID: 'outfits-open-today' }}
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
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <SavedOutfitTile outfit={item} width={tileWidth} onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: item.id } })} />}
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
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: space[4] },
  problem: { gap: space[3], paddingTop: space[4] },
});
