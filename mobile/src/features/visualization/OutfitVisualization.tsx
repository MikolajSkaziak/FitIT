import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Outfit, OutfitItem, OutfitPlacement } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { BoardView } from '@/components/BoardView';
import { Button } from '@/components/Button';
import { Fade, PressScale } from '@/components/motion';
import { TextTabs } from '@/components/TextTabs';
import { useAiConsent } from '@/features/consent/session';
import { boardAspect } from '@/features/styling/board';
import { figureFor } from '@/features/styling/figure';
import { motion, radius, size, space, useTheme } from '@/theme';

import { boardView, enlargeAction, figureView, pictureCaption, pictureLabel, showAction, tryOnView, viewLabel, waitingCaption } from './copy';
import { CurtainFrame, useFittingRoom, type FittingRoom } from './FittingRoom';
import { ImageViewer } from './ImageViewer';
import { ReportLink } from './ReportLink';
import type { Picture } from './order';
import { useVisualization } from './useVisualization';

type Side = 'board' | 'figure' | 'tryOn';

/** The picture and the board share the 3:4 frame of the silhouettes (spec 7.3). */
const pictureShare = 0.7;

/** How wide the board and the picture are drawn on a well `width` wide. */
export const stageWidth = (width: number): number => Math.round(width * pictureShare);

const frameOf = (width: number, share: number) => {
  const pictureWidth = Math.round(width * share);
  return { width: pictureWidth, height: Math.round((pictureWidth * 4) / 3) };
};

/** An outfit still being put together: its garments, and how to store it once a picture of it is ordered (answers with its id). */
export interface OutfitDraft {
  items: readonly OutfitItem[];
  prepare: () => Promise<string>;
  /** How the person arranged the board so far, if they did. */
  layout?: readonly OutfitPlacement[] | null;
  /** The same for the garments on the figure. */
  figureLayout?: readonly OutfitPlacement[] | null;
}

/**
 * The views of one outfit and the order of its picture. Kept apart from the picture itself, so a screen can put the
 * "Try it on" button where its own design wants it, beside "Wear this".
 */
export function useOutfitViewer(outfit: Outfit | undefined, draft: OutfitDraft | undefined) {
  const picture = useVisualization(outfit ?? null, draft?.prepare);
  // The fitting room is kept here, not in the Try-on view, so the wait goes on while the Board is shown.
  const room = useFittingRoom(picture.stage);
  // An outfit that already has a picture opens on it; everything else opens on the board. Until the person picks a view,
  // that is the one shown.
  const [picked, setSide] = useState<Side | null>(null);
  const side: Side = picked ?? (outfit ? (visualizationOf(outfit) ? 'tryOn' : 'board') : 'board');
  const order = () => {
    setSide('tryOn');
    picture.start();
  };
  return { picture, room, side, setSide, order };
}

export type OutfitViewer = ReturnType<typeof useOutfitViewer>;

interface TryOnButtonProps {
  viewer: OutfitViewer;
  /** Takes the width of its words, to sit beside another button. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** "Try it on" while nothing was ordered; the way to try again when the order did not come out; nothing otherwise. */
export function TryOnButton({ viewer, inline, style }: TryOnButtonProps) {
  const { picture } = viewer;
  const askConsent = useAiConsent();
  if (picture.stage === 'none') {
    return <Button label={showAction} kind="secondary" icon="sparkle" inline={inline} disabled={picture.usedUp} onPress={viewer.order} style={style} testID="visualization-show" />;
  }

  const notice = picture.notice;
  // "We need your OK": the way forward is the consent sheet, and the order goes again only once it was allowed.
  const retry = notice?.consent ? async () => ((await askConsent('clothes', { force: true })) ? picture.start() : undefined) : picture.start;
  return notice?.action ? (
    <Button label={notice.action} kind="secondary" inline={inline} disabled={picture.usedUp} onPress={() => void retry()} style={style} testID="visualization-retry" />
  ) : null;
}

interface Hero {
  /** Room above the picture, for the buttons laid over the top of the hero. */
  top: number;
  /** Laid over the hero: the round back button and its neighbours. Place them with `position: 'absolute'`. */
  overlay?: ReactNode;
}

interface OutfitVisualizationProps {
  viewer: OutfitViewer;
  /** A stored outfit, or with `draft` none yet. */
  outfit?: Outfit;
  draft?: OutfitDraft;
  /** With `hero`, the width of the screen. Without, the width of the content column the well is laid out inside. */
  width: number;
  /** The picture stands on a full-width well at the top of the screen, under the buttons laid over it, and bleeds past the gutter. */
  hero?: Hero;
  /**
   * Given, the board can be arranged by hand: called with the arrangement the person kept, or null when they went back to
   * the automatic one. Left out, the board only shows.
   */
  onArrange?: (layout: OutfitPlacement[] | null) => void | Promise<unknown>;
  /** The same for the garments on the figure, which are arranged apart from the board. */
  onArrangeFigure?: (layout: OutfitPlacement[] | null) => void | Promise<unknown>;
  /** Laid at the trailing edge of the row of tabs under the picture, centred with them (the bookmark). The row is there for it even when there are no tabs. */
  trailing?: ReactNode;
  testID?: string;
}

/**
 * An outfit's views: on a board (the garments laid out flat), on a figure (the same garments where they are worn, over
 * the person's silhouette), both drawn on the phone, instantly; and the generated picture of it once one was ordered.
 * The views are text tabs under the picture.
 */
export function OutfitVisualization({ viewer, outfit, draft, width, hero, onArrange, onArrangeFigure, trailing, testID }: OutfitVisualizationProps) {
  const theme = useTheme();
  const avatar = useSession((session) => session.user?.avatar);
  const { picture, room, side, setSide } = viewer;
  const ordered = picture.stage !== 'none';
  const shown: Side = side === 'tryOn' && !ordered ? 'board' : side;
  const view = shown !== 'tryOn' ? 'board' : picture.stage === 'ready' && picture.picture ? 'ready' : picture.notice ? 'problem' : 'working';
  // While the curtain still hangs over a picture that has come, the words under it are those of the wait.
  const drawing = view === 'working' || (view === 'ready' && room.curtain);
  const pictureWidth = stageWidth(width);
  const frame = frameOf(pictureWidth, 1);
  const boardHeight = Math.round(pictureWidth / boardAspect);

  // Whichever view is shown changes by a cross-fade, not a snap. The wait, the reveal and the picture are one view: the
  // curtain is drawn aside on the picture where it stands.
  const stage = (
    <Fade key={shown} exit duration={motion.enter} style={styles.stage}>
      {shown === 'board' ? (
        <BoardView
          items={outfit?.items ?? draft?.items ?? []}
          width={pictureWidth}
          layout={outfit ? outfit.layout : draft?.layout}
          onArrange={onArrange}
          testID={outfit ? `board-${outfit.id}` : 'board-draft'}
        />
      ) : shown === 'figure' ? (
        <BoardView
          items={outfit?.items ?? draft?.items ?? []}
          width={pictureWidth}
          layout={outfit ? outfit.figureLayout : draft?.figureLayout}
          onArrange={onArrangeFigure}
          figure={{ url: avatar?.figureUrl ?? null, shape: figureFor(avatar?.bodyType) }}
          testID={outfit ? `figure-${outfit.id}` : 'figure-draft'}
        />
      ) : (
        <View style={[frame, styles.picture, { backgroundColor: theme.well }]}>
          <CurtainFrame room={room} width={frame.width} notice={picture.notice}>
            {picture.stage === 'ready' && picture.picture ? <ReadyPicture picture={picture.picture} room={room} /> : null}
          </CurtainFrame>
        </View>
      )}
    </Fade>
  );

  return (
    <View style={styles.block} testID={testID}>
      {/* The picture stands on a well, as tall as the board whichever view is on it, so the tabs under it stay put. A hero runs to both edges of the screen. */}
      {hero ? (
        <View style={[styles.well, styles.hero, { backgroundColor: theme.well, paddingTop: hero.top, minHeight: hero.top + boardHeight + space[4] }]}>
          {stage}
          {hero.overlay}
        </View>
      ) : (
        <View style={[styles.well, styles.column, { backgroundColor: theme.well, minHeight: boardHeight + 2 * space[4] }]}>{stage}</View>
      )}
      {/* The try-on tab appears with its picture: until one is ordered, the way to it is the "Try it on" button. */}
      <View style={styles.tabsRow} testID="visualization-tabs-row">
        <View style={styles.tabs}>
          <TextTabs<Side>
            label={viewLabel}
            tabs
            layout="row"
            value={shown}
            onChange={setSide}
            options={[
              { value: 'board', label: boardView, icon: 'board' },
              { value: 'figure', label: figureView, icon: 'person' },
              ...(ordered ? [{ value: 'tryOn' as const, label: tryOnView, icon: 'sparkle' as const }] : []),
            ]}
          />
        </View>
        {trailing}
      </View>
      {drawing ? (
        <AppText variant="secondary" color="textSecondary">
          {waitingCaption}
        </AppText>
      ) : view === 'ready' ? (
        <>
          <AppText variant="secondary" color="textSecondary">
            {pictureCaption}
          </AppText>
          {picture.picture?.id ? <ReportLink pictureId={picture.picture.id} /> : null}
        </>
      ) : null}
      {picture.leftLine && picture.stage !== 'ready' ? (
        <AppText variant="caption" color="textSecondary" tabular testID="visualization-left">
          {picture.leftLine}
        </AppText>
      ) : null}
    </View>
  );
}

/** The finished picture, openable larger. It fills the frame; while the curtain hangs over it, it takes no touch. */
function ReadyPicture({ picture, room }: { picture: Picture; room: FittingRoom }) {
  const theme = useTheme();
  const [large, setLarge] = useState(false);
  return (
    <>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${pictureLabel}. ${enlargeAction}`}
        onPress={() => setLarge(true)}
        pointerEvents={room.curtain ? 'none' : 'auto'}
        testID="visualization-picture"
        style={[styles.fill, { backgroundColor: theme.well }]}>
        <Image
          source={{ uri: picture.url, cacheKey: picture.cacheKey ?? undefined }}
          contentFit="cover"
          transition={motion.enter}
          onLoad={room.onLoad}
          onError={room.onLoad}
          style={styles.fill}
          accessible={false}
          testID="visualization-image"
        />
      </PressScale>
      <ImageViewer picture={picture} visible={large} onClose={() => setLarge(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[3] },
  well: { alignItems: 'center', justifyContent: 'center' },
  stage: { alignSelf: 'stretch', alignItems: 'center' },
  // Out past the gutter of the screen it stands on, to both edges.
  hero: { marginHorizontal: -size.gutter, paddingBottom: space[4] },
  column: { borderRadius: radius.well, paddingVertical: space[4], overflow: 'hidden' },
  picture: { borderRadius: radius.well, overflow: 'hidden' },
  fill: { flex: 1 },
  tabsRow: { flexDirection: 'row', alignItems: 'center' },
  tabs: { flex: 1 },
});
