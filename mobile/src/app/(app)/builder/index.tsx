import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { fetchClothes, noFilter, wardrobeKeys, type Category, type Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GarmentImage } from '@/components/garments';
import { BackHeader } from '@/components/headers';
import { Skeleton } from '@/components/lists';
import { Fade } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { builder, groupTitle } from '@/features/builder/copy';
import { GarmentChoice } from '@/features/builder/GarmentChoice';
import { minPieces, roleOrder } from '@/features/builder/selection';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { radius, size, space, travel } from '@/theme';

const thumbnail = 36;

/** "Build an outfit", step one: the ready garments by role, head to toe, and a bar below with what has been chosen. */
export default function Builder() {
  const router = useRouter();
  const items = useOutfitBuilder((state) => state.items);
  const note = useOutfitBuilder((state) => state.note);
  const toggle = useOutfitBuilder((state) => state.toggle);
  const clothes = useQuery({ queryKey: wardrobeKeys.list(noFilter), queryFn: ({ signal }) => fetchClothes(noFilter, signal) });

  const groups = useMemo(() => {
    const ready = (clothes.data ?? []).filter((item) => item.status === 'ready' && item.category);
    return roleOrder.map((role) => ({ role, garments: ready.filter((item) => item.category === role) })).filter((group) => group.garments.length > 0);
  }, [clothes.data]);
  const chosen = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const enough = items.length >= minPieces;

  const header = <BackHeader title={builder.title} meta={builder.lead} onBack={() => router.back()} />;

  if (clothes.isSuccess && groups.length === 0) {
    return (
      <Screen testID="builder-screen">
        <View style={styles.content}>
          {header}
          <EmptyState
            icon="hanger"
            title={builder.empty.title}
            text={builder.empty.text}
            action={{ label: builder.empty.action, onPress: () => router.replace('/add'), icon: 'camera', testID: 'builder-add' }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="builder-screen"
      footer={
        <View style={styles.bar} testID="builder-bar">
          {note ? (
            <Fade key={note} rise={travel.rise} exit>
              <AppText variant="secondary" color="textSecondary" testID="builder-note">
                {note}
              </AppText>
            </Fade>
          ) : null}
          <View style={styles.thumbnails}>
            {items.map((item) => (
              <GarmentImage key={item.id} url={item.imageUrl} cacheKey={item.imageKey} height={thumbnail} inset={3} corner={radius.thumb} label={item.name ?? 'Chosen piece'} style={styles.thumbnail} />
            ))}
            {enough ? null : (
              <AppText variant="secondary" color="textSecondary">
                {builder.hintFew}
              </AppText>
            )}
          </View>
          <Button label={builder.preview} disabled={!enough} onPress={() => router.push('/builder/preview')} testID="builder-preview" />
        </View>
      }>
      <View style={styles.content}>
        {header}
        {clothes.isError ? (
          <View style={styles.problem}>
            <AppText color="textSecondary">{messageFor(clothes.error)}</AppText>
            <Button label="Try again" kind="secondary" inline onPress={() => void clothes.refetch()} />
          </View>
        ) : clothes.isPending ? (
          <View style={styles.problem} accessibilityRole="progressbar" accessibilityLabel="Loading your clothes">
            <Skeleton height={20} width="40%" />
            <Skeleton height={140} radius={radius.well} />
          </View>
        ) : (
          groups.map((group) => <Group key={group.role} role={group.role} garments={group.garments} chosen={chosen} onToggle={toggle} />)
        )}
      </View>
    </Screen>
  );
}

interface GroupProps {
  role: Category;
  garments: Clothing[];
  chosen: ReadonlySet<string>;
  onToggle: (garment: Clothing) => void;
}

/** One role: its title and a row of its garments that scrolls sideways, out to the edges of the screen. */
function Group({ role, garments, chosen, onToggle }: GroupProps) {
  return (
    <View style={styles.group} testID={`builder-group-${role}`}>
      <AppText variant="subheading" accessibilityRole="header">
        {groupTitle[role]}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.tiles} keyboardShouldPersistTaps="handled">
        {garments.map((garment) => (
          <GarmentChoice key={garment.id} item={garment} selected={chosen.has(garment.id)} onPress={() => onToggle(garment)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  problem: { gap: space[3] },
  group: { gap: space[2] },
  // Out to the screen edges, so the row scrolls under the gutter; the first tile still starts on it.
  row: { marginHorizontal: -size.gutter },
  tiles: { paddingHorizontal: size.gutter, gap: space[2] },
  bar: { gap: space[2] },
  thumbnails: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: thumbnail },
  thumbnail: { width: thumbnail },
});
