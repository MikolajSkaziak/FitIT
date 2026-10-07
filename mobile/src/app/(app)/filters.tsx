import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import type { Category } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Card } from '@/components/lists';
import { ChoiceGrid, ToggleRow } from '@/components/toggles';
import { isFiltered, useWardrobeFilters } from '@/features/wardrobe/filters';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { size, space } from '@/theme';

const everything = 'all';

/** Narrowing the wardrobe: a sheet over the list. Every choice applies at once, so the list behind it already shows the result. */
export default function WardrobeFilters() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dictionaries = useDictionaries();
  const filter = useWardrobeFilters(useShallow((state) => ({ search: state.search, category: state.category, forgotten: state.forgotten })));
  const { setCategory, setForgotten, clear } = useWardrobeFilters(
    useShallow((state) => ({ setCategory: state.setCategory, setForgotten: state.setForgotten, clear: state.clear })),
  );
  const options = [{ value: everything, label: 'Wszystkie' }, ...(dictionaries.data?.categories ?? []).map((entry) => ({ value: entry.code as string, label: entry.label }))];

  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="filters-sheet">
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header">
          Filtry
        </AppText>
        <IconButton icon="close" label="Zamknij" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <AppText variant="subheading" accessibilityRole="header">
            Kategoria
          </AppText>
          <ChoiceGrid
            label="Kategoria"
            options={options}
            value={filter.category ?? everything}
            onChange={(value) => setCategory(value === everything ? null : (value as Category))}
            testID="filter-category"
          />
        </View>
        <Card>
          <ToggleRow
            label="Tylko zapomniane"
            meta="Oznaczone jako rzadko noszone albo nieużywane od 30 dni."
            value={filter.forgotten}
            onChange={setForgotten}
            last
            testID="filter-forgotten"
          />
        </Card>
      </ScrollView>
      <View style={styles.actions}>
        <Button label="Pokaż ubrania" onPress={() => router.back()} testID="filters-done" />
        {isFiltered(filter) ? <Button label="Wyczyść filtry" kind="text" onPress={clear} testID="filters-clear" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { gap: space[6], paddingBottom: space[2] },
  group: { gap: space[2] },
  actions: { gap: space[1] },
});
