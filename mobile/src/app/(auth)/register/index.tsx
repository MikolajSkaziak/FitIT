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
import { flow } from '@/features/flow';
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
      step={flow.account}
      title="Create your account"
      lead="Start with your email and a password."
      testID="register-account"
      footer={
        <>
          <FormError message={check.isError ? messageFor(check.error) : null} />
          <Button label="Next" busy={check.isPending} onPress={next} testID="register-next" />
          <LinkText label="I already have an account" center onPress={() => router.replace('/login')} />
        </>
      }>
      <View style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={(text) => {
            setDraft({ email: text });
            setErrors((current) => ({ ...current, email: null }));
            check.reset();
          }}
          error={errors.email}
          placeholder="name@example.com"
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
          label="Password"
          value={password}
          onChangeText={(text) => {
            setDraft({ password: text });
            setErrors((current) => ({ ...current, password: null }));
          }}
          error={errors.password}
          helper="At least 8 characters."
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
