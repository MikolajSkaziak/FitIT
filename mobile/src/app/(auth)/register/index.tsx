import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { GenderChoice } from '@/components/choices';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';

/**
 * The first step, and the only question asked before anything is given: who is being dressed. It decides which photos the
 * next steps show, so nothing is preselected and it cannot be skipped, but "Prefer not to say" is an answer like the others.
 * It is kept in the draft and sent when the account is created.
 */
export default function RegisterGender() {
  const router = useRouter();
  const gender = useRegistrationDraft((draft) => draft.gender);
  const setDraft = useRegistrationDraft((draft) => draft.set);

  return (
    <WizardStep
      step="gender"
      title="Who are we dressing?"
      accent={{ word: 'dressing', act: 'letters' }}
      lead="It decides which styles and body shapes you see, and you can change it later in Profile."
      testID="register-gender"
      footer={<Button label="Continue" disabled={gender === null} onPress={() => router.push('/register/style')} testID="register-next" />}>
      <GenderChoice value={gender} onChange={(chosen) => setDraft({ gender: chosen })} />
    </WizardStep>
  );
}
