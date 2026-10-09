import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { GenderChoice } from '@/components/choices';
import { Field } from '@/components/Field';
import { BirthDateField, Labeled } from '@/components/forms';
import { flow } from '@/features/flow';
import { useRegistrationDraft } from '@/features/registration/draft';
import { checkBirthDate, limits, messages, nameError } from '@/features/registration/validation';
import { WizardStep } from '@/features/registration/WizardStep';
import { space } from '@/theme';

export default function RegisterAbout() {
  const router = useRouter();
  const displayName = useRegistrationDraft((draft) => draft.displayName);
  const birthDate = useRegistrationDraft((draft) => draft.birthDate);
  const gender = useRegistrationDraft((draft) => draft.gender);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const [errors, setErrors] = useState<{ name?: string | null; birthDate?: string | null; gender?: string | null }>({});

  const next = () => {
    const found = { name: nameError(displayName), birthDate: checkBirthDate(birthDate).error, gender: gender ? null : messages.genderMissing };
    setErrors(found);
    if (!found.name && !found.birthDate && !found.gender) {
      router.push('/register/silhouette');
    }
  };

  return (
    <WizardStep
      step={flow.about}
      title="Tell us about yourself"
      lead="We’ll use your name to greet you."
      testID="register-about"
      footer={<Button label="Next" onPress={next} testID="register-next" />}>
      <View style={styles.form}>
        <Field
          label="Name"
          value={displayName}
          onChangeText={(text) => {
            setDraft({ displayName: text });
            setErrors((current) => ({ ...current, name: null }));
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
            setErrors((current) => ({ ...current, birthDate: null }));
          }}
          error={errors.birthDate}
          helper="We only use it to check your age. No one else sees it."
          testID="register-birth-date"
        />
        <Labeled label="Gender" error={errors.gender} helper="This decides which body shapes we show you next. Non-binary and prefer not to say show all of them.">
          <GenderChoice
            value={gender}
            onChange={(value) => {
              setDraft({ gender: value });
              setErrors((current) => ({ ...current, gender: null }));
            }}
          />
        </Labeled>
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
});
