import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { messageFor } from '@/copy/errors';
import { useCamera } from '@/features/camera/session';
import { selfie } from '@/features/colors/copy';
import { useAiConsent } from '@/features/consent/session';
import { useAnalyzeSelfie } from '@/features/colors/useColors';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { pickFromGallery, type LocalPhoto } from '@/features/wardrobe/photos';
import { radius, space, useTheme } from '@/theme';

/** The selfie, from the front camera or the library. The line about what happens to it sits right under the buttons, always. */
export default function OnboardingSelfie() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const params = redo ? { redo: '1' } : {};
  const theme = useTheme();
  const analyze = useAnalyzeSelfie();
  const openCamera = useCamera();
  const askConsent = useAiConsent();

  const run = (photo: LocalPhoto) => analyze.mutate(photo, { onSuccess: () => router.push({ pathname: '/onboarding/palette', params }) });

  const fromCamera = async () => {
    // A photo of the face goes out: its own consent sheet comes first, then the camera.
    if (!(await askConsent('selfie'))) {
      return;
    }

    // The camera screen asks for the permission itself and shows the still before it is used.
    const [photo] = await openCamera({ mode: 'selfie' });
    if (photo) {
      run(photo);
    }
  };

  const fromLibrary = async () => {
    if (!(await askConsent('selfie'))) {
      return;
    }

    const [photo] = await pickFromGallery(1);
    if (photo) {
      run(photo);
    }
  };

  return (
    <Frame
      step={redo ? undefined : 'colors'}
      onBack={() => router.back()}
      title={selfie.title}
      lead={selfie.lead}
      testID="onboarding-selfie"
      footer={
        <Actions>
          <FormError message={analyze.isError ? messageFor(analyze.error) : null} />
          {analyze.isPending ? (
            <AppText variant="secondary" color="textSecondary" align="center" accessibilityRole="progressbar" accessibilityLabel={selfie.working}>
              {selfie.working}
            </AppText>
          ) : null}
          <Button label={selfie.camera} icon="camera" busy={analyze.isPending} onPress={() => void fromCamera()} testID="selfie-camera" />
          <Button label={selfie.library} kind="secondary" icon="image" disabled={analyze.isPending} onPress={() => void fromLibrary()} testID="selfie-library" />
          <AppText variant="caption" color="textSecondary" align="center" testID="selfie-notice">
            {selfie.notice}
          </AppText>
          <Button label={selfie.quiz} kind="text" compact onPress={() => router.replace({ pathname: '/onboarding/quiz', params })} testID="selfie-quiz" />
        </Actions>
      }>
      <View style={[styles.hold, { backgroundColor: theme.well }]}>
        <Icon name="camera" size={30} color="onWellChip" />
        <AppText variant="secondary" color="onWellChip" align="center">
          {selfie.tip}
        </AppText>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  // The design's holding place for the example selfie: a well with a line icon and the one tip.
  hold: { minHeight: 240, borderRadius: radius.well, alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: space[6], paddingVertical: space[4] },
});
