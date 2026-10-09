import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Outfit, OutfitItem } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/controls';
import { FigureView } from '@/components/FigureView';
import { Fade, PressScale, ProgressFill } from '@/components/motion';
import { motion, radius, size, space, useTheme } from '@/theme';

import { collageView, enlargeAction, figureView, pictureCaption, pictureLabel, showAction, tryOnView, viewLabel, working, type Notice } from './copy';
import { ImageViewer } from './ImageViewer';
import type { Picture } from './order';
import { useVisualization } from './useVisualization';

type Side = 'figure' | 'collage' | 'tryOn';

/** The picture keeps the 3:4 frame of the silhouettes (spec 7.3) and leaves the collage the wider shape. */
const pictureShare = 0.7;

const frameOf = (width: number, share: number) => {
  const pictureWidth = Math.round(width * share);
  return { width: pictureWidth, height: Math.round((pictureWidth * 4) / 3) };
};

/** An outfit still being put together: its garments, and how to store it once a picture of it is ordered (answers with its id). */
export interface OutfitDraft {
  items: readonly OutfitItem[];
  prepare: () => Promise<string>;
}

interface OutfitVisualizationProps {
  /** A stored outfit, or with `draft` none yet. */
  outfit?: Outfit;
  draft?: OutfitDraft;
  /** Width of the content column the picture is laid out inside. */
  width: number;
  /** The outfit as a grid of garment photos, as the screen around it lays it out. */
  collage: ReactNode;
  testID?: string;
}

/**
 * An outfit's three views: on a figure (drawn on the phone, instantly, and the way it opens), the collage of real
 * photos, and the picture of it on the chosen silhouette once one was ordered. The collage is the faithful one, so it
 * stays one press away and is never replaced (spec 7.1).
 */
export function OutfitVisualization({ outfit, draft, width, collage, testID }: OutfitVisualizationProps) {
  const picture = useVisualization(outfit ?? null, draft?.prepare);
  // An outfit that already has a picture opens on it; one without opens on the figure.
  const [side, setSide] = useState<Side>(() => (outfit && visualizationOf(outfit) ? 'tryOn' : 'figure'));

  const order = () => {
    setSide('tryOn');
    picture.start();
  };

  const ordered = picture.stage !== 'none';
  const shown: Side = side === 'tryOn' && !ordered ? 'figure' : side;
  const view = shown !== 'tryOn' ? shown : picture.stage === 'ready' && picture.picture ? 'ready' : picture.notice ? 'problem' : 'working';
  return (
    <View style={styles.block} testID={testID}>
      <Segmented<Side>
        label={viewLabel}
        value={shown}
        onChange={setSide}
        options={[
          { value: 'figure', label: figureView },
          { value: 'collage', label: collageView },
          ...(ordered ? [{ value: 'tryOn' as const, label: tryOnView }] : []),
        ]}
      />
      {/* Whichever view is shown changes by a cross-fade, not a snap. */}
      <Fade key={view} exit duration={motion.enter}>
        {shown === 'figure' ? (
          <FigureView items={outfit?.items ?? draft?.items ?? []} width={width} testID={outfit ? `figure-${outfit.id}` : 'figure-draft'} />
        ) : shown === 'collage' ? (
          collage
        ) : picture.stage === 'ready' && picture.picture ? (
          <ReadyPicture picture={picture.picture} frame={frameOf(width, pictureShare)} />
        ) : picture.notice ? (
          <Problem notice={picture.notice} />
        ) : (
          <Working progress={picture.progress} frame={frameOf(width, pictureShare * 0.6)} />
        )}
      </Fade>
      {picture.stage === 'none' ? (
        <Button
          label={showAction}
          kind="secondary"
          icon="user"
          disabled={picture.usedUp}
          onPress={order}
          testID="visualization-show"
        />
      ) : picture.notice?.action ? (
        <Button label={picture.notice.action} kind="secondary" disabled={picture.usedUp} onPress={picture.start} testID="visualization-retry" />
      ) : null}
      {picture.leftLine && picture.stage !== 'ready' ? (
        <AppText variant="meta" color="textSecondary" align="center" tabular testID="visualization-left">
          {picture.leftLine}
        </AppText>
      ) : null}
    </View>
  );
}

interface Frame {
  width: number;
  height: number;
}

/** The finished picture, said to be indicative, and openable larger. */
function ReadyPicture({ picture, frame }: { picture: Picture; frame: Frame }) {
  const theme = useTheme();
  const [large, setLarge] = useState(false);
  return (
    <View style={styles.result}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${pictureLabel}. ${enlargeAction}`}
        onPress={() => setLarge(true)}
        testID="visualization-picture"
        style={[styles.picture, frame, { backgroundColor: theme.well }]}>
        <Image source={{ uri: picture.url, cacheKey: picture.cacheKey ?? undefined }} contentFit="cover" transition={motion.enter} style={styles.fill} accessible={false} />
      </PressScale>
      <AppText variant="meta" color="textSecondary" align="center">
        {pictureCaption}
      </AppText>
      <ImageViewer picture={picture} visible={large} onClose={() => setLarge(false)} />
    </View>
  );
}

/** The wait, with the shape of what is coming and a bar that keeps moving: a picture takes well over a second. */
function Working({ progress, frame }: { progress: number; frame: Frame }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, styles.waiting, { backgroundColor: theme.sage }]} testID="visualization-working">
      <View style={[frame, styles.placeholder, { backgroundColor: theme.surface }]} />
      <View style={styles.words}>
        <AppText variant="subheading" color="onSage" align="center" accessibilityRole="text" accessibilityLiveRegion="polite">
          {working.title}
        </AppText>
        <AppText variant="secondary" align="center">
          {working.text}
        </AppText>
      </View>
      <Bar progress={progress} label={working.progressLabel} />
    </View>
  );
}

/** Blocked, failed, or an order the server would not take: what happened and what can be done about it. */
function Problem({ notice }: { notice: Notice }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.sage }]} accessibilityRole="alert" testID="visualization-problem">
      <AppText variant="label" color="onSage">
        {notice.title}
      </AppText>
      <AppText>{notice.text}</AppText>
    </View>
  );
}

/**
 * Its own bar rather than the shared one: the shared track is the border colour, which all but disappears on a sage
 * panel in either scheme.
 */
function Bar({ progress, label }: { progress: number; label: string }) {
  const theme = useTheme();
  const part = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(part * 100) }}
      style={[styles.track, { backgroundColor: theme.surface }]}>
      <ProgressFill progress={part} style={{ backgroundColor: theme.action }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[3] },
  result: { gap: space[2], alignItems: 'center' },
  picture: { borderRadius: radius.card, overflow: 'hidden' },
  fill: { flex: 1 },
  panel: { borderRadius: radius.card, padding: space[4], gap: space[2] },
  waiting: { paddingVertical: space[4] + space[1], gap: space[4], alignItems: 'center' },
  placeholder: { borderRadius: radius.well },
  words: { gap: space[1] },
  track: { width: '100%', height: size.bar, borderRadius: size.bar / 2, overflow: 'hidden' },
});
