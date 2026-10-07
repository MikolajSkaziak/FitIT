import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/controls';
import { radius, size, space, useTheme } from '@/theme';

import { closeEnlarged, pictureLabel } from './copy';
import type { Picture } from './order';

interface ImageViewerProps {
  picture: Picture;
  visible: boolean;
  onClose: () => void;
}

/** The picture as large as the screen allows, over a scrim, with two ways back: the control and the space around it. */
export function ImageViewer({ picture, visible, onClose }: ImageViewerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.scrim, paddingTop: insets.top + space[2], paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeEnlarged} onPress={onClose} style={StyleSheet.absoluteFill} testID="visualization-viewer-backdrop" />
        {/* The control sits on a surface tile: the scrim is dark in both schemes, and no token is light in both. */}
        <View style={[styles.close, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <IconButton icon="close" label={closeEnlarged} onPress={onClose} testID="visualization-viewer-close" />
        </View>
        <Image
          source={{ uri: picture.url, cacheKey: picture.cacheKey ?? undefined }}
          contentFit="contain"
          accessible
          accessibilityLabel={pictureLabel}
          style={styles.image}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: size.gutter, gap: space[3] },
  close: { alignSelf: 'flex-end', width: size.touch, height: size.touch, borderWidth: 1, borderRadius: radius.control, overflow: 'hidden' },
  image: { flex: 1, width: '100%' },
});
