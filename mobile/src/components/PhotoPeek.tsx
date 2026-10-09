import { Image } from 'expo-image';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Fade, Peek } from './motion';

/** A photo to look at, large: its address, and the name shown under it. */
export interface PeekedPhoto {
  uri: string;
  label: string;
}

interface PeekControls {
  show: (photo: PeekedPhoto) => void;
  hide: () => void;
}

// Without a host (a screen on its own) there is simply nothing to show, and nothing breaks.
const PeekContext = createContext<PeekControls>({ show: () => undefined, hide: () => undefined });

/** The two calls that open and close the peek. Stable, so a tile that uses them does not redraw when the peek opens. */
export function usePhotoPeek(): PeekControls {
  return useContext(PeekContext);
}

/** The photo is 3:4, as the tiles it comes from; it takes the width of the screen less margins, or 70% of its height, whichever is less. */
const photoRatio = 3 / 4;
const heightShare = 0.7;
const margin = space[6];

/**
 * Holds the one peek of the app and draws it above everything, the pinned footers and the tab bar included: mount it once,
 * around the navigator. The layer is purely visual: it takes no touch, so the finger that holds a tile keeps its hold, and a
 * screen reader never meets it.
 */
export function PhotoPeekHost({ children }: { children: ReactNode }) {
  const [photo, setPhoto] = useState<PeekedPhoto | null>(null);
  const controls = useMemo<PeekControls>(() => ({ show: setPhoto, hide: () => setPhoto(null) }), []);
  return (
    <PeekContext.Provider value={controls}>
      <View style={styles.host}>
        {children}
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {photo ? <PeekLayer key={photo.uri} photo={photo} /> : null}
        </View>
      </View>
    </PeekContext.Provider>
  );
}

function PeekLayer({ photo }: { photo: PeekedPhoto }) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const width = Math.min(window.width - margin * 2, window.height * heightShare * photoRatio);
  return (
    <>
      <Fade exit style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} testID="photo-peek-scrim">
        {null}
      </Fade>
      <View pointerEvents="none" style={styles.center}>
        <Peek style={styles.group} testID="photo-peek">
          <View style={[styles.photo, { width, backgroundColor: theme.sage }]}>
            <Image source={{ uri: photo.uri }} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
          </View>
          <View style={[styles.label, { backgroundColor: theme.surface }]}>
            <AppText variant="secondaryStrong" numberOfLines={1}>
              {photo.label}
            </AppText>
          </View>
        </Peek>
      </View>
    </>
  );
}

/** Closes the peek if the tile that opened it goes away while it is open (the screen is left, the list changes). */
export function useClosePeekOnUnmount(): void {
  const { hide } = usePhotoPeek();
  useEffect(() => hide, [hide]);
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  group: { alignItems: 'center', gap: space[3] },
  photo: { aspectRatio: photoRatio, borderRadius: radius.well, overflow: 'hidden' },
  label: { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.pill, maxWidth: '100%' },
});
