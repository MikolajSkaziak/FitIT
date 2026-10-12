import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, ProgressBar } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Icon, type IconName } from '@/components/Icon';
import { Fade, PressScale, useChanged } from '@/components/motion';
import { useCamera } from '@/features/camera/session';
import { useAiConsent } from '@/features/consent/session';
import { batch, pickFromGallery } from '@/features/wardrobe/photos';
import { uploads } from '@/features/wardrobe/queue';
import { describeEntry } from '@/features/wardrobe/uploadCopy';
import { isInFlight, useQueue, type UploadEntry } from '@/features/wardrobe/uploadQueue';
import { motion, radius, size, space, useTheme } from '@/theme';

/**
 * Adding garments: a sheet over the wardrobe, straight on its two sources and the list of what is on its way. Before the
 * first photo is taken or chosen, the consent sheet asks to send photos to AI services (once; after that it is not shown).
 * The server still checks the consent on every upload, and a withdrawal in Profile is answered there.
 */
export default function AddClothes() {
  const insets = useSafeAreaInsets();
  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="add-sheet">
      <Adding />
    </View>
  );
}

function Adding() {
  const router = useRouter();
  const entries = useQueue(uploads, (state) => state.entries);
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });
  const openCamera = useCamera();
  const askConsent = useAiConsent();

  // What the server has counted, less what is still on its way there.
  const sending = entries.filter(isInFlight).length;
  const left = usage.data ? Math.max(0, usage.data.items.limit - usage.data.items.used - sending) : null;
  const full = left === 0;
  // One visit to the library or the camera brings at most a batch, and never more than the day still allows.
  const room = Math.min(batch, left ?? batch);

  // Nothing leaves the phone, and nothing is even chosen, until the person has allowed it.
  const fromGallery = async () => {
    if (await askConsent('clothes')) {
      uploads.add(await pickFromGallery(room));
    }
  };

  const fromCamera = async () => {
    if (!(await askConsent('clothes'))) {
      return;
    }

    uploads.add(await openCamera({ mode: 'clothes', limit: room, daily: left !== null && left <= batch }));
  };

  const close = () => {
    uploads.clearSettled();
    router.back();
  };

  // The photo that is being worked on is the first one not yet settled; once all are, the list is just the list.
  const settled = entries.filter((entry) => !isInFlight(entry)).length;
  const title = sending > 0 ? `Adding ${Math.min(settled + 1, entries.length)} of ${entries.length}` : 'Uploads';

  return (
    <>
      <View style={styles.head}>
        <IconButton icon="close" label="Close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.titles}>
          {usage.data && left !== null ? (
            <AppText variant="eyebrow" tabular>
              {left} of {usage.data.items.limit} left today
            </AppText>
          ) : null}
          <AppText variant="display" accessibilityRole="header">
            Add clothes
          </AppText>
          {full ? (
            <AppText color="danger">You’ve added all the new clothes you can today. More tomorrow.</AppText>
          ) : (
            <AppText color="textSecondary">One piece per photo. We remove the background and describe it for you.</AppText>
          )}
        </View>
        <View>
          <Source icon="camera" label="Take photos" caption="Use the camera" onPress={() => void fromCamera()} disabled={full} testID="add-camera" />
          <Source
            icon="image"
            label="Choose from library"
            caption={`Pick up to ${room} at once`}
            onPress={() => void fromGallery()}
            disabled={full}
            testID="add-gallery"
          />
        </View>
        {entries.length > 0 ? (
          <View>
            <Eyebrow header>{title}</Eyebrow>
            {entries.map((entry, index) => (
              <QueueRow
                key={entry.id}
                entry={entry}
                position={index + 1}
                onRetry={() => uploads.retry(entry.id)}
                onOpen={entry.itemId ? () => router.replace({ pathname: '/clothes/[id]', params: { id: entry.itemId as string } }) : undefined}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        <Button label="Done" onPress={close} testID="add-done" />
      </View>
    </>
  );
}

interface SourceProps {
  icon: IconName;
  label: string;
  caption: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}

/** One of the two ways to bring photos in: a hairline row with its icon, what it does and where it comes from. */
function Source({ icon, label, caption, onPress, disabled, testID }: SourceProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.source, { borderBottomColor: theme.border }]}>
      <Icon name={icon} color={disabled ? 'disabledText' : 'action'} />
      <View style={styles.sourceText}>
        <AppText variant="title" color={disabled ? 'disabledText' : 'text'}>
          {label}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {caption}
        </AppText>
      </View>
      <Icon name="forward" size={16} color="textSecondary" />
    </PressScale>
  );
}

interface QueueRowProps {
  entry: UploadEntry;
  position: number;
  onRetry: () => void;
  onOpen?: () => void;
}

function QueueRow({ entry, position, onRetry, onOpen }: QueueRowProps) {
  const theme = useTheme();
  const title = entry.name ?? `Photo ${position}`;
  const { text, trouble } = describeEntry(entry);
  // The line under the name changes with the status ("Uploading", "Done"); it changes by a fade, but a row that is new does not animate.
  const changed = useChanged(entry.status);
  return (
    <View style={[styles.queueRow, { borderBottomColor: theme.border }]} testID={`upload-${position}`}>
      <Image source={{ uri: entry.photo.uri }} contentFit="cover" accessible={false} style={[styles.thumb, { backgroundColor: theme.well, borderColor: theme.wellLine }]} />
      <View style={styles.queueText} accessible accessibilityLabel={`${title}. ${text}`}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        <Fade key={entry.status} enter={changed} duration={motion.exit}>
          <View style={styles.status}>
            {entry.status === 'processing' ? <Icon name="sparkle" size={12} color="textSecondary" /> : null}
            <AppText variant="caption" color={trouble ? 'danger' : 'textSecondary'} style={styles.statusText}>
              {text}
            </AppText>
          </View>
        </Fade>
        {entry.status === 'uploading' ? (
          <View style={styles.progress}>
            <ProgressBar progress={entry.progress} label={`Uploading: ${title}`} />
          </View>
        ) : null}
      </View>
      {entry.status === 'ready' ? (
        <Fade pop enter={changed} duration={motion.exit}>
          <Icon name="check" size={20} color="action" />
        </Fade>
      ) : null}
      {entry.status === 'failed' && entry.errorCode !== 'limit_reached' && entry.errorCode !== 'not_found' ? (
        <Button label="Retry" kind="secondary" compact inline onPress={onRetry} accessibilityLabel={`Retry upload: ${title}`} />
      ) : null}
      {entry.status === 'needs_tags' && onOpen ? <Button label="Fill in" kind="secondary" compact inline onPress={onOpen} accessibilityLabel={`Fill in details: ${title}`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[4], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center' },
  body: { gap: space[6], paddingBottom: space[2] },
  titles: { gap: 10 },
  source: { minHeight: size.option + space[2], paddingVertical: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1 },
  sourceText: { flex: 1, gap: 2 },
  queueRow: { minHeight: 80, paddingVertical: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: radius.well, borderWidth: 1 },
  queueText: { flex: 1, gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { flexShrink: 1 },
  progress: { marginTop: space[1] },
  actions: { gap: space[2] },
});
