import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/controls';
import { press } from '@/lib/haptics';
import { size, space, useTheme } from '@/theme';

import { closeEnlarged, pictureLabel } from './copy';
import type { Picture } from './order';

interface ImageViewerProps {
  picture: Pick<Picture, 'url' | 'cacheKey'>;
  visible: boolean;
  onClose: () => void;
  /** What the picture is, for a screen reader. An outfit on the person's body shape when left out. */
  label?: string;
}

/** The picture as large as the screen allows, over a scrim, with two ways back: the control and the space around it. */
export function ImageViewer({ picture, visible, onClose, label = pictureLabel }: ImageViewerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.scrim, paddingTop: insets.top + space[2], paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeEnlarged}
          onPress={() => {
            press('quiet');
            onClose();
          }}
          style={StyleSheet.absoluteFill}
          testID="visualization-viewer-backdrop"
        />
        <IconButton icon="close" label={closeEnlarged} onPress={onClose} style={styles.close} testID="visualization-viewer-close" />
        <Image
          source={{ uri: picture.url, cacheKey: picture.cacheKey ?? undefined }}
          contentFit="contain"
          accessible
          accessibilityLabel={label}
          style={styles.image}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: size.gutter, gap: space[3] },
  close: { alignSelf: 'flex-end' },
  image: { flex: 1, width: '100%' },
});
