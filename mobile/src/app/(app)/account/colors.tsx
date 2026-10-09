import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';

import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { ColorResult } from '@/features/colors/ColorResult';
import { profile, resultCopy } from '@/features/colors/copy';
import { useRemoveColors } from '@/features/colors/useColors';
import { space } from '@/theme';

/** The palette in Profile: the same result view as after sign-up, with Redo and Remove. */
export default function YourColors() {
  const router = useRouter();
  const analysis = useSession((session) => session.user?.colorAnalysis ?? null);
  const remove = useRemoveColors();
  const redo = () => router.push({ pathname: '/onboarding/colors', params: { redo: '1' } });

  return (
    <Screen
      testID="your-colors"
      footer={
        analysis ? (
          <>
            <FormError message={remove.isError ? messageFor(remove.error) : null} />
            <Button label={resultCopy.redo} kind="secondary" onPress={redo} testID="colors-redo" />
            <Button
              label={resultCopy.remove}
              kind="dangerText"
              busy={remove.isPending}
              onPress={() => remove.mutate(undefined, { onSuccess: () => router.back() })}
              testID="colors-remove"
            />
            <AppText variant="meta" color="textSecondary" align="center">
              {profile.removeNote}
            </AppText>
          </>
        ) : (
          <Button label={profile.empty.action} onPress={redo} testID="colors-find" />
        )
      }>
      <View style={styles.content}>
        <BackHeader title={profile.row} onBack={() => router.back()} />
        {analysis ? (
          <ColorResult analysis={analysis} />
        ) : (
          <View style={styles.empty}>
            <AppText variant="heading" accessibilityRole="header">
              {profile.empty.title}
            </AppText>
            <AppText color="textSecondary">{profile.empty.text}</AppText>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  empty: { gap: space[2] },
});
