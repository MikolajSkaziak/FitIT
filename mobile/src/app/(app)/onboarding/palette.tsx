import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { messageFor } from '@/copy/errors';
import { ColorResult } from '@/features/colors/ColorResult';
import { resultCopy } from '@/features/colors/copy';
import { Actions } from '@/features/onboarding/Frame';
import { useAdvance } from '@/features/onboarding/useAdvance';

/** The result: the type, its palette, a way to redo it, and the way forward. Still the colors step of the journey. */
export default function OnboardingPalette() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const analysis = useSession((session) => session.user?.colorAnalysis ?? null);
  const advance = useAdvance();

  if (!analysis) {
    return <Redirect href="/onboarding/colors" />;
  }

  return (
    <Screen
      testID="onboarding-palette"
      footer={
        <Actions>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button
            label={redo ? resultCopy.done : resultCopy.continue}
            busy={advance.pending}
            onPress={() => (redo ? router.dismissTo('/account/colors') : advance.to(3, '/onboarding/done'))}
            testID="palette-continue"
          />
          <Button
            label={resultCopy.retake}
            kind="text"
            compact
            onPress={() => router.dismissTo({ pathname: '/onboarding/colors', params: redo ? { redo: '1' } : {} })}
            testID="palette-redo"
          />
        </Actions>
      }>
      <View style={styles.content}>
        {redo ? (
          <View style={styles.back}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
        ) : (
          <StepHeader step="colors" onBack={() => router.back()} />
        )}
        <ColorResult analysis={analysis} eyebrow={redo ? resultCopy.eyebrow : undefined} />
      </View>
    </Screen>
  );
}

// The design sets the type's name 10 under the step header (or the round back button).
const styles = StyleSheet.create({
  content: { gap: 10 },
  back: { alignSelf: 'flex-start' },
});
