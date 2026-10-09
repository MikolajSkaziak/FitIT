import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { fetchOutfit, outfitKeys } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Collage } from '@/components/Collage';
import { IconButton } from '@/components/controls';
import { Fade } from '@/components/motion';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { occasionIcon, occasionLabel } from '@/copy/labels';
import { OutfitNotes, RatingBar } from '@/features/styling/OutfitParts';
import { findCachedOutfit, useOutfitActions } from '@/features/styling/useOutfitActions';
import { OutfitVisualization } from '@/features/visualization/OutfitVisualization';
import { rangeOf } from '@/features/weather/copy';
import { formatDay } from '@/lib/dates';
import { motion, radius, size, space } from '@/theme';

const outfitGone = 'This outfit isn’t here anymore.';

/** One saved outfit: the garments, what the stylist said about them, and what can be done with it. */
export default function OutfitDetail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const actions = useOutfitActions();
  const [worn, setWorn] = useState(false);

  const found = useQuery({
    queryKey: outfitKeys.one(id),
    queryFn: () => fetchOutfit(id),
    // Shown at once from the list the person came from, then confirmed with the server.
    initialData: () => findCachedOutfit(queryClient, id),
    initialDataUpdatedAt: 0,
  });
  const outfit = found.data;

  if (!outfit) {
    return (
      <Screen testID="outfit-screen">
        <View style={styles.content}>
          <View style={styles.head}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
          {found.isError ? (
            <View style={styles.problem}>
              <AppText color="textSecondary">{codeOf(found.error) === 'not_found' ? outfitGone : messageFor(found.error)}</AppText>
              {codeOf(found.error) === 'not_found' ? null : <Button label="Try again" kind="secondary" inline onPress={() => void found.refetch()} />}
            </View>
          ) : (
            <View style={styles.problem} accessibilityRole="progressbar" accessibilityLabel="Loading outfit">
              <Skeleton height={size.touch} width="60%" />
              <Skeleton height={240} radius={radius.well} />
              <Skeleton height={16} />
              <Skeleton height={16} width="70%" />
            </View>
          )}
        </View>
      </Screen>
    );
  }

  const name = `${occasionLabel(outfit.occasion)}, ${formatDay(new Date(outfit.createdAt))}`;
  const confirmRemoval = () =>
    Alert.alert(`Delete outfit “${name}”?`, 'We’ll remove it from your saved outfits. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete outfit', style: 'destructive', onPress: () => actions.remove(outfit, () => router.back()) },
    ]);

  return (
    <Screen testID="outfit-screen">
      <View style={styles.content}>
        <BackHeader title={outfit.name ?? occasionLabel(outfit.occasion)} titleIcon={occasionIcon(outfit.occasion)} meta={outfit.weather ? `${formatDay(new Date(outfit.createdAt))}, ${rangeOf(outfit.weather)}` : formatDay(new Date(outfit.createdAt))} onBack={() => router.back()} />
        {outfit.occasionNote ? (
          <AppText variant="secondary" color="textSecondary">
            Note: {outfit.occasionNote}
          </AppText>
        ) : null}
        <OutfitVisualization
          outfit={outfit}
          width={width - 2 * size.gutter}
          collage={<Collage items={outfit.items} width={width - 2 * size.gutter} testID="outfit-collage" />}
        />
        <OutfitNotes outfit={outfit} />
        <RatingBar outfit={outfit} onRate={(rating) => actions.rate(outfit, rating)} onKeep={() => actions.keep(outfit)} />
        <View style={styles.footer}>
          <FormError message={actions.error ? (codeOf(actions.error) === 'not_found' ? outfitGone : messageFor(actions.error)) : null} />
          <Fade key={worn ? 'worn' : 'wear'} enter={worn} exit duration={motion.exit}>
            <Button
              label={worn ? 'Worn' : 'Wear this'}
              icon={worn ? 'check' : undefined}
              kind={worn ? 'secondary' : 'primary'}
              busy={actions.wearing}
              onPress={() => actions.wear(outfit, () => setWorn(true))}
              testID="outfit-wear"
            />
          </Fade>
          <Button label="Delete outfit" kind="dangerText" busy={actions.removing} onPress={confirmRemoval} testID="outfit-delete" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
  // The 24 icon sits in a 44 target; pulling it out by 10 lines the icon up with the content edge.
  head: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -10 },
  problem: { gap: space[3] },
  footer: { gap: space[1] },
});
