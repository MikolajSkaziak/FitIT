import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OutfitItem } from '@/api/outfits';
import { fetchClothes, noFilter, wardrobeKeys, type Clothing, type Dictionaries } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { BoardView } from '@/components/BoardView';
import { CareLabel } from '@/components/CareLabel';
import { IconButton } from '@/components/controls';
import { EmptyState } from '@/components/EmptyState';
import { Eyebrow } from '@/components/Eyebrow';
import { TitleBlock } from '@/components/headers';
import { Skeleton } from '@/components/lists';
import { Fade } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { builder, groupTitle } from '@/features/builder/copy';
import { GarmentChoice } from '@/features/builder/GarmentChoice';
import { minPieces, pickerGroups, type PickerGroup } from '@/features/builder/selection';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { typeLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { plural } from '@/lib/plural';
import { radius, size, space, travel, useTheme } from '@/theme';

/** How wide the board lies on its well, as a share of the screen. */
const boardShare = 0.62;

/** "Build an outfit", step one: the board with what has been chosen, and the ready garments in the wardrobe's own groups. */
export default function Builder() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const items = useOutfitBuilder((state) => state.items);
  const note = useOutfitBuilder((state) => state.note);
  const layout = useOutfitBuilder((state) => state.layout);
  const toggle = useOutfitBuilder((state) => state.toggle);
  const dictionaries = useDictionaries().data;
  const clothes = useQuery({ queryKey: wardrobeKeys.list(noFilter), queryFn: ({ signal }) => fetchClothes(noFilter, signal) });

  const groups = useMemo(() => {
    const ready = (clothes.data ?? []).filter((item) => item.status === 'ready' && item.category);
    return pickerGroups(ready, dictionaries);
  }, [clothes.data, dictionaries]);
  const chosen = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const worn = useMemo<OutfitItem[]>(() => items.flatMap((clothing) => (clothing.category ? [{ slot: clothing.category, clothing }] : [])), [items]);
  const enough = items.length >= minPieces;
  const buttonTop = insets.top + space[2];

  if (clothes.isSuccess && groups.length === 0) {
    return (
      <Screen testID="builder-screen">
        <View style={styles.content}>
          <View style={styles.bar}>
            <IconButton icon="close" label="Close" onPress={() => router.back()} />
          </View>
          <TitleBlock title={builder.title} lead={builder.lead} />
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
      contentStyle={styles.screen}
      footer={
        <View style={styles.footer} testID="builder-bar">
          {note ? (
            <Fade key={note} rise={travel.rise} exit>
              <AppText variant="secondary" color="textSecondary" align="center" testID="builder-note">
                {note}
              </AppText>
            </Fade>
          ) : null}
          {enough ? null : (
            <AppText variant="caption" color="textSecondary" align="center">
              {builder.hintFew}
            </AppText>
          )}
          <Button label={builder.preview} disabled={!enough} onPress={() => router.push('/builder/preview')} testID="builder-preview" />
        </View>
      }>
      <View style={styles.content}>
        {/* The board shows the choice as it is made. The well runs to both edges of the screen, under the close button. */}
        <View style={[styles.hero, { backgroundColor: theme.well, paddingTop: buttonTop }]}>
          <BoardView items={worn} width={Math.round(width * boardShare)} layout={layout} testID="builder-board" />
          <IconButton icon="close" label="Close" onPress={() => router.back()} style={[styles.corner, { top: buttonTop, left: size.gutter }]} />
          <CareLabel label={worn.length === 0 ? 'No pieces yet' : `${worn.length} ${plural(worn.length, ['piece', 'pieces'])} · building`} corner="bottomLeft" />
        </View>
        <TitleBlock title={builder.title} lead={builder.lead} />
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
          groups.map((group) => <Group key={group.key} group={group} chosen={chosen} dictionaries={dictionaries} onToggle={toggle} />)
        )}
      </View>
    </Screen>
  );
}

interface GroupProps {
  group: PickerGroup;
  chosen: ReadonlySet<string>;
  dictionaries: Dictionaries | undefined;
  onToggle: (garment: Clothing) => void;
}

/** One kind of garment: its name and a row of its garments that scrolls sideways, out to the edges of the screen. */
function Group({ group, chosen, dictionaries, onToggle }: GroupProps) {
  const { garments } = group;
  return (
    <View style={styles.group} testID={`builder-group-${group.key}`}>
      <Eyebrow header>{group.title ?? (group.role ? groupTitle[group.role] : '')}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.tiles} keyboardShouldPersistTaps="handled">
        {garments.map((garment) => (
          <GarmentChoice key={garment.id} item={garment} selected={chosen.has(garment.id)} kind={typeLabel(dictionaries, garment.subcategory)} onPress={() => onToggle(garment)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The board's well runs to the top of the screen, under the status bar.
  screen: { paddingTop: 0 },
  content: { gap: space[6] },
  bar: { flexDirection: 'row' },
  hero: { marginHorizontal: -size.gutter, paddingBottom: space[6], alignItems: 'center' },
  corner: { position: 'absolute' },
  problem: { gap: space[3] },
  group: { gap: space[2] },
  // Out to the screen edges, so the row scrolls under the gutter; the first tile still starts on it.
  row: { marginHorizontal: -size.gutter },
  tiles: { paddingHorizontal: size.gutter, gap: space[3] },
  footer: { gap: space[2] },
});
