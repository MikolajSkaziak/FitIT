import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Outfit } from '@/api/outfits';
import { visualizationOf } from '@/api/visualizations';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/controls';
import { radius, size, space, useTheme } from '@/theme';

import { collageView, enlargeAction, pictureCaption, pictureLabel, showAction, silhouetteView, viewLabel, working, type Notice } from './copy';
import { ImageViewer } from './ImageViewer';
import type { Picture } from './order';
import { useVisualization } from './useVisualization';

type Side = 'collage' | 'silhouette';

/** The picture keeps the 3:4 frame of the silhouettes (spec 7.3) and leaves the collage the wider shape. */
const pictureShare = 0.7;

const frameOf = (width: number, share: number) => {
  const pictureWidth = Math.round(width * share);
  return { width: pictureWidth, height: Math.round((pictureWidth * 4) / 3) };
};

interface OutfitVisualizationProps {
  outfit: Outfit;
  /** Width of the content column the picture is laid out inside. */
  width: number;
  /** The outfit as a grid of garment photos, as the screen around it lays it out. */
  collage: ReactNode;
  testID?: string;
}

/**
 * An outfit's two views: the collage of real photos, and the picture of it on the chosen silhouette. The collage is
 * the faithful one, so it stays one press away and is never replaced (spec 7.1).
 */
export function OutfitVisualization({ outfit, width, collage, testID }: OutfitVisualizationProps) {
  const picture = useVisualization(outfit);
  // An outfit that already has a picture opens on it; one without opens on the collage it does have.
  const [side, setSide] = useState<Side>(() => (visualizationOf(outfit) ? 'silhouette' : 'collage'));

  const order = () => {
    setSide('silhouette');
    picture.start();
  };

  const ordered = picture.stage !== 'none';
  return (
    <View style={styles.block} testID={testID}>
      {ordered ? (
        <Segmented
          label={viewLabel}
          value={side}
          onChange={setSide}
          options={[
            { value: 'collage', label: collageView },
            { value: 'silhouette', label: silhouetteView },
          ]}
        />
      ) : null}
      {side === 'collage' || !ordered ? (
        collage
      ) : picture.stage === 'ready' && picture.picture ? (
        <ReadyPicture picture={picture.picture} frame={frameOf(width, pictureShare)} />
      ) : picture.notice ? (
        <Problem notice={picture.notice} />
      ) : (
        <Working progress={picture.progress} frame={frameOf(width, pictureShare * 0.6)} />
      )}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pictureLabel}. ${enlargeAction}`}
        onPress={() => setLarge(true)}
        testID="visualization-picture"
        style={({ pressed }) => [styles.picture, frame, { backgroundColor: theme.well }, pressed ? styles.pressed : null]}>
        <Image source={{ uri: picture.url, cacheKey: picture.cacheKey ?? undefined }} contentFit="cover" transition={200} style={styles.fill} accessible={false} />
      </Pressable>
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
      <View style={[styles.fillBar, { backgroundColor: theme.action, width: `${part * 100}%` }]} />
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
  fillBar: { height: size.bar, borderRadius: size.bar / 2 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
});
