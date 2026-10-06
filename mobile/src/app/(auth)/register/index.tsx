import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { checkEmail } from '@/api/account';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { useRegistrationDraft } from '@/features/registration/draft';
import { emailError, messages, passwordError } from '@/features/registration/validation';
import { WizardStep } from '@/features/registration/WizardStep';
import { space } from '@/theme';

export default function RegisterAccount() {
  const router = useRouter();
  const email = useRegistrationDraft((draft) => draft.email);
  const password = useRegistrationDraft((draft) => draft.password);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});

  // Asking now whether the address is free spares four more steps that would end in "this address is taken".
  const check = useMutation({
    mutationFn: (address: string) => checkEmail(address),
    onSuccess: (available) => {
      if (available) {
        router.push('/register/about');
      } else {
        setErrors((current) => ({ ...current, email: messages.emailTaken }));
      }
    },
  });

  const next = () => {
    const found = { email: emailError(email), password: passwordError(password) };
    setErrors(found);
    if (!found.email && !found.password) {
      check.mutate(email.trim());
    }
  };

  return (
    <WizardStep
      step={1}
      title="Załóż konto"
      lead="Zaczniemy od adresu e-mail i hasła."
      testID="register-account"
      footer={
        <>
          <FormError message={check.isError ? messageFor(check.error) : null} />
          <Button label="Dalej" busy={check.isPending} onPress={next} testID="register-next" />
          <LinkText label="Mam już konto" center onPress={() => router.replace('/login')} />
        </>
      }>
      <View style={styles.form}>
        <Field
          label="E-mail"
          value={email}
          onChangeText={(text) => {
            setDraft({ email: text });
            setErrors((current) => ({ ...current, email: null }));
            check.reset();
          }}
          error={errors.email}
          placeholder="np. ola@poczta.pl"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
          returnKeyType="next"
          testID="register-email"
        />
        <PasswordField
          isNew
          label="Hasło"
          value={password}
          onChangeText={(text) => {
            setDraft({ password: text });
            setErrors((current) => ({ ...current, password: null }));
          }}
          error={errors.password}
          helper="Co najmniej 8 znaków."
          returnKeyType="go"
          onSubmitEditing={next}
          testID="register-password"
        />
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
});
