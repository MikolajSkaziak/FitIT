import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { deleteClothing, fetchClothing, reprocessClothing, updateClothing, wardrobeKeys, type Clothing, type ClothingChange } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/forms';
import { GarmentImage } from '@/components/garments';
import { Card, Row, Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { styleLabel } from '@/copy/labels';
import { kindLine, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { formatDay } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { radius, space } from '@/theme';

const photoHeight = 248;

export default function GarmentDetail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dictionaries = useDictionaries();

  const garment = useQuery({
    queryKey: wardrobeKeys.one(id),
    queryFn: () => fetchClothing(id),
    // Shown at once from the list the person came from, then confirmed with the server.
    initialData: () =>
      queryClient
        .getQueriesData<Clothing[]>({ queryKey: [...wardrobeKeys.all, 'list'] })
        .flatMap(([, list]) => list ?? [])
        .find((item) => item.id === id),
    initialDataUpdatedAt: 0,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 2500 : false),
  });

  const remember = (item: Clothing) => {
    queryClient.setQueryData(wardrobeKeys.one(id), item);
    void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
    void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
  };

  // A switch shows its new position at once; if the server refuses, it goes back and says why.
  const flag = useMutation({
    mutationFn: (change: ClothingChange) => updateClothing(id, change),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: wardrobeKeys.one(id) });
      const before = queryClient.getQueryData<Clothing>(wardrobeKeys.one(id));
      if (before) {
        queryClient.setQueryData<Clothing>(wardrobeKeys.one(id), {
          ...before,
          inLaundry: change.inLaundry ?? before.inLaundry,
          rarelyWorn: change.rarelyWorn ?? before.rarelyWorn,
        });
      }

      return before;
    },
    onError: (_error, _change, before) => {
      if (before) {
        queryClient.setQueryData(wardrobeKeys.one(id), before);
      }
    },
    onSuccess: remember,
  });
  const retry = useMutation({ mutationFn: () => reprocessClothing(id), onSuccess: remember });
  const remove = useMutation({
    mutationFn: () => deleteClothing(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
      router.back();
    },
  });

  const item = garment.data;
  const back = <IconButton icon="back" label="Back" onPress={() => router.back()} />;

  if (!item) {
    return (
      <Screen testID="garment-screen">
        <View style={styles.content}>
          <View style={styles.head}>{back}</View>
          {garment.isError ? (
            <View style={styles.problem}>
              <AppText color="textSecondary">{messageFor(garment.error)}</AppText>
              <Button label="Try again" kind="secondary" inline onPress={() => void garment.refetch()} />
            </View>
          ) : (
            <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading item">
              <Skeleton height={photoHeight} radius={radius.card} />
              <Skeleton height={24} width="70%" />
              <Skeleton height={16} width="40%" />
            </View>
          )}
        </View>
      </Screen>
    );
  }

  const name = item.name ?? 'Unnamed item';
  const added = `Added ${formatDay(new Date(item.createdAt))}.`;
  const worn = item.wearCount > 0 ? ` In ${item.wearCount} ${plural(item.wearCount, ['outfit', 'outfits'])}.` : '';
  const scale = (entries: readonly { value: number; label: string }[] | undefined, value: number | null) =>
    value === null ? undefined : (entries?.find((entry) => entry.value === value)?.label ?? String(value));
  const edit = () => router.push({ pathname: '/clothes/[id]/edit', params: { id } });

  const confirmRemoval = () =>
    Alert.alert(`Delete “${name}”?`, 'We’ll delete this item and its photos. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete item', style: 'destructive', onPress: () => remove.mutate() },
    ]);

  return (
    <Screen testID="garment-screen">
      <View style={styles.content}>
        <View style={styles.head}>{back}</View>
        <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={photoHeight} inset={24} corner={radius.card} label={name} />

        {item.status === 'processing' ? (
          <View style={styles.title} accessibilityRole="progressbar" accessibilityLabel="Describing your photo">
            <View style={styles.describing}>
              <Icon name="sparkle" color="action" />
              <AppText variant="heading" color="textSecondary">
                Describing your photo
              </AppText>
            </View>
            <AppText color="textSecondary">The name and details will show up here in a moment.</AppText>
          </View>
        ) : (
          <View style={styles.title}>
            <AppText variant="heading" accessibilityRole="header" testID="garment-name">
              {name}
            </AppText>
            {kindLine(dictionaries.data, item) ? <AppText color="textSecondary">{kindLine(dictionaries.data, item)}</AppText> : null}
            <AppText variant="meta" color="textSecondary">
              {added}
              {worn}
            </AppText>
          </View>
        )}

        {item.status === 'failed' ? (
          <View style={styles.failed}>
            <AppText variant="label">We couldn’t describe this item</AppText>
            <AppText variant="secondary" color="textSecondary">
              Fill in the details yourself, or try again. Until it has details, we can’t use it in outfits.
            </AppText>
            <View style={styles.failedActions}>
              <Button label="Fill in details" compact inline onPress={edit} testID="garment-fill" />
              <Button label="Describe again" kind="secondary" compact inline busy={retry.isPending} onPress={() => retry.mutate()} testID="garment-retry" />
            </View>
            <FormError message={retry.isError ? messageFor(retry.error) : null} />
          </View>
        ) : null}

        {item.status === 'ready' ? (
          <Card>
            <Row label="Color" value={item.colors.map((color) => dictionaries.data?.colors.find((entry) => entry.code === color)?.label ?? color).join(', ')} />
            <Row label="Pattern" value={dictionaries.data?.patterns.find((entry) => entry.code === item.pattern)?.label} />
            <Row label="Material" value={dictionaries.data?.materials.find((entry) => entry.code === item.material)?.label} />
            <Row label="Formality" value={scale(dictionaries.data?.formality, item.formality)} />
            <Row label="Warmth" value={scale(dictionaries.data?.warmth, item.warmth)} />
            {item.seasons.length > 0 ? (
              <Row label="Seasons" value={item.seasons.map((season) => dictionaries.data?.seasons.find((entry) => entry.code === season)?.label ?? season).join(', ')} />
            ) : null}
            <Row label="Good in rain" value={item.rainOk ? 'Yes' : 'No'} />
            {item.styles.length > 0 ? <Row label="Style" value={item.styles.map((style) => styleLabel(style).toLowerCase()).join(', ')} /> : null}
            <Row label="Edit details" onPress={edit} last testID="garment-edit" />
          </Card>
        ) : null}

        {item.status !== 'processing' ? (
          <Card>
            <ToggleRow
              label="In the laundry"
              meta="We’ll skip it in outfit suggestions."
              value={item.inLaundry}
              onChange={(value) => flag.mutate({ inLaundry: value })}
              testID="garment-laundry"
            />
            <ToggleRow
              label="Rarely worn"
              meta="We’ll suggest it more often, as a Discovery."
              value={item.rarelyWorn}
              onChange={(value) => flag.mutate({ rarelyWorn: value })}
              last
              testID="garment-rarely"
            />
          </Card>
        ) : null}

        <View style={styles.footer}>
          {item.status === 'ready' ? (
            <Button label="Style this" onPress={() => router.push({ pathname: '/occasion', params: { base: id } })} testID="garment-match" />
          ) : null}
          <FormError message={flag.isError ? messageFor(flag.error) : remove.isError ? messageFor(remove.error) : null} />
          <Button label="Delete item" kind="dangerText" busy={remove.isPending} onPress={confirmRemoval} testID="garment-delete" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
  // The 24 icon sits in a 44 target; pulling it out by 10 lines the icon up with the content edge.
  describing: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -10 },
  title: { gap: space[1] },
  loading: { gap: space[3] },
  problem: { gap: space[3] },
  failed: { gap: space[2] },
  failedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingTop: space[1] },
  footer: { gap: space[1] },
});
