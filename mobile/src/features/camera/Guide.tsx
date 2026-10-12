import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { space, useTheme } from '@/theme';

import type { CameraMode } from './session';

/** The guide is a hairline: thin enough to stay out of the picture, heavy enough to read on any scene. */
const line = 1.5;
const corner = 24;
/** The oval for a face is narrower than the frame for a garment. */
const ovalShare = 0.78;

/**
 * Where to put the subject: four corner brackets around a centred 3:4 frame for a garment, an oval for a face.
 * It takes the room between the top buttons and the controls, is decorative, and never takes a touch.
 */
export function Guide({ mode }: { mode: Exclude<CameraMode, 'photo'> }) {
  const theme = useTheme();
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const fit = room ? Math.max(0, Math.min(room.width - space[6] * 2, ((room.height - space[4] * 2) * 3) / 4)) : 0;
  const width = mode === 'selfie' ? fit * ovalShare : fit;
  const height = (width * 4) / 3;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={({ nativeEvent }) => setRoom({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}
      style={styles.room}
      testID="camera-guide">
      {width <= 0 ? null : mode === 'selfie' ? (
        <Svg width={width} height={height} testID="camera-oval">
          <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - line} ry={height / 2 - line} stroke={theme.sceneLine} strokeWidth={line} fill="none" />
        </Svg>
      ) : (
        <View style={{ width, height }} testID="camera-brackets">
          <View style={[styles.corner, styles.topLeft, { borderColor: theme.sceneLine }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: theme.sceneLine }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.sceneLine }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: theme.sceneLine }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: corner, height: corner },
  topLeft: { top: 0, left: 0, borderTopWidth: line, borderLeftWidth: line },
  topRight: { top: 0, right: 0, borderTopWidth: line, borderRightWidth: line },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: line, borderLeftWidth: line },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: line, borderRightWidth: line },
});
