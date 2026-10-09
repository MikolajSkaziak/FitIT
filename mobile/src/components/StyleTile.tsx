import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { motion, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressScale, ToggleFade } from './motion';
import { useClosePeekOnUnmount, usePhotoPeek } from './PhotoPeek';

/** How long a finger rests on a tile before the larger photo opens. */
const holdDelay = 250;
/** How far (points) a finger held on a tile may drift before the hold is let go; scrolling takes the touch long before this. */
const holdSlopOffset = { top: 48, bottom: 48, left: 48, right: 48 };

interface StyleTileProps {
  label: string;
  /** The reference photo (3:4); the tile shows a sage well until it arrives, or stays so when there is none. */
  photoUrl?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * One style: its photo with the name underneath. Chosen, the photo gets a green ring and a check, which show at once and fade
 * out over `motion.press` like every other selection; the photo and the label never move. Held down, the photo opens large
 * above the screen for as long as the finger stays; a hold is not a tap, so it never changes the selection.
 */
export function StyleTile({ label, photoUrl, selected, onPress, testID }: StyleTileProps) {
  const theme = useTheme();
  const peek = usePhotoPeek();
  useClosePeekOnUnmount();
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={photoUrl ? 'Touch and hold to see a larger photo' : undefined}
      onPress={onPress}
      onLongPress={photoUrl ? () => peek.show({ uri: photoUrl, label }) : undefined}
      onPressOut={peek.hide}
      delayLongPress={holdDelay}
      pressRetentionOffset={holdSlopOffset}
      testID={testID}
      style={styles.tile}>
      <View style={[styles.photo, { backgroundColor: theme.sage }]}>
        <Image source={photoUrl ? { uri: photoUrl } : null} contentFit="cover" transition={motion.exit} style={StyleSheet.absoluteFill} accessible={false} />
        <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} />
        <ToggleFade on={selected} style={[styles.badge, { backgroundColor: theme.action }]}>
          <Icon name="check" size={16} color="onAction" />
        </ToggleFade>
      </View>
      <AppText variant="secondaryStrong" align="center">
        {label}
      </AppText>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  photo: { aspectRatio: 3 / 4, borderRadius: radius.well, overflow: 'hidden' },
  ring: { borderWidth: 3, borderRadius: radius.well },
  badge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
