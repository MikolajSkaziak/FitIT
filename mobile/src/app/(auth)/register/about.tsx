import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/controls';
import { Field } from '@/components/Field';
import { BirthDateField, Labeled } from '@/components/forms';
import { genderOptions } from '@/copy/labels';
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
      step={2}
      title="Powiedz coś o sobie"
      lead="Dzięki temu zwrócimy się do Ciebie po imieniu."
      testID="register-about"
      footer={<Button label="Dalej" onPress={next} testID="register-next" />}>
      <View style={styles.form}>
        <Field
          label="Imię"
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
          onChangeText={(text) => {
            setDraft({ birthDate: text });
            setErrors((current) => ({ ...current, birthDate: null }));
          }}
          error={errors.birthDate}
          helper="Potrzebna do potwierdzenia wieku. Nikomu jej nie pokazujemy."
          testID="register-birth-date"
        />
        <Labeled label="Płeć" error={errors.gender} helper="Od niej zależy, które typy sylwetek pokażemy w następnym kroku.">
          <Segmented
            label="Płeć"
            options={genderOptions}
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
