import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchClothes, noFilter, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/controls';
import { Skeleton } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { swapCopy } from '@/features/builder/copy';
import { GarmentChoice } from '@/features/builder/GarmentChoice';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { typeLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { radius, size, space } from '@/theme';

const columnGap = space[2];

/**
 * "Swap": everything in the wardrobe that plays the same part in an outfit as one chosen piece, to put another in its
 * place. Picking one swaps it in and closes the sheet; the piece itself is marked, and closing leaves it where it is.
 */
export default function BuilderSwapSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Two fixed columns: a last piece alone in its row keeps the width of the others.
  const cell = { width: (width - 2 * size.gutter - columnGap) / 2 };
  const { id } = useLocalSearchParams<{ id: string }>();
  const piece = useOutfitBuilder((state) => state.items.find((item) => item.id === id));
  const swap = useOutfitBuilder((state) => state.swap);
  const dictionaries = useDictionaries().data;
  const clothes = useQuery({ queryKey: wardrobeKeys.list(noFilter), queryFn: ({ signal }) => fetchClothes(noFilter, signal) });
  const alike = (clothes.data ?? []).filter((item) => item.status === 'ready' && item.category === piece?.category);
  // The piece itself leads, so what is worn now is the first thing seen.
  const choices = [...alike.filter((item) => item.id === id), ...alike.filter((item) => item.id !== id)];

  return (
    <View collapsable={false} style={styles.sheet} testID="builder-swap-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="eyebrow">{swapCopy.eyebrow}</AppText>
          <AppText variant="heading" accessibilityRole="header" numberOfLines={1}>
            {piece?.name ?? 'Item without details'}
          </AppText>
        </View>
        <IconButton icon="close" label="Close" onPress={() => router.back()} testID="builder-swap-close" />
      </View>
      <FlatList
        data={choices}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        style={styles.list}
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, space[4]) }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          clothes.isPending ? (
            <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Loading your clothes">
              <Skeleton height={188} width={cell.width} radius={radius.well} />
              <Skeleton height={188} width={cell.width} radius={radius.well} />
            </View>
          ) : (
            <AppText variant="secondary" color="textSecondary">
              {clothes.isError ? messageFor(clothes.error) : swapCopy.empty}
            </AppText>
          )
        }
        ListFooterComponent={
          choices.length === 1 ? (
            <AppText variant="secondary" color="textSecondary" testID="builder-swap-none">
              {swapCopy.empty}
            </AppText>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={cell}>
            <GarmentChoice
              item={item}
              selected={item.id === id}
              kind={typeLabel(dictionaries, item.subcategory)}
              fill
              onPress={() => {
                if (item.id !== id) {
                  swap(id, item);
                }

                router.back();
              }}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  titles: { flex: 1, gap: space[1] },
  list: { marginHorizontal: -size.gutter },
  body: { paddingHorizontal: size.gutter, gap: space[4] },
  row: { flexDirection: 'row', gap: columnGap },
});
