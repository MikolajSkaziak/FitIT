import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Occasion } from '@/api/outfits';
import { fetchClothing, fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { GarmentImage } from '@/components/garments';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { OccasionPicker } from '@/features/styling/OccasionPicker';
import { proposalsRoute } from '@/features/styling/request';
import { radius, size, space } from '@/theme';

const thumbnail = 56;
/** What the sheet takes besides the scrolling part: grabber gap, header, both actions and the gaps between them. */
const chrome = 300;

/** The height of the keyboard while it is up, so the sheet can lift its content clear of it. */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setHeight(event.endCoordinates.height));
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

/** "Style this": the occasion for an outfit built around one garment, or a way to build it by hand. A sheet that fits its content. */
export default function ChooseOccasion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const { base } = useLocalSearchParams<{ base: string }>();
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const [note, setNote] = useState('');
  const garment = useQuery({ queryKey: wardrobeKeys.one(base), queryFn: () => fetchClothing(base), enabled: Boolean(base) });
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });
  const limitUsed = usage.data !== undefined && usage.data.suggestions.used >= usage.data.suggestions.limit;
  const startWith = useOutfitBuilder((state) => state.startWith);

  const build = () => {
    if (garment.data) {
      startWith(garment.data);
      router.replace('/builder');
    }
  };

  // The root stays a real native view that is not stretched, and the first thing in it is not a ScrollView: react-native-screens
  // fits the sheet to what is in the root, and resizes a ScrollView it finds first to the whole sheet. The scrolling part is capped
  // to the screen, so on a short phone, or with the keyboard up, the content scrolls instead of being clipped.
  const bodyMax = Math.max(160, window.height - insets.top - keyboard - chrome);
  const bottom = keyboard > 0 ? keyboard + space[2] : Math.max(insets.bottom, space[4]);

  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: bottom }]} testID="occasion-sheet">
      <View style={styles.head}>
        {garment.data ? (
          <View testID="occasion-garment">
            <GarmentImage url={garment.data.imageUrl} cacheKey={garment.data.imageKey} height={thumbnail} inset={6} corner={radius.thumb} style={styles.thumbnail} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <AppText variant="heading" accessibilityRole="header">
            {base ? 'Style this' : 'Create outfits'}
          </AppText>
          {garment.data?.name ? (
            <AppText variant="secondary" color="textSecondary" numberOfLines={2}>
              Outfits built around {garment.data.name}
            </AppText>
          ) : null}
        </View>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView
        style={{ maxHeight: bodyMax }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <OccasionPicker occasion={occasion} onOccasion={setOccasion} note={note} onNote={setNote} />
      </ScrollView>
      <View style={styles.actions}>
        {limitUsed ? (
          <AppText variant="secondary" color="textSecondary" align="center" testID="occasion-limit">
            {`You’ve used today’s ${usage.data?.suggestions.limit} suggestions. More tomorrow.`}
          </AppText>
        ) : null}
        <Button
          label="Suggest outfits"
          icon="sparkle"
          disabled={limitUsed}
          onPress={() => router.replace(proposalsRoute({ occasion, note, baseItemId: base }))}
          testID="occasion-suggest"
        />
        {base ? (
          <Button
            label="Build it myself"
            kind="secondary"
            icon="hanger"
            disabled={!garment.data?.category}
            accessibilityLabel="Build an outfit myself around this garment"
            onPress={build}
            testID="occasion-build"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  thumbnail: { width: thumbnail },
  titles: { flex: 1, gap: 2 },
  body: { paddingBottom: space[2] },
  actions: { gap: space[2] },
});
