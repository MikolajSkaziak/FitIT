import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { login } from '@/api/account';
import { startSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { useResetDraft } from '@/features/profile/passwordReset';
import { AuthScreen } from '@/features/registration/AuthScreen';
import { emailError, messages } from '@/features/registration/validation';
import { space } from '@/theme';

export default function Login() {
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const justReset = reset === '1';
  // The address lives in the reset draft too: what is typed here is what the reset asks about, and what the reset leaves is here when it is done.
  const email = useResetDraft((draft) => draft.email);
  const setEmail = useResetDraft((draft) => draft.set);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const signIn = useMutation({
    mutationFn: (credentials: { email: string; password: string }) => login(credentials),
    onSuccess: (auth) => {
      useResetDraft.getState().reset();
      return startSession(auth);
    },
  });

  const submit = () => {
    const found = { email: emailError(email), password: password.length === 0 ? messages.passwordMissing : null };
    setErrors(found);
    if (!found.email && !found.password) {
      signIn.mutate({ email: email.trim(), password });
    }
  };

  return (
    <AuthScreen
      testID="login-screen"
      eyebrow="Welcome back"
      title="Log in"
      lead={justReset ? 'Your password is updated. Log in with the new one.' : undefined}
      onBack={() => router.back()}
      footer={
        <>
          <FormError message={signIn.isError ? messageFor(signIn.error) : null} />
          <Button label="Log in" busy={signIn.isPending} onPress={submit} testID="login-submit" />
          <View style={styles.other}>
            <AppText variant="secondary" color="textSecondary">
              Don’t have an account?
            </AppText>
            <LinkText label="Create account" onPress={() => router.replace('/register')} testID="login-register" />
          </View>
        </>
      }>
      <Field
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          signIn.reset();
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        returnKeyType="next"
        testID="login-email"
      />
      <PasswordField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          signIn.reset();
        }}
        error={errors.password}
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="login-password"
      />
      <LinkText label="Forgot your password?" onPress={() => router.push('/reset')} testID="login-forgot" />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  other: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },
});
