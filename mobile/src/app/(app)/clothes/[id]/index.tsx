import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteClothing, fetchClothing, reprocessClothing, updateClothing, wardrobeKeys, type Clothing, type ClothingChange, type ClothingPhoto } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CareLabel } from '@/components/CareLabel';
import { IconButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Icon, type IconName } from '@/components/Icon';
import { FormError } from '@/components/forms';
import { GarmentImage } from '@/components/garments';
import { Hairline } from '@/components/Hairline';
import { Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { styleLabel } from '@/copy/labels';
import { ImageViewer } from '@/features/visualization/ImageViewer';
import { AiNote } from '@/features/wardrobe/AiNote';
import { MorePhotos, morePhotos } from '@/features/wardrobe/MorePhotos';
import { kindLine, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { formatCalendarDay, formatDay, fromIso } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { capitalized, plural } from '@/lib/plural';
import { motion, size, space, useTheme } from '@/theme';

/** The photo's well, from the top edge of the screen: 440 on a phone whose status bar is 54 high. */
const heroBelowStatusBar = 386;

export default function GarmentDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  /** Which page of the hero is in front: 0 is the main picture, the extra photos follow. */
  const [page, setPage] = useState(0);
  /** The extra photo that is open full screen. */
  const [viewing, setViewing] = useState<ClothingPhoto | null>(null);
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
              <Skeleton height={heroBelowStatusBar} />
              <Skeleton height={40} width="70%" />
              <Skeleton height={16} width="40%" />
            </View>
          )}
        </View>
      </Screen>
    );
  }

  const name = item.name ?? 'Unnamed item';
  const kind = kindLine(dictionaries.data, item);
  const lastWorn = item.lastWornOn ? fromIso(item.lastWornOn) : null;
  const edit = () => router.push({ pathname: '/clothes/[id]/edit', params: { id } });
  const scale = (entries: readonly { value: number; label: string }[] | undefined, value: number | null) =>
    value === null ? undefined : (entries?.find((entry) => entry.value === value)?.label ?? String(value));
  const labelOf = <T extends { code: string; label: string }>(entries: readonly T[] | undefined, code: string | null) =>
    code === null ? undefined : (entries?.find((entry) => entry.code === code)?.label ?? code);
  // What there is to know about the piece, as plain words: the colors, the cloth, how formal and warm, when it suits.
  const facts = [
    ...item.colors.map((color) => labelOf(dictionaries.data?.colors, color)),
    item.pattern && item.pattern !== 'plain' ? labelOf(dictionaries.data?.patterns, item.pattern) : undefined,
    labelOf(dictionaries.data?.materials, item.material),
    scale(dictionaries.data?.formality, item.formality),
    scale(dictionaries.data?.warmth, item.warmth),
    ...item.seasons.map((season) => labelOf(dictionaries.data?.seasons, season)),
    ...item.styles.map((style) => styleLabel(style)),
    item.rainOk ? 'Good in rain' : undefined,
  ].filter((fact): fact is string => Boolean(fact));

  // The main picture is photo 1 of the garment; the extra ones follow in the order they were added.
  const photoCount = 1 + item.photos.length;
  const heroHeight = heroBelowStatusBar + insets.top;
  const hero = (
    <GarmentImage
      url={item.imageUrl}
      cacheKey={item.imageKey}
      height={heroHeight}
      inset={size.gutter}
      corner={0}
      label={photoCount > 1 ? morePhotos.label(1, photoCount, name) : name}
      style={[photoCount > 1 ? { width } : null, { paddingTop: insets.top + space[6] }]}
    />
  );
  const viewed = viewing ? item.photos.findIndex((photo) => photo.id === viewing.id) : -1;

  const confirmRemoval = () =>
    Alert.alert(`Delete “${name}”?`, 'We’ll delete this item and its photos. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete item',
        style: 'destructive',
        onPress: () => {
          haptics.destroy();
          remove.mutate();
        },
      },
    ]);

  return (
    <Screen
      testID="garment-screen"
      contentStyle={styles.screen}
      footer={
        <>
          {item.status === 'ready' ? <Button label="Style this" icon="sparkle" onPress={() => router.push({ pathname: '/occasion', params: { base: id } })} testID="garment-match" /> : null}
          <FormError message={flag.isError ? messageFor(flag.error) : remove.isError ? messageFor(remove.error) : null} />
          {item.status !== 'processing' ? <Button label="Remove from wardrobe" kind="dangerText" busy={remove.isPending} onPress={confirmRemoval} testID="garment-delete" /> : null}
        </>
      }>
      <View>
        {photoCount > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={({ nativeEvent }) => setPage(Math.max(0, Math.min(photoCount - 1, Math.round(nativeEvent.contentOffset.x / width))))}
            testID="garment-photos">
            {hero}
            {item.photos.map((photo, at) => (
              // Kept as it was taken, so it fills the frame edge to edge where the cut-out stands on its well.
              <Pressable
                key={photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={morePhotos.label(at + 2, photoCount, name)}
                onPress={() => {
                  haptics.press('nav');
                  setViewing(photo);
                }}
                style={{ width, height: heroHeight, backgroundColor: theme.well }}
                testID={`garment-photo-${at + 2}`}>
                <Image source={{ uri: photo.imageUrl, cacheKey: photo.imageKey }} contentFit="cover" transition={motion.exit} accessible={false} style={StyleSheet.absoluteFill} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          hero
        )}
        {photoCount > 1 ? (
          // Each page says which photo it is; the label is the same thing for the eye.
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
            <CareLabel corner="bottomLeft" label={morePhotos.counter(Math.min(page, photoCount - 1) + 1, photoCount)} testID="garment-photo-count" />
          </View>
        ) : null}
        {/* Over the photo, not inside it: the photo is one image to a screen reader, and the buttons are not part of it. */}
        <IconButton icon="back" label="Back" onPress={() => router.back()} style={[styles.overPhoto, { top: insets.top + space[2], left: size.gutter }]} />
        {item.status === 'ready' ? <IconButton icon="edit" label="Edit details" onPress={edit} style={[styles.overPhoto, { top: insets.top + space[2], right: size.gutter }]} testID="garment-edit" /> : null}
      </View>

      <View style={styles.body}>
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
            {kind ? <AppText variant="eyebrow">{kind}</AppText> : null}
            <AppText variant="display" accessibilityRole="header" testID="garment-name">
              {name}
            </AppText>
          </View>
        )}

        {item.status === 'ready' && facts.length > 0 ? (
          <View style={styles.facts}>
            {facts.map((fact, at) => (
              <AppText key={`${fact}-${at}`} variant="secondary" color="textSecondary">
                {capitalized(fact)}
              </AppText>
            ))}
          </View>
        ) : null}

        {item.status === 'ready' && item.describedByAi ? <AiNote testID="garment-ai-note" /> : null}

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

        {item.status !== 'processing' ? (
          <View style={styles.stats}>
            <Stat icon="hanger" label="Worn" value={`${item.wearCount} ${plural(item.wearCount, ['time', 'times'])}`} />
            <Stat icon="clock" label="Last worn" value={lastWorn ? formatCalendarDay(lastWorn) : 'Not yet'} />
            <Stat icon="calendar" label="Added" value={formatDay(new Date(item.createdAt))} />
          </View>
        ) : null}

        {/* Not while the photo is still being looked at: it may yet turn out not to be a garment. */}
        {item.status === 'ready' || item.status === 'failed' ? <MorePhotos garment={item} name={name} onOpen={setViewing} /> : null}

        {item.status !== 'processing' ? (
          <View>
            <Hairline />
            <ToggleRow
              icon="drop"
              label="In the laundry"
              meta="We’ll leave it out of today’s looks"
              value={item.inLaundry}
              onChange={(value) => flag.mutate({ inLaundry: value })}
              testID="garment-laundry"
            />
            <ToggleRow
              icon="sparkle"
              label="Rarely worn"
              meta="We’ll suggest it more often, as a Discovery."
              value={item.rarelyWorn}
              onChange={(value) => flag.mutate({ rarelyWorn: value })}
              testID="garment-rarely"
            />
          </View>
        ) : null}
      </View>
      {viewing && viewed >= 0 ? (
        <ImageViewer
          picture={{ url: viewing.imageUrl, cacheKey: viewing.imageKey }}
          visible
          onClose={() => setViewing(null)}
          label={morePhotos.label(viewed + 2, photoCount, name)}
        />
      ) : null}
    </Screen>
  );
}

/** One fact about the piece in a row of three: a small label with its icon over the value. */
function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Eyebrow icon={icon} iconSize={12}>
        {label}
      </Eyebrow>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
  // The photo runs to the edges and under the status bar, so this screen has no gutter or top padding of its own; `body` brings the gutter back.
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  body: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[6] },
  overPhoto: { position: 'absolute' },
  describing: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { gap: 6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 6 },
  stats: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  stat: { flex: 1, gap: space[1] },
  loading: { gap: space[3] },
  problem: { gap: space[3] },
  failed: { gap: space[2] },
  failedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingTop: space[1] },
});
