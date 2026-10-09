import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, ProgressBar } from '@/components/controls';
import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/lists';
import { Fade, PressScale, useChanged } from '@/components/motion';
import { pickFromGallery, takePhoto } from '@/features/wardrobe/photos';
import { uploads } from '@/features/wardrobe/queue';
import { describeEntry } from '@/features/wardrobe/uploadCopy';
import { isInFlight, useQueue, type UploadEntry } from '@/features/wardrobe/uploadQueue';
import { garments } from '@/lib/plural';
import { motion, radius, size, space, useTheme } from '@/theme';

/** How many photos the gallery lets a person pick in one go. */
const batch = 20;

/**
 * Adding garments: a sheet over the wardrobe, straight on its two sources and the list of what is on its way. There is no
 * consent step here: creating the account was the agreement to AI processing. The server still checks it on every upload,
 * and withdrawing it in Profile is answered there.
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
  const [cameraDenied, setCameraDenied] = useState(false);

  // What the server has counted, less what is still on its way there.
  const sending = entries.filter(isInFlight).length;
  const left = usage.data ? Math.max(0, usage.data.items.limit - usage.data.items.used - sending) : null;
  const full = left === 0;

  const fromGallery = async () => {
    setCameraDenied(false);
    uploads.add(await pickFromGallery(Math.min(batch, left ?? batch)));
  };

  const fromCamera = async () => {
    const shot = await takePhoto();
    setCameraDenied(shot.kind === 'denied');
    if (shot.kind === 'taken') {
      uploads.add([shot.photo]);
    }
  };

  const close = () => {
    uploads.clearSettled();
    router.back();
  };

  return (
    <>
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header">
          Add clothes
        </AppText>
        <IconButton icon="close" label="Close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.sources}>
          <Source icon="camera" label="Take a photo" onPress={() => void fromCamera()} disabled={full} testID="add-camera" />
          <Source icon="image" label="Choose from library" onPress={() => void fromGallery()} disabled={full} testID="add-gallery" />
        </View>
        {cameraDenied ? (
          <Fade key="denied" style={styles.denied}>
            <AppText variant="secondary" color="danger" accessibilityRole="alert">
              fitit. can’t use your camera. Turn it on in Settings, or choose photos from your library.
            </AppText>
            <Button label="Open settings" kind="secondary" compact inline onPress={() => void Linking.openSettings()} />
          </Fade>
        ) : (
          <AppText variant="secondary" color="textSecondary">
            One item per photo works best, ideally on a light background.
          </AppText>
        )}
        {entries.length > 0 ? (
          <View style={styles.group}>
            <AppText variant="subheading" accessibilityRole="header">
              Uploads
            </AppText>
            <Card>
              {entries.map((entry, index) => (
                <QueueRow
                  key={entry.id}
                  entry={entry}
                  position={index + 1}
                  last={index === entries.length - 1}
                  onRetry={() => uploads.retry(entry.id)}
                  onOpen={entry.itemId ? () => router.replace({ pathname: '/clothes/[id]', params: { id: entry.itemId as string } }) : undefined}
                />
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        {left !== null ? (
          <AppText variant="meta" color={full ? 'danger' : 'textSecondary'} align="center" tabular>
            {full ? 'You’ve added all the new clothes you can today. More tomorrow.' : `You can add ${garments(left)} more today.`}
          </AppText>
        ) : null}
        <Button label="Done" onPress={close} testID="add-done" />
      </View>
    </>
  );
}

interface SourceProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}

/** One of the two large buttons: where the photos come from. */
function Source({ icon, label, onPress, disabled, testID }: SourceProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.source, { backgroundColor: disabled ? theme.disabledFill : theme.surface, borderColor: disabled ? theme.disabledFill : theme.borderControl }]}>
      <Icon name={icon} color={disabled ? 'disabledText' : 'action'} />
      <AppText variant="secondaryStrong" color={disabled ? 'disabledText' : 'text'}>
        {label}
      </AppText>
    </PressScale>
  );
}

interface QueueRowProps {
  entry: UploadEntry;
  position: number;
  last: boolean;
  onRetry: () => void;
  onOpen?: () => void;
}

function QueueRow({ entry, position, last, onRetry, onOpen }: QueueRowProps) {
  const theme = useTheme();
  const title = entry.name ?? `Photo ${position}`;
  const { text, trouble } = describeEntry(entry);
  // The line under the name changes with the status ("Uploading", "Done"); it changes by a fade, but a row that is new does not animate.
  const changed = useChanged(entry.status);
  return (
    <View style={[styles.queueRow, last ? null : { borderBottomWidth: 1, borderBottomColor: theme.border }]} testID={`upload-${position}`}>
      <Image
        source={{ uri: entry.photo.uri }}
        contentFit="cover"
        accessible={false}
        style={[styles.thumb, { backgroundColor: theme.well, borderColor: theme.wellLine }]}
      />
      <View style={styles.queueText} accessible accessibilityLabel={`${title}. ${text}`}>
        <AppText variant="secondaryStrong" numberOfLines={1}>
          {title}
        </AppText>
        <Fade key={entry.status} enter={changed} duration={motion.exit}>
          <AppText variant="meta" color={trouble ? 'danger' : 'textSecondary'}>
            {text}
          </AppText>
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
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { gap: space[4], paddingBottom: space[2] },
  sources: { flexDirection: 'row', gap: space[2] },
  source: { flex: 1, height: 96, borderWidth: 1, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  denied: { gap: space[2] },
  group: { gap: space[2] },
  queueRow: { minHeight: 64, paddingVertical: space[2], paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  thumb: { width: 48, height: 48, borderRadius: radius.thumb, borderWidth: 1 },
  queueText: { flex: 1 },
  progress: { marginTop: space[1] },
  actions: { gap: space[2] },
});
