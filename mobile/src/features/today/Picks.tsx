import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FigureView } from '@/components/FigureView';
import { GarmentImage } from '@/components/garments';
import { BackdropIcon } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Fade, PressScale, StepBack, ToggleFade } from '@/components/motion';
import { inReadingOrder } from '@/features/styling/collage';
import { figureAspect } from '@/features/styling/figure';
import { radius, size, space, travel, typography, useTheme } from '@/theme';

import { carouselIndex, firstSentence, pickName, pickTag } from './copy';

/** The card of the mock-up on a 390 wide phone; narrower phones get a narrower card, so the next one still peeks in. */
const cardWidthAt = (screen: number): number => Math.min(262, screen - 2 * size.gutter - space[16]);

/** Room above the figure, so its head clears the two labels. */
const headroom = 18;

function useSizes() {
  const { width } = useWindowDimensions();
  const card = cardWidthAt(width);
  return {
    card,
    height: Math.round(card / figureAspect) + headroom,
    piece: (width - 2 * size.gutter - 2 * space[2]) / 3,
  };
}

interface PicksCarouselProps {
  outfits: readonly Outfit[];
  /** Opens the outfit's own page, where it can be worn, tried on and kept. */
  onOpen: (outfit: Outfit) => void;
}

/**
 * Today's picks side by side, each worn on the person's figure. The row scrolls and snaps natively; the card in front
 * has the green border, the others step back. Under the row: what the card in front is, why, and what it is made of.
 */
export function PicksCarousel({ outfits, onOpen }: PicksCarouselProps) {
  const theme = useTheme();
  const sizes = useSizes();
  const [index, setIndex] = useState(0);
  const front = Math.min(index, outfits.length - 1);
  const current = outfits[front];
  if (!current) {
    return null;
  }

  const step = sizes.card + space[3];
  return (
    <Fade rise={travel.rise} style={styles.picks}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) =>
          setIndex(carouselIndex(contentOffset.x, step, outfits.length, contentSize.width - layoutMeasurement.width))
        }
        style={styles.bleed}
        contentContainerStyle={styles.cards}
        testID="today-picks">
        {outfits.map((outfit, position) => (
          <StepBack key={outfit.id} on={position === front}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`${pickName(outfit, position)}, ${position + 1} of ${outfits.length}`}
              accessibilityHint="Opens the outfit"
              onPress={() => onOpen(outfit)}
              style={[styles.card, { width: sizes.card, height: sizes.height, backgroundColor: theme.well }]}
              testID={`today-pick-${outfit.id}`}>
              <View style={styles.figure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <FigureView items={outfit.items} width={sizes.card} testID={`today-figure-${outfit.id}`} />
              </View>
              <View style={[styles.label, styles.tag, { backgroundColor: theme.wellChip }]}>
                <AppText variant="metaStrong" color="onWellChip" numberOfLines={1}>
                  {pickTag(outfit, position)}
                </AppText>
              </View>
              <View style={[styles.label, styles.count, { backgroundColor: theme.wellBadge }]}>
                <AppText variant="metaStrong" color="onWellBadge" tabular>
                  {position + 1} of {outfits.length}
                </AppText>
              </View>
              <ToggleFade on={position === front} style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} />
            </PressScale>
          </StepBack>
        ))}
      </ScrollView>

      <View style={styles.about}>
        <View style={styles.words} accessibilityLiveRegion="polite">
          <AppText variant="subheading" numberOfLines={1} testID="today-pick-name">
            {pickName(current, front)}
          </AppText>
          <AppText color="textSecondary" numberOfLines={2} style={styles.reason} testID="today-pick-reason">
            {firstSentence(current.reasoning)}
          </AppText>
        </View>
        {outfits.length > 1 ? (
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {outfits.map((outfit, position) => (
              <View key={outfit.id} style={[styles.dot, position === front ? styles.dotOn : null, { backgroundColor: position === front ? theme.action : theme.dot }]} />
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.pieces} testID="today-pieces">
        {inReadingOrder(current.items).map(({ clothing }) => (
          <View
            key={clothing.id}
            accessible
            accessibilityLabel={clothing.name ?? 'Item without details'}
            style={[styles.piece, { width: sizes.piece, backgroundColor: theme.surface, borderColor: theme.border }]}>
            <GarmentImage url={clothing.imageUrl} cacheKey={clothing.imageKey} height={40} inset={space[1]} corner={radius.thumb} style={styles.thumb} />
            <AppText variant="metaStrong" numberOfLines={2} style={styles.pieceName}>
              {clothing.name ?? 'Item'}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </Fade>
  );
}

/** The picks as they will look while the stylist is at work: the same cards, the same lines, nothing to press. */
export function PicksSkeleton() {
  const sizes = useSizes();
  return (
    <View style={styles.picks} accessibilityRole="progressbar" accessibilityLabel="Picking today’s outfits" testID="today-picks-loading">
      <View style={[styles.bleed, styles.cards, styles.row]}>
        <Skeleton width={sizes.card} height={sizes.height} radius={radius.card} />
        <Skeleton width={sizes.card} height={sizes.height} radius={radius.card} />
      </View>
      <View style={styles.words}>
        <Skeleton height={20} width="50%" />
        <View style={[styles.reason, styles.lines]}>
          <Skeleton height={16} />
          <Skeleton height={16} width="70%" />
        </View>
      </View>
      <View style={styles.row}>
        {['a', 'b', 'c'].map((key) => (
          <Skeleton key={key} width={sizes.piece} height={54} radius={radius.well} />
        ))}
      </View>
    </View>
  );
}

interface PicksEmptyProps {
  title: string;
  text: string;
  onAdd: () => void;
}

/** Nothing to dress the person from, or not enough for this weather and occasion: what is missing and the one step that helps. */
export function PicksEmpty({ title, text, onAdd }: PicksEmptyProps) {
  return (
    <Fade rise={travel.rise} style={styles.empty} testID="today-empty">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <BackdropIcon name="sun" size={96} />
      </View>
      <View style={styles.emptyWords}>
        <AppText variant="heading" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText color="textSecondary" align="center">
          {text}
        </AppText>
      </View>
      <Button label="Add clothes" icon="plus" inline onPress={onAdd} testID="today-add" />
    </Fade>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space[4], paddingVertical: space[6] },
  emptyWords: { gap: space[2] },
  picks: { gap: 14 },
  // The rows run from edge to edge of the screen, past the gutter the page keeps.
  bleed: { marginHorizontal: -size.gutter },
  cards: { paddingHorizontal: size.gutter, gap: space[3] },
  row: { flexDirection: 'row', gap: space[2], overflow: 'hidden' },
  card: { borderRadius: radius.card, overflow: 'hidden' },
  figure: { marginTop: headroom },
  ring: { borderWidth: 2, borderRadius: radius.card },
  label: { position: 'absolute', top: space[3], paddingVertical: space[1], paddingHorizontal: 10, borderRadius: radius.pill },
  tag: { left: space[3] },
  count: { right: space[3] },
  about: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  words: { flex: 1, gap: 2 },
  // Two lines kept whatever the sentence, so the page does not jump from card to card.
  reason: { minHeight: 2 * typography.body.lineHeight },
  lines: { gap: space[2], justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, paddingTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  pieces: { paddingHorizontal: size.gutter, gap: space[2] },
  piece: { flexDirection: 'row', alignItems: 'center', gap: space[2], borderWidth: 1, borderRadius: radius.well, paddingVertical: 6, paddingLeft: 6, paddingRight: space[2] },
  thumb: { width: 40 },
  pieceName: { flex: 1 },
});
