import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { FormError } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { basics, pieces } from '@/features/onboarding/copy';
import { StarterPicker } from '@/features/onboarding/StarterPicker';
import { useAddStarters, useMyStarters } from '@/features/onboarding/useMyStarters';
import { size, space } from '@/theme';

/** The common pieces again, after onboarding: only the ones not in the wardrobe yet. A sheet over the wardrobe. */
export default function AddBasics() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { query, remaining } = useMyStarters();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const add = useAddStarters();
  const count = chosen.size;

  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="basics-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="heading" accessibilityRole="header">
            {pieces.title}
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {pieces.lead}
          </AppText>
        </View>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <StarterPicker
          pieces={remaining}
          pending={query.isPending}
          failed={query.isError}
          onRetry={() => void query.refetch()}
          chosen={chosen}
          onChange={setChosen}
        />
      </ScrollView>
      <View style={styles.actions}>
        <FormError message={add.error ? messageFor(add.error) : null} />
        <Button
          label={count > 0 ? basics.add(count) : basics.addIdle}
          disabled={count === 0}
          busy={add.isPending}
          onPress={() => add.mutate([...chosen], { onSuccess: () => router.back() })}
          testID="basics-add"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[2] },
  titles: { flex: 1, gap: space[1] },
  body: { paddingBottom: space[2] },
  actions: { gap: space[2] },
});
