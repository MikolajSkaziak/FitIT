import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { SilhouettePicker } from '@/components/SilhouettePicker';
import { flow } from '@/features/flow';
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
      step={flow.silhouette}
      title="Pick a body shape"
      lead="It’s only used for the try-on picture, so outfits look right on you. Choose the closest match. You can change it any time in Profile."
      testID="register-silhouette"
      footer={
        <>
          <FormError message={missing && !avatarId ? messages.avatarMissing : null} />
          <Button
            label="Next"
            onPress={() => {
              if (avatarId) {
                router.push('/register/fit');
              } else {
                setMissing(true);
              }
            }}
            testID="register-next"
          />
        </>
      }>
      <SilhouettePicker gender={gender} value={avatarId} onChange={(avatar) => setDraft({ avatarId: avatar.id, avatarGender: avatar.gender })} />
    </WizardStep>
  );
}
