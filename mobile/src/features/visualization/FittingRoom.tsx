import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { tryOnPictures } from '@/components/brand';
import { announce, Curtain, Fade, ProgressFill, ToggleFade, useEstimatedProgress, type Wait } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { motion, size, space, useTheme } from '@/theme';

import { fittingRoom, stageOf, type Notice } from './copy';
import { typicalWaitMs, type OrderStage } from './order';

/**
 * The wait for a try-on picture as a fitting room, and the reveal of the picture at the end of it.
 *
 * It lives with the viewer, not with the Try-on view, so that switching to the Board and back does not set the bar back, and a
 * reveal that was started is finished even when nobody is looking at it. A reveal is owed only to a picture that came out of a wait
 * seen here: an outfit that already had its picture shows it at once.
 */
export function useFittingRoom(stage: OrderStage) {
  const [owedBefore, setOwed] = useState(false);
  const [loadedBefore, setLoaded] = useState(false);
  const [last, setLast] = useState(stage);
  // What this render sees is worked out here as well as stored: a state set during render is only seen by the render after it, and the bar must not be told "done" for a moment in between.
  let owed = owedBefore;
  let loaded = loadedBefore;
  if (last !== stage) {
    setLast(stage);
    if (stage === 'working') {
      setOwed(false);
      setLoaded(false);
      owed = false;
      loaded = false;
    } else if (last === 'working' && stage === 'ready') {
      setOwed(true);
      owed = true;
    }
  }

  // The bar runs on until the picture is there to be seen: arrived, and loaded by the image itself.
  const wait: Wait = stage === 'working' || (stage === 'ready' && owed && !loaded) ? 'running' : stage === 'ready' ? 'done' : 'stopped';
  const { progress, complete } = useEstimatedProgress(wait, typicalWaitMs);
  const open = owed && loaded && complete;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    announce(fittingRoom.ready);
    haptics.success();
    const timer = setTimeout(() => setOwed(false), motion.reveal);
    return () => clearTimeout(timer);
  }, [open]);

  return {
    progress,
    /** The curtain hangs in the frame: while the picture is made, until the reveal is over, and for a picture that did not come out. */
    curtain: stage !== 'ready' || owed,
    open,
    /** The curtain is closed and something is going on behind it. */
    breathing: wait === 'running',
    /** The picture has been decoded (or could not be): it is behind the curtain, ready to be shown. */
    onLoad: () => setLoaded(true),
  };
}

export type FittingRoom = ReturnType<typeof useFittingRoom>;

interface CurtainFrameProps {
  room: FittingRoom;
  width: number;
  /** The picture behind the curtain, once there is one. */
  children?: ReactNode;
  /** Instead of the status of the wait: why there is no picture. */
  notice?: Notice | null;
}

/** The frame of the picture: the closed curtain with the status of the wait over its lower part, and the picture behind. */
export function CurtainFrame({ room, width, children, notice }: CurtainFrameProps) {
  const theme = useTheme();
  const phase = !room.curtain ? 'open' : room.open ? 'opening' : 'closed';
  return (
    <>
      <Curtain
        phase={phase}
        width={width}
        breathe={room.breathing}
        left={<Image source={tryOnPictures.curtainLeft} contentFit="cover" accessible={false} style={styles.fill} />}
        right={<Image source={tryOnPictures.curtainRight} contentFit="cover" accessible={false} style={styles.fill} />}
        testID="visualization-curtain">
        {children}
      </Curtain>
      {room.curtain ? (
        // White on the dark scrim holds 4.5:1 over any curtain (the scrim is 60% black: at worst 5.7:1 on white).
        <ToggleFade on={!room.open} style={[styles.band, { backgroundColor: theme.sceneScrim }]}>
          {notice ? <Problem notice={notice} /> : <Working progress={room.progress} />}
        </ToggleFade>
      ) : null}
    </>
  );
}

/** The status of the wait: what it is called, what is being done now, and how far it has got. */
function Working({ progress }: { progress: number }) {
  return (
    <View style={styles.words} testID="visualization-working">
      <AppText variant="eyebrow" color="onScene">
        {fittingRoom.eyebrow}
      </AppText>
      <Fade key={stageOf(progress)} duration={motion.enter}>
        <AppText variant="title" color="onScene" accessibilityLiveRegion="polite">
          {stageOf(progress)}
        </AppText>
      </Fade>
      <Bar progress={progress} />
    </View>
  );
}

/** Blocked, failed, or an order the server would not take: what happened. The curtain stays shut and the way forward is the button under the picture. */
function Problem({ notice }: { notice: Notice }) {
  return (
    <View style={styles.words} accessibilityRole="alert" testID="visualization-problem">
      <AppText variant="title" color="onScene">
        {notice.title}
      </AppText>
      <AppText variant="secondary" color="onScene">
        {notice.text}
      </AppText>
    </View>
  );
}

/** Its own bar rather than the shared one: the shared track is the border colour, which all but disappears on a curtain. */
function Bar({ progress }: { progress: number }) {
  const theme = useTheme();
  const part = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={fittingRoom.progressLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(part * 100) }}
      style={[styles.track, { backgroundColor: theme.onSceneDim }]}>
      <ProgressFill progress={part} style={{ backgroundColor: theme.onScene }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: size.gutter, paddingTop: space[4], paddingBottom: space[6] },
  words: { gap: space[2] },
  track: { width: '100%', height: size.bar, borderRadius: size.bar / 2, overflow: 'hidden' },
});
