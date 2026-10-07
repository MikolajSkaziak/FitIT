import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { updateProfile } from '@/api/account';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { setUser, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, ProgressBar } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Row } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { pickFromGallery, takePhoto } from '@/features/wardrobe/photos';
import { uploads } from '@/features/wardrobe/queue';
import { describeEntry } from '@/features/wardrobe/uploadCopy';
import { isInFlight, useQueue, type UploadEntry } from '@/features/wardrobe/uploadQueue';
import { garments } from '@/lib/plural';
import { radius, size, space, useTheme } from '@/theme';

/** How many photos the gallery lets a person pick in one go. */
const batch = 20;

/**
 * Adding garments: a sheet over the wardrobe. The first time, it asks for consent to send garment photos to the
 * outside services that describe them; after that it is two buttons and the list of what is on its way.
 */
export default function AddClothes() {
  const insets = useSafeAreaInsets();
  const consented = useSession((session) => Boolean(session.user?.aiConsentAt));
  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="add-sheet">
      {consented ? <Adding /> : <Consent />}
    </View>
  );
}

function Consent() {
  const router = useRouter();
  const agree = useMutation({ mutationFn: () => updateProfile({ aiConsent: true }), onSuccess: (user) => setUser(user) });
  return (
    <>
      <AppText variant="heading" accessibilityRole="header">
        Zanim dodasz pierwsze zdjęcie
      </AppText>
      <ScrollView contentContainerStyle={styles.consent} showsVerticalScrollIndicator={false}>
        <AppText>Żeby opisać ubrania i pokazać zestaw na sylwetce, wysyłamy zdjęcia ubrań do zewnętrznych usług.</AppText>
        <Card>
          <Row label="fal.ai i Google" meta="wycinanie tła, obraz na sylwetce" />
          <Row label="Anthropic" meta="opis ubrań i dobór zestawów" last />
        </Card>
        <AppText variant="secondary" color="textSecondary">
          Nie wysyłamy zdjęć osób. Zgodę możesz wycofać w profilu.
        </AppText>
      </ScrollView>
      <View style={styles.actions}>
        <FormError message={agree.isError ? messageFor(agree.error) : null} />
        <Button label="Zgadzam się" busy={agree.isPending} onPress={() => agree.mutate()} testID="consent-agree" />
        <Button label="Nie teraz" kind="text" onPress={() => router.back()} testID="consent-later" />
      </View>
    </>
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
          Dodaj ubrania
        </AppText>
        <IconButton icon="close" label="Zamknij" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.sources}>
          <Source icon="camera" label="Zrób zdjęcie" onPress={() => void fromCamera()} disabled={full} testID="add-camera" />
          <Source icon="image" label="Wybierz z galerii" onPress={() => void fromGallery()} disabled={full} testID="add-gallery" />
        </View>
        {cameraDenied ? (
          <View style={styles.denied}>
            <AppText variant="secondary" color="danger" accessibilityRole="alert">
              Aparat jest wyłączony dla FitIt. Włącz go w ustawieniach telefonu albo wybierz zdjęcia z galerii.
            </AppText>
            <Button label="Otwórz ustawienia" kind="secondary" compact inline onPress={() => void Linking.openSettings()} />
          </View>
        ) : (
          <AppText variant="secondary" color="textSecondary">
            Jedno ubranie na zdjęciu, najlepiej na jasnym tle.
          </AppText>
        )}
        {entries.length > 0 ? (
          <View style={styles.group}>
            <AppText variant="subheading" accessibilityRole="header">
              Wysyłanie
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
            {full ? 'Dzisiejszy limit nowych ubrań jest wykorzystany. Wróć jutro.' : `Dziś możesz dodać jeszcze ${garments(left)}.`}
          </AppText>
        ) : null}
        <Button label="Gotowe" onPress={close} testID="add-done" />
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.source,
        { backgroundColor: disabled ? theme.disabledFill : theme.surface, borderColor: disabled ? theme.disabledFill : theme.borderControl },
        pressed ? styles.pressed : null,
      ]}>
      <Icon name={icon} color={disabled ? 'disabledText' : 'action'} />
      <AppText variant="secondaryStrong" color={disabled ? 'disabledText' : 'text'}>
        {label}
      </AppText>
    </Pressable>
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
  const title = entry.name ?? `Zdjęcie ${position}`;
  const { text, trouble } = describeEntry(entry);
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
        <AppText variant="meta" color={trouble ? 'danger' : 'textSecondary'}>
          {text}
        </AppText>
        {entry.status === 'uploading' ? (
          <View style={styles.progress}>
            <ProgressBar progress={entry.progress} label={`Wysyłanie: ${title}`} />
          </View>
        ) : null}
      </View>
      {entry.status === 'ready' ? <Icon name="check" size={20} color="action" /> : null}
      {entry.status === 'failed' && entry.errorCode !== 'limit_reached' && entry.errorCode !== 'not_found' ? (
        <Button label="Ponów" kind="secondary" compact inline onPress={onRetry} accessibilityLabel={`Ponów wysyłanie: ${title}`} />
      ) : null}
      {entry.status === 'needs_tags' && onOpen ? <Button label="Uzupełnij" kind="secondary" compact inline onPress={onOpen} accessibilityLabel={`Uzupełnij opis: ${title}`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consent: { gap: space[4], paddingBottom: space[2] },
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
  pressed: { opacity: 0.85 },
});
