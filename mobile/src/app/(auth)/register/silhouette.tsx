import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { SilhouettePicker } from '@/components/SilhouettePicker';
import { useRegistrationDraft } from '@/features/registration/draft';
import { messages } from '@/features/registration/validation';
import { WizardStep } from '@/features/registration/WizardStep';

export default function RegisterSilhouette() {
  const router = useRouter();
  const gender = useRegistrationDraft((draft) => draft.gender);
  const avatarId = useRegistrationDraft((draft) => draft.avatarId);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const [missing, setMissing] = useState(false);

  // Silhouettes depend on the gender chosen one step earlier.
  if (!gender) {
    return <Redirect href="/register/about" />;
  }

  return (
    <WizardStep
      step={3}
      title="Wybierz typ sylwetki"
      lead="Pokażemy na niej Twoje zestawy. Wybierz najbliższą swojej, zmienisz ją w profilu."
      testID="register-silhouette"
      footer={
        <>
          <FormError message={missing && !avatarId ? messages.avatarMissing : null} />
          <Button
            label="Dalej"
            onPress={() => {
              if (avatarId) {
                router.push('/register/style');
              } else {
                setMissing(true);
              }
            }}
            testID="register-next"
          />
        </>
      }>
      <SilhouettePicker gender={gender} value={avatarId} onChange={(avatar) => setDraft({ avatarId: avatar.id })} />
    </WizardStep>
  );
}
