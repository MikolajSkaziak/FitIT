import { useMutation } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { confirmPasswordReset } from '@/api/account';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError, PasswordField } from '@/components/forms';
import { resetMessageFor } from '@/copy/errors';
import { useResetDraft } from '@/features/profile/passwordReset';
import { AuthScreen } from '@/features/registration/AuthScreen';
import { CodeField } from '@/features/registration/CodeField';
import { digitsOnly, limits, passwordError, resetCodeError } from '@/features/registration/validation';

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
    <AuthScreen
      testID="reset-code"
      eyebrow="Check your email"
      title="Enter the code"
      lead={`If there’s an account for ${email.trim()}, a code is on its way. Check your spam folder too.`}
      onBack={() => router.back()}
      footer={
        <>
          <FormError message={confirm.isError ? resetMessageFor(confirm.error) : null} />
          <Button label="Set new password" busy={confirm.isPending} onPress={submit} testID="reset-confirm" />
          <LinkText label="Request a new code" center onPress={() => router.back()} testID="reset-again" />
        </>
      }>
      <CodeField
        label="Six-digit code"
        length={limits.resetCode}
        value={code}
        onChangeText={(text) => {
          setCode(digitsOnly(text));
          setErrors((current) => ({ ...current, code: null }));
          confirm.reset();
        }}
        error={errors.code}
        autoFocus
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        testID="reset-code-field"
      />
      <PasswordField
        isNew
        label="New password"
        placeholder={`At least ${limits.passwordMin} characters`}
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
    </AuthScreen>
  );
}
