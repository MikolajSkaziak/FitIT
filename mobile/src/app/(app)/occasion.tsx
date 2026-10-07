import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Occasion } from '@/api/outfits';
import { fetchClothing, fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { OccasionPicker } from '@/features/styling/OccasionPicker';
import { proposalsRoute } from '@/features/styling/request';
import { size, space } from '@/theme';

/** "Dobierz do tego": the occasion for an outfit built around one garment. A sheet over the garment's page. */
export default function ChooseOccasion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { base } = useLocalSearchParams<{ base: string }>();
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const [note, setNote] = useState('');
  const garment = useQuery({ queryKey: wardrobeKeys.one(base), queryFn: () => fetchClothing(base) });
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });
  const limitUsed = usage.data !== undefined && usage.data.suggestions.used >= usage.data.suggestions.limit;

  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <KeyboardAvoidingView collapsable={false} behavior="padding" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="occasion-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="heading" accessibilityRole="header">
            Dobierz do tego
          </AppText>
          {garment.data?.name ? (
            <AppText variant="secondary" color="textSecondary" numberOfLines={1}>
              Ułożymy zestaw z: {garment.data.name}
            </AppText>
          ) : null}
        </View>
        <IconButton icon="close" label="Zamknij" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <OccasionPicker occasion={occasion} onOccasion={setOccasion} note={note} onNote={setNote} />
      </ScrollView>
      <View style={styles.actions}>
        {limitUsed ? (
          <AppText variant="secondary" color="textSecondary" align="center" testID="occasion-limit">
            Dzisiejszy limit propozycji jest wykorzystany. Wróć jutro.
          </AppText>
        ) : null}
        <Button
          label="Zaproponuj zestawy"
          disabled={limitUsed}
          onPress={() => router.replace(proposalsRoute({ occasion, note, baseItemId: base }))}
          testID="occasion-suggest"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  titles: { flex: 1, gap: 2 },
  body: { paddingBottom: space[2] },
  actions: { gap: space[2] },
});
