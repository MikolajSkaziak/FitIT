import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { login } from '@/api/account';
import { startSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Brandmark } from '@/components/brand';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { TitleBlock } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { emailError, messages } from '@/features/registration/validation';
import { space } from '@/theme';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const signIn = useMutation({
    mutationFn: (credentials: { email: string; password: string }) => login(credentials),
    onSuccess: (auth) => startSession(auth),
  });

  const submit = () => {
    const found = { email: emailError(email), password: password.length === 0 ? messages.passwordMissing : null };
    setErrors(found);
    if (!found.email && !found.password) {
      signIn.mutate({ email: email.trim(), password });
    }
  };

  return (
    <Screen
      testID="login-screen"
      footer={
        <>
          <FormError message={signIn.isError ? messageFor(signIn.error) : null} />
          <Button label="Zaloguj się" busy={signIn.isPending} onPress={submit} testID="login-submit" />
          <View style={styles.other}>
            <AppText variant="secondary" color="textSecondary">
              Nie masz konta?
            </AppText>
            <LinkText label="Załóż konto" onPress={() => router.replace('/register')} testID="login-register" />
          </View>
        </>
      }>
      <View style={styles.top}>
        <Brandmark small />
        <TitleBlock title="Dobrze Cię widzieć" lead="Zaloguj się, żeby zobaczyć zestawy na dziś." />
        <View style={styles.form}>
          <Field
            label="E-mail"
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
            label="Hasło"
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
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: space[6], paddingTop: space[2] },
  form: { gap: space[4] },
  other: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },
});
