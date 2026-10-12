import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { codeOf } from '@/api/problem';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { BirthDateField, FormError, PasswordField } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { useRegistrationDraft } from '@/features/registration/draft';
import { LegalNote } from '@/features/registration/LegalNote';
import { useRegister } from '@/features/registration/useRegister';
import { checkBirthDate, emailError, limits, messages, nameError, passwordError } from '@/features/registration/validation';
import { WizardStep } from '@/features/registration/WizardStep';
import { size } from '@/theme';

type Errors = Partial<Record<'name' | 'birthDate' | 'email' | 'password', string | null>>;

/**
 * The sixth step, and the only form: a name, a birth date for the age check, an email and a password. Its button
 * creates the account (the agreement to the Terms and Privacy Policy, not to AI processing: that is asked before the first photo) and sends along what was picked on the way here.
 */
export default function RegisterAccount() {
  const displayName = useRegistrationDraft((draft) => draft.displayName);
  const birthDate = useRegistrationDraft((draft) => draft.birthDate);
  const email = useRegistrationDraft((draft) => draft.email);
  const password = useRegistrationDraft((draft) => draft.password);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const registration = useRegister();
  const [errors, setErrors] = useState<Errors>({});

  const edit = (field: keyof Errors) => {
    setErrors((current) => ({ ...current, [field]: null }));
    registration.clearError();
  };

  const create = () => {
    const found: Errors = { name: nameError(displayName), birthDate: checkBirthDate(birthDate).error, email: emailError(email), password: passwordError(password) };
    setErrors(found);
    if (!registration.pending && Object.values(found).every((error) => !error)) {
      registration.submit();
    }
  };

  // An address that is taken is said at the address; anything else the server refuses, above the button.
  const taken = registration.error !== null && codeOf(registration.error) === 'email_taken';
  return (
    <WizardStep
      step="account"
      title={'Create your\naccount'}
      lead="It keeps what you just picked, and you can change all of it later."
      testID="register-account"
      footer={
        <>
          <FormError message={registration.error && !taken ? messageFor(registration.error) : null} />
          <Button label="Create account" busy={registration.pending} onPress={create} testID="register-submit" />
          <LegalNote />
        </>
      }>
      <View style={styles.form}>
        <Field
          label="Name"
          value={displayName}
          onChangeText={(text) => {
            setDraft({ displayName: text });
            edit('name');
          }}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={limits.name}
          returnKeyType="next"
          testID="register-name"
        />
        <BirthDateField
          value={birthDate}
          onChange={(parts) => {
            setDraft({ birthDate: parts });
            edit('birthDate');
          }}
          error={errors.birthDate}
          helper="Only used to check your age."
          testID="register-birth-date"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={(text) => {
            setDraft({ email: text });
            edit('email');
          }}
          error={errors.email ?? (taken ? messages.emailTaken : null)}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={limits.email}
          returnKeyType="next"
          testID="register-email"
        />
        <PasswordField
          isNew
          label="Password"
          value={password}
          onChangeText={(text) => {
            setDraft({ password: text });
            edit('password');
          }}
          error={errors.password}
          placeholder="At least 8 characters"
          returnKeyType="go"
          onSubmitEditing={create}
          testID="register-password"
        />
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  form: { gap: size.gutter },
});
