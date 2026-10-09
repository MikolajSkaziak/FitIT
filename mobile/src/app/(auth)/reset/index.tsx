import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requestPasswordReset } from '@/api/account';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { resetMessageFor } from '@/copy/errors';
import { useResetDraft } from '@/features/profile/passwordReset';
import { emailError } from '@/features/registration/validation';
import { space } from '@/theme';

/** Step one of a forgotten password: the address the code goes to. The answer is the same for every address. */
export default function ResetRequest() {
  const router = useRouter();
  const email = useResetDraft((draft) => draft.email);
  const setEmail = useResetDraft((draft) => draft.set);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (address: string) => requestPasswordReset(address),
    onSuccess: () => router.push('/reset/code'),
  });

  const submit = () => {
    const found = emailError(email);
    setError(found);
    if (!found) {
      send.mutate(email.trim());
    }
  };

  return (
    <Screen
      testID="reset-request"
      footer={
        <>
          <FormError message={send.isError ? resetMessageFor(send.error) : null} />
          <Button label="Send code" busy={send.isPending} onPress={submit} testID="reset-send" />
        </>
      }>
      <View style={styles.content}>
        <BackHeader title="Forgot your password?" onBack={() => router.back()} />
        <AppText color="textSecondary">Enter the email you signed up with. If there’s an account, we’ll send it a six-digit code.</AppText>
        <Field
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
            send.reset();
          }}
          error={error}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
          returnKeyType="send"
          onSubmitEditing={submit}
          testID="reset-email"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
});
