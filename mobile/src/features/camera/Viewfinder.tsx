import { CameraView, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import type { IconName } from '@/components/Icon';
import { announce, Fade, Flash, PressScale } from '@/components/motion';
import type { LocalPhoto } from '@/features/wardrobe/photos';
import * as haptics from '@/lib/haptics';
import { motion, radius, size, space, useTheme } from '@/theme';

import { camera as copy } from './copy';
import { Guide } from './Guide';
import type { CameraMode } from './session';

type Flashlight = Extract<FlashMode, 'off' | 'on' | 'auto'>;

const nextFlash: Record<Flashlight, Flashlight> = { off: 'on', on: 'auto', auto: 'off' };
const flashIcon: Record<Flashlight, IconName> = { off: 'flashOff', on: 'flash', auto: 'flashAuto' };

/** The shutter: a ring with a disc inside. */
const shutter = 72;
const shutterRing = 3;
const shutterDisc = 56;
/** How much of the zoom range one doubling of the pinch covers. */
const zoomReach = 0.25;

interface ViewfinderProps {
  mode: CameraMode;
  /** How many photos this visit may bring back. */
  limit: number;
  /** `limit` is what is left of today's allowance. */
  daily: boolean;
  onDone: (photos: LocalPhoto[]) => void;
  onClose: () => void;
  /** The camera did not start, or the device has none. */
  onUnavailable: () => void;
}

/**
 * The live camera with fitit.'s own controls over it. The chrome is always light on dark, whatever the theme: it sits on
 * the scene, not on the page. Clothes: shot after shot until Done. Selfie: one shot, then a look at it before it is used.
 * Photo (one more of a garment): like clothes, without the framing guide.
 */
export function Viewfinder({ mode, limit, daily, onDone, onClose, onUnavailable }: ViewfinderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const view = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState<Flashlight>('off');
  const [zoom, setZoom] = useState(0);
  /** The zoom when the fingers came down: a pinch is measured from there. */
  const [zoomFrom, setZoomFrom] = useState(0);
  const [shots, setShots] = useState<LocalPhoto[]>([]);
  /** The selfie that was just taken, waiting to be used or taken again. */
  const [still, setStill] = useState<LocalPhoto | null>(null);

  const selfie = mode === 'selfie';
  const full = !selfie && shots.length >= limit;
  const last = shots[shots.length - 1];

  const start = async () => {
    // A simulator has no camera, yet the view reports ready and stays black: no lens for this side means there is nothing to show.
    if (Platform.OS === 'ios') {
      const lenses = await view.current?.getAvailableLensesAsync().catch(() => null);
      if (lenses && lenses.length === 0) {
        onUnavailable();
        return;
      }
    }

    setReady(true);
  };

  const capture = async () => {
    if (!ready || busy || full) {
      return;
    }

    setBusy(true);
    const picture = await view.current?.takePictureAsync({ quality: 1, exif: false }).catch(() => null);
    setBusy(false);
    setFailed(!picture);
    if (!picture) {
      haptics.error();
      return;
    }

    const photo: LocalPhoto = { uri: picture.uri, width: picture.width, height: picture.height };
    if (selfie) {
      haptics.shutter();
      setStill(photo);
      return;
    }

    // The shot that fills the batch (or the day, or the garment) is the one that meets the limit: that cue says more than the shutter does.
    if (shots.length + 1 >= limit) {
      haptics.warning();
    } else {
      haptics.shutter();
    }

    setShots([...shots, photo]);
    announce(copy.taken(shots.length + 1));
  };

  const retake = () => {
    // The camera view is mounted afresh, so it has to report ready again.
    setReady(false);
    setStill(null);
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => setZoomFrom(zoom))
    .onUpdate(({ scale }) => setZoom(Math.max(0, Math.min(1, zoomFrom + (scale - 1) * zoomReach))));

  // One more photo of a garment is framed however the person likes: no brackets, and its own words.
  const free = mode === 'photo';
  const limitCaption = free ? copy.photo.limit : daily ? copy.clothes.dayLimit : copy.clothes.batchLimit;
  const caption = failed ? copy.failed : full ? limitCaption : copy[mode].guide;
  const sceneButton = { backgroundColor: theme.sceneScrim };

  return (
    <View style={[styles.root, { backgroundColor: theme.scene }]} testID="camera">
      <StatusBar style="light" />
      {still ? (
        <Image source={{ uri: still.uri }} contentFit="cover" accessibilityLabel={copy.selfie.still} style={StyleSheet.absoluteFill} testID="camera-still" />
      ) : (
        <GestureDetector gesture={pinch}>
          <View collapsable={false} style={StyleSheet.absoluteFill}>
            <CameraView
              ref={view}
              style={StyleSheet.absoluteFill}
              facing={selfie ? 'front' : 'back'}
              flash={selfie ? 'off' : flash}
              zoom={zoom}
              mode="picture"
              mute
              onCameraReady={() => void start()}
              onMountError={onUnavailable}
            />
          </View>
        </GestureDetector>
      )}
      <Flash count={shots.length} style={[StyleSheet.absoluteFill, { backgroundColor: theme.onScene }]} />

      <View pointerEvents="box-none" style={styles.root}>
        <View style={[styles.top, { paddingTop: insets.top + space[2] }]}>
          <IconButton bare icon="close" label={copy.close} color="onScene" onPress={onClose} style={sceneButton} testID="camera-close" />
          {selfie ? null : (
            <IconButton
              bare
              icon={flashIcon[flash]}
              label={copy.flash[flash]}
              color="onScene"
              haptic="none"
              onPress={() => {
                haptics.select();
                setFlash(nextFlash[flash]);
              }}
              style={sceneButton}
              testID="camera-flash"
            />
          )}
        </View>

        {still || free ? <View pointerEvents="none" style={styles.root} /> : <Guide mode={mode} />}

        <View style={[styles.bottom, { backgroundColor: theme.sceneScrim, paddingBottom: Math.max(insets.bottom, space[4]) }]}>
          {still ? (
            <View style={styles.review}>
              <Button label={copy.selfie.use} onPress={() => onDone([still])} testID="camera-use" />
              <SceneTextButton label={copy.selfie.retake} onPress={retake} testID="camera-retake" />
            </View>
          ) : (
            <>
              <AppText variant="caption" color="onScene" align="center" accessibilityLiveRegion="polite" testID="camera-caption">
                {caption}
              </AppText>
              <View style={styles.controls}>
                <View style={[styles.side, styles.leading]}>
                  {last ? (
                    <View accessible accessibilityRole="text" accessibilityLabel={copy.count(shots.length)} style={styles.shots} testID="camera-count">
                      {/* A new thumbnail each time the count goes up: it settles in from a little smaller. */}
                      <Fade key={shots.length} pop duration={motion.exit} testID="camera-thumb">
                        <Image source={{ uri: last.uri }} contentFit="cover" accessible={false} style={[styles.thumb, { borderColor: theme.sceneLine }]} />
                      </Fade>
                      <View style={[styles.badge, { backgroundColor: theme.onScene }]}>
                        <AppText variant="micro" color="scene" tabular>
                          {shots.length}
                        </AppText>
                      </View>
                    </View>
                  ) : null}
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={copy.shutter}
                  accessibilityState={{ disabled: !ready || full, busy }}
                  disabled={!ready || busy || full}
                  haptic="none"
                  onPress={() => void capture()}
                  testID="camera-shutter"
                  style={[styles.shutter, { borderColor: !ready || full ? theme.onSceneDim : theme.onScene }]}>
                  <View style={[styles.disc, { backgroundColor: !ready || full ? theme.onSceneDim : theme.onScene }]} />
                </PressScale>
                <View style={[styles.side, styles.trailing]}>
                  {selfie ? null : <SceneTextButton label={copy.done} disabled={shots.length === 0} onPress={() => onDone(shots)} testID="camera-done" />}
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

interface SceneTextButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}

/** A capsule of white words for the dark band under the scene, where the green of a text button would not read. */
function SceneTextButton({ label, onPress, disabled = false, testID }: SceneTextButtonProps) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="quiet"
      onPress={onPress}
      testID={testID}
      style={styles.textButton}>
      <AppText variant="label" color={disabled ? 'onSceneDim' : 'onScene'} numberOfLines={1}>
        {label}
      </AppText>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: size.gutter, paddingBottom: space[4] },
  bottom: { paddingTop: space[3], paddingHorizontal: size.gutter, gap: space[3] },
  controls: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, minHeight: size.touch, justifyContent: 'center' },
  leading: { alignItems: 'flex-start' },
  trailing: { alignItems: 'flex-end' },
  shots: { width: size.touch, height: size.touch },
  thumb: { width: size.touch, height: size.touch, borderRadius: radius.thumb, borderWidth: 1 },
  badge: { position: 'absolute', top: -space[2], right: -space[2], minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: space[1], alignItems: 'center', justifyContent: 'center' },
  shutter: { width: shutter, height: shutter, borderRadius: shutter / 2, borderWidth: shutterRing, alignItems: 'center', justifyContent: 'center' },
  disc: { width: shutterDisc, height: shutterDisc, borderRadius: shutterDisc / 2 },
  review: { gap: space[1], alignItems: 'stretch' },
  textButton: { minHeight: size.touch, minWidth: size.touch, paddingHorizontal: space[4], borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
