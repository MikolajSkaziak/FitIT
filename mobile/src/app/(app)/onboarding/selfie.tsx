import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Fade } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import { selfie } from '@/features/colors/copy';
import { useAnalyzeSelfie } from '@/features/colors/useColors';
import { flow } from '@/features/flow';
import { Frame } from '@/features/onboarding/Frame';
import { pickFromGallery, takePhoto, type LocalPhoto } from '@/features/wardrobe/photos';
import { space } from '@/theme';

/** The selfie, from the front camera or the library. The line about what happens to it sits right under the buttons, always. */
export default function OnboardingSelfie() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const params = redo ? { redo: '1' } : {};
  const analyze = useAnalyzeSelfie();
  const [denied, setDenied] = useState(false);

  const run = (photo: LocalPhoto) => analyze.mutate(photo, { onSuccess: () => router.push({ pathname: '/onboarding/palette', params }) });

  const fromCamera = async () => {
    const shot = await takePhoto({ front: true });
    setDenied(shot.kind === 'denied');
    if (shot.kind === 'taken') {
      run(shot.photo);
    }
  };

  const fromLibrary = async () => {
    setDenied(false);
    const [photo] = await pickFromGallery(1);
    if (photo) {
      run(photo);
    }
  };

  return (
    <Frame
      step={redo ? undefined : flow.colors}
      onBack={() => router.back()}
      title={selfie.title}
      lead={selfie.lead}
      testID="onboarding-selfie"
      footer={
        <>
          <FormError message={analyze.isError ? messageFor(analyze.error) : null} />
          {analyze.isPending ? (
            <AppText color="textSecondary" align="center" accessibilityRole="progressbar" accessibilityLabel={selfie.working}>
              {selfie.working}
            </AppText>
          ) : null}
          <Button label={selfie.camera} icon="camera" busy={analyze.isPending} onPress={() => void fromCamera()} testID="selfie-camera" />
          <Button label={selfie.library} kind="secondary" icon="image" disabled={analyze.isPending} onPress={() => void fromLibrary()} testID="selfie-library" />
          <AppText variant="meta" color="textSecondary" align="center" testID="selfie-notice">
            {selfie.notice}
          </AppText>
          <LinkText label={selfie.quiz} center onPress={() => router.replace({ pathname: '/onboarding/quiz', params })} testID="selfie-quiz" />
        </>
      }>
      <View style={styles.tips}>
        <AppText>{selfie.tip}</AppText>
        {denied ? (
          <Fade key="denied" style={styles.denied}>
            <AppText variant="secondary" color="danger" accessibilityRole="alert">
              {selfie.cameraDenied}
            </AppText>
            <Button label={selfie.openSettings} kind="secondary" compact inline onPress={() => void Linking.openSettings()} />
          </Fade>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  tips: { gap: space[3] },
  denied: { gap: space[2] },
});
