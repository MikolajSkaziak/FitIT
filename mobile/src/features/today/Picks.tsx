import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { BoardView } from '@/components/BoardView';
import { CareLabel } from '@/components/CareLabel';
import { GarmentImage } from '@/components/garments';
import { BackdropIcon } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Fade, PressScale, StepBack } from '@/components/motion';
import { boardAspect, inReadingOrder } from '@/features/styling/board';
import { radius, size, space, travel, typography } from '@/theme';

import { carouselIndex, firstSentence, pickName, pickTag, picksLine } from './copy';

/** The card of the design on a 393 wide phone; narrower phones get a narrower card, so the next one still peeks in. */
const cardWidthAt = (screen: number): number => Math.min(292, screen - size.gutter - space[16]);

function useSizes() {
  const { width } = useWindowDimensions();
  const card = cardWidthAt(width);
  return {
    card,
    height: Math.round(card / boardAspect),
    piece: (width - 2 * size.gutter - 2 * space[2]) / 3,
  };
}

interface PicksHeadProps {
  /** "1 / 3": where the card in front stands among the picks. Left out while there are no cards. */
  counter?: string;
  /** What belongs at the end of the line: the button that asks for new outfits. */
  children?: ReactNode;
}

/** The line over the cards: "Today's looks" on the left, the count and the way to a fresh set on the right. */
export function PicksHead({ counter, children }: PicksHeadProps) {
  return (
    <View style={styles.head}>
      <AppText variant="eyebrow" accessibilityRole="header">
        Today’s looks
      </AppText>
      <View style={styles.headEnd}>
        {counter ? (
          <AppText variant="eyebrow" tabular testID="today-picks-count">
            {counter}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

interface PicksCarouselProps {
  outfits: readonly Outfit[];
  /** The line over the cards, given the count of the card in front. */
  head: (counter: string) => ReactNode;
  /** Opens the outfit's own page, where it can be worn, tried on and kept. */
  onOpen: (outfit: Outfit) => void;
}

/**
 * Today's picks side by side, each laid out on its board on the well with a care label. The row scrolls and snaps
 * natively; the card in front is at full strength, the others step back. Under the row: what the card in front is
 * called, why, and what it is made of.
 */
export function PicksCarousel({ outfits, head, onOpen }: PicksCarouselProps) {
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
      {head(`${front + 1} / ${outfits.length}`)}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        accessibilityLabel={picksLine(outfits.length)}
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
              style={styles.card}
              testID={`today-pick-${outfit.id}`}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <BoardView items={outfit.items} width={sizes.card} layout={outfit.layout} testID={`today-board-${outfit.id}`} />
              </View>
              <CareLabel label={pickTag(outfit, position)} corner="topLeft" />
            </PressScale>
          </StepBack>
        ))}
      </ScrollView>

      <View style={styles.words} accessibilityLiveRegion="polite">
        <AppText variant="heading" numberOfLines={1} testID="today-pick-name">
          {pickName(current, front)}
        </AppText>
        <AppText variant="secondary" color="textSecondary" numberOfLines={2} style={styles.reason} testID="today-pick-reason">
          {firstSentence(current.reasoning)}
        </AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.pieces} testID="today-pieces">
        {inReadingOrder(current.items).map(({ clothing }) => (
          <View key={clothing.id} accessible accessibilityLabel={clothing.name ?? 'Item without details'} style={[styles.piece, { width: sizes.piece }]}>
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
        <Skeleton width={sizes.card} height={sizes.height} radius={radius.well} />
        <Skeleton width={sizes.card} height={sizes.height} radius={radius.well} />
      </View>
      <View style={styles.words}>
        <Skeleton height={30} width="50%" />
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
  head: { minHeight: size.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  headEnd: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  // The rows run from edge to edge of the screen, past the gutter the page keeps.
  bleed: { marginHorizontal: -size.gutter },
  cards: { paddingHorizontal: size.gutter, gap: space[3] },
  row: { flexDirection: 'row', gap: space[2], overflow: 'hidden' },
  card: { borderRadius: radius.well, overflow: 'hidden' },
  words: { gap: space[1] },
  // Two lines kept whatever the sentence, so the page does not jump from card to card.
  reason: { minHeight: 2 * typography.secondary.lineHeight },
  lines: { gap: space[2], justifyContent: 'center' },
  pieces: { paddingHorizontal: size.gutter, gap: space[2] },
  piece: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  thumb: { width: 40 },
  pieceName: { flex: 1 },
});
