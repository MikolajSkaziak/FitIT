import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useStore } from 'zustand';

import { deleteClothingPhoto, maxExtraPhotos, wardrobeKeys, type Clothing, type ClothingPhoto } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { LinkText, ProgressBar } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/lists';
import { announce, Fade, PressScale } from '@/components/motion';
import { messageFor, messageForCode } from '@/copy/errors';
import * as haptics from '@/lib/haptics';
import { useCamera } from '@/features/camera/session';
import { motion, radius, size, space, useTheme } from '@/theme';

import type { ExtraEntry } from './extraPhotos';
import { pickFromGallery, type LocalPhoto } from './photos';
import { extraPhotos } from './queue';

/** The words of a garment's extra photos, in one place. */
export const morePhotos = {
  title: 'More photos',
  add: 'Add photo',
  caption: 'The back, a detail, or how it fits you. Only you see these.',
  camera: 'Take a photo',
  library: 'Choose from library',
  discard: 'Discard',
  /** The main picture is photo 1; the extra ones follow in the order they were added. */
  label: (position: number, total: number, name: string) => `Photo ${position} of ${total} of ${name}`,
  counter: (position: number, total: number) => `Photo ${position} of ${total}`,
  uploading: (position: number) => `Uploading photo ${position}`,
  retry: (position: number) => `Retry upload: photo ${position}`,
  remove: (position: number) => `Remove photo ${position}`,
  removed: (position: number) => `Photo ${position} removed`,
};

/** The side of a thumbnail: four fit in a row with their gaps on the narrowest phone, and they grow no larger than 72. */
function useThumb(): number {
  const { width } = useWindowDimensions();
  return Math.floor(Math.min(72, (width - 2 * size.gutter - (maxExtraPhotos - 1) * space[2]) / maxExtraPhotos));
}

interface ThumbProps {
  uri: string;
  cacheKey?: string;
  side: number;
  /** Stepped back, for a photo that is not the garment's yet. */
  faded?: boolean;
  children?: ReactNode;
}

/** One small square photo, cropped to fill. Decorative by itself: whoever wraps it says what it is. */
function Thumb({ uri, cacheKey, side, faded = false, children }: ThumbProps) {
  const theme = useTheme();
  return (
    <View style={[styles.thumb, { width: side, height: side, backgroundColor: theme.well }]}>
      <Image source={{ uri, cacheKey }} contentFit="cover" transition={motion.exit} accessible={false} style={[StyleSheet.absoluteFill, faded ? styles.faded : null]} />
      {children}
    </View>
  );
}

interface MorePhotosProps {
  garment: Clothing;
  /** The garment's name as the screen shows it. */
  name: string;
  /** A thumbnail was pressed: show that photo large. */
  onOpen: (photo: ClothingPhoto) => void;
}

/**
 * The garment's extra photos on its own page: a row of small squares, the ones still travelling among them, and a tile
 * that adds another while there is room. Adding never holds the screen: a new photo shows at once and uploads behind it.
 */
export function MorePhotos({ garment, name, onOpen }: MorePhotosProps) {
  const theme = useTheme();
  const side = useThumb();
  const openCamera = useCamera();
  const [choosing, setChoosing] = useState(false);
  const entries = useStore(extraPhotos.store, (state) => state.entries).filter((entry) => entry.garmentId === garment.id);

  const kept = garment.photos.length;
  const room = Math.max(0, maxExtraPhotos - kept - entries.length);
  const total = kept + 1;
  const failed = entries.find((entry) => entry.status === 'failed');

  const add = async (source: () => Promise<LocalPhoto[]>) => {
    setChoosing(false);
    // Never more than the garment has room for, whatever the picker let through.
    extraPhotos.add(garment.id, (await source()).slice(0, room));
  };

  return (
    <View style={styles.section} testID="more-photos">
      <Eyebrow header>{morePhotos.title}</Eyebrow>
      <View style={styles.row}>
        {garment.photos.map((photo, at) => (
          <PressScale
            key={photo.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={morePhotos.label(at + 2, total, name)}
            onPress={() => onOpen(photo)}
            testID={`more-photo-${at + 2}`}>
            <Thumb uri={photo.imageUrl} cacheKey={photo.imageKey} side={side} />
          </PressScale>
        ))}
        {entries.map((entry, at) => (
          <Pending key={entry.id} entry={entry} position={kept + at + 2} side={side} />
        ))}
        {room > 0 ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={morePhotos.add}
            accessibilityState={{ expanded: choosing }}
            onPress={() => setChoosing(!choosing)}
            testID="more-photos-add"
            style={[styles.thumb, styles.addTile, { width: side, height: side, borderColor: theme.borderControl }]}>
            <Icon name="plus" size={20} color="action" />
            <AppText variant="micro" color="textSecondary" align="center" numberOfLines={1}>
              {morePhotos.add}
            </AppText>
          </PressScale>
        ) : null}
      </View>

      {failed ? (
        <View style={styles.trouble}>
          <AppText variant="caption" color="danger" accessibilityLiveRegion="polite" style={styles.troubleText} testID="more-photos-error">
            {messageForCode(failed.errorCode)}
          </AppText>
          <LinkText label={morePhotos.discard} onPress={() => extraPhotos.discard(failed.id)} testID="more-photos-discard" />
        </View>
      ) : null}

      {choosing && room > 0 ? (
        <Fade duration={motion.exit}>
          <Row icon="camera" label={morePhotos.camera} onPress={() => void add(() => openCamera({ mode: 'photo', limit: room }))} testID="more-photos-camera" />
          <Row icon="image" label={morePhotos.library} onPress={() => void add(() => pickFromGallery(room))} testID="more-photos-library" />
        </Fade>
      ) : null}

      {kept === 0 && entries.length === 0 ? (
        <AppText variant="meta" color="textSecondary">
          {morePhotos.caption}
        </AppText>
      ) : null}
    </View>
  );
}

/** A photo that is not the garment's yet: stepped back with a line of progress, or, when it did not get through, a way to send it again. */
function Pending({ entry, position, side }: { entry: ExtraEntry; position: number; side: number }) {
  const theme = useTheme();
  if (entry.status === 'failed') {
    return (
      <PressScale accessibilityRole="button" accessibilityLabel={morePhotos.retry(position)} onPress={() => extraPhotos.retry(entry.id)} testID={`more-photo-retry-${position}`}>
        <Thumb uri={entry.photo.uri} side={side} faded>
          <View style={[styles.mark, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name="refresh" size={16} color="danger" />
          </View>
        </Thumb>
      </PressScale>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={morePhotos.uploading(position)}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(entry.progress * 100) }}
      testID={`more-photo-pending-${position}`}>
      <Thumb uri={entry.photo.uri} side={side} faded>
        <View style={styles.progress}>
          <ProgressBar progress={entry.progress} label={morePhotos.uploading(position)} />
        </View>
      </Thumb>
    </View>
  );
}

/**
 * The same photos on the edit screen, each with a small round button that removes it. The photo goes at once; if the
 * server refuses, it comes back and the screen says why.
 */
export function RemovablePhotos({ garment }: { garment: Clothing }) {
  const theme = useTheme();
  const side = useThumb();
  const queryClient = useQueryClient();
  const key = wardrobeKeys.one(garment.id);

  const remove = useMutation({
    mutationFn: (photo: ClothingPhoto) => deleteClothingPhoto(garment.id, photo.id),
    onMutate: async (photo) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Clothing>(key);
      const position = (before?.photos.findIndex((known) => known.id === photo.id) ?? -1) + 2;
      if (before) {
        queryClient.setQueryData<Clothing>(key, { ...before, photos: before.photos.filter((known) => known.id !== photo.id) });
      }

      announce(morePhotos.removed(position));
      return before;
    },
    onError: (_error, _photo, before) => {
      if (before) {
        queryClient.setQueryData(key, before);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] }),
  });

  if (garment.photos.length === 0 && !remove.isError) {
    return null;
  }

  return (
    <View style={styles.section} testID="edit-photos">
      <Eyebrow header>{morePhotos.title}</Eyebrow>
      <View style={styles.row}>
        {garment.photos.map((photo, at) => (
          <View key={photo.id} testID={`edit-photo-${at + 2}`}>
            <Thumb uri={photo.imageUrl} cacheKey={photo.imageKey} side={side} />
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={morePhotos.remove(at + 2)}
              haptic="none"
              onPress={() => {
                haptics.destroy();
                remove.mutate(photo);
              }}
              testID={`edit-photo-remove-${at + 2}`}
              style={styles.removeTarget}>
              <View style={[styles.mark, styles.removeMark, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Icon name="close" size={12} color="text" />
              </View>
            </PressScale>
          </View>
        ))}
      </View>
      <FormError message={remove.isError ? messageFor(remove.error) : null} />
    </View>
  );
}

const mark = 28;

const styles = StyleSheet.create({
  section: { gap: 10 },
  row: { flexDirection: 'row', gap: space[2] },
  thumb: { borderRadius: radius.thumb, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  faded: { opacity: 0.5 },
  addTile: { borderWidth: 1, borderStyle: 'dashed', gap: 2, paddingHorizontal: 2 },
  mark: { width: mark, height: mark, borderRadius: mark / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { position: 'absolute', left: space[2], right: space[2], bottom: space[2] },
  trouble: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  troubleText: { flex: 1 },
  // A full 44 point target in the photo's upper right corner, with the small disc in the middle of it.
  removeTarget: { position: 'absolute', top: 0, right: 0, width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  removeMark: { width: 24, height: 24, borderRadius: 12 },
});
