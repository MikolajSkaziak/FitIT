import { useMutation } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { confirmPasswordReset } from '@/api/account';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { resetMessageFor } from '@/copy/errors';
import { useResetDraft } from '@/features/profile/passwordReset';
import { digitsOnly, limits, passwordError, resetCodeError } from '@/features/registration/validation';
import { space } from '@/theme';

/** Step two: the code from the e-mail and the new password. The server ends every session, so the way on is to sign in. */
export default function ResetCode() {
  const router = useRouter();
  const email = useResetDraft((draft) => draft.email);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ code?: string | null; password?: string | null }>({});
  const confirm = useMutation({
    mutationFn: (body: { email: string; code: string; newPassword: string }) => confirmPasswordReset(body),
    // The login screen gets the address back and says the password changed; it is not a route parameter, which would put it in a URL.
    onSuccess: () => router.dismissTo({ pathname: '/login', params: { reset: '1' } }),
  });

  // A reload or a link can land here with no address; the first step is where it is asked for.
  if (!email.trim()) {
    return <Redirect href="/reset" />;
  }

  const submit = () => {
    const found = { code: resetCodeError(code), password: passwordError(password) };
    setErrors(found);
    if (!found.code && !found.password) {
      confirm.mutate({ email: email.trim(), code, newPassword: password });
    }
  };

  return (
    <Screen
      testID="reset-code"
      footer={
        <>
          <FormError message={confirm.isError ? resetMessageFor(confirm.error) : null} />
          <Button label="Set new password" busy={confirm.isPending} onPress={submit} testID="reset-confirm" />
          <LinkText label="Request a new code" center onPress={() => router.back()} testID="reset-again" />
        </>
      }>
      <View style={styles.content}>
        <BackHeader title="Enter the code" onBack={() => router.back()} />
        <AppText color="textSecondary">{`If there’s an account for ${email.trim()}, a code is on its way. Check your spam folder too.`}</AppText>
        <Field
          label="Six-digit code"
          value={code}
          onChangeText={(text) => {
            setCode(digitsOnly(text));
            setErrors((current) => ({ ...current, code: null }));
            confirm.reset();
          }}
          error={errors.code}
          autoFocus
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={limits.resetCode}
          testID="reset-code-field"
        />
        <PasswordField
          isNew
          label="New password"
          helper={`At least ${limits.passwordMin} characters.`}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors((current) => ({ ...current, password: null }));
            confirm.reset();
          }}
          error={errors.password}
          returnKeyType="done"
          onSubmitEditing={submit}
          testID="reset-password"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
});
