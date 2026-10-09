import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { IconButton, LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { messageFor } from '@/copy/errors';
import { ColorResult } from '@/features/colors/ColorResult';
import { resultCopy } from '@/features/colors/copy';
import { flow } from '@/features/flow';
import { useAdvance } from '@/features/onboarding/useAdvance';
import { space } from '@/theme';

/** The result: the type, its palette, a way to redo it, and the way forward. Still step 7 of 9 in the journey. */
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
        <>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button
            label={redo ? resultCopy.done : resultCopy.continue}
            busy={advance.pending}
            onPress={() => (redo ? router.dismissTo('/account/colors') : advance.to(1, '/onboarding/basics'))}
            testID="palette-continue"
          />
          <LinkText label={resultCopy.redo} center onPress={() => router.dismissTo({ pathname: '/onboarding/colors', params: redo ? { redo: '1' } : {} })} testID="palette-redo" />
        </>
      }>
      <View style={styles.content}>
        {redo ? (
          <View style={styles.back}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
        ) : (
          <StepHeader step={flow.colors} onBack={() => router.back()} />
        )}
        <ColorResult analysis={analysis} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
  back: { alignSelf: 'flex-start', marginLeft: -10 },
});
