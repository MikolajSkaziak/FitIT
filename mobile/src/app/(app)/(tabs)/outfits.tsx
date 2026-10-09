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
import { Fade, staggerOf, useIntro } from '@/components/motion';
import { Skeleton } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { matchesOutfit } from '@/features/styling/search';
import { SavedOutfitTile } from '@/features/visualization/SavedOutfitTile';
import { plural } from '@/lib/plural';
import { motion, radius, size, space, useTheme } from '@/theme';

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
  // The first screenful of tiles arrives in turn when the first answer does; searching and refetching never replay it.
  const intro = useIntro(saved.data !== undefined);
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
          Outfits
        </AppText>
        {all.length > 0 ? (
          <AppText variant="secondary" color="textSecondary" tabular testID="outfits-count">
            {all.length} {plural(all.length, ['saved outfit', 'saved outfits'])}
          </AppText>
        ) : null}
      </View>
      {all.length > 0 ? (
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
          <Skeleton key={key} height={tileWidth} width={tileWidth} radius={radius.thumb} />
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
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <Fade {...staggerOf(index, intro)}>
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
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', columnGap, rowGap: space[4] },
  problem: { gap: space[3], paddingTop: space[4] },
});
