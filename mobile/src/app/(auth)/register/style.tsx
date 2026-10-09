import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { StyleChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { flow } from '@/features/flow';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';

export default function RegisterStyle() {
  const router = useRouter();
  const chosen = useRegistrationDraft((draft) => draft.styles);
  const gender = useRegistrationDraft((draft) => draft.gender);
  const setDraft = useRegistrationDraft((draft) => draft.set);

  return (
    <WizardStep
      step={flow.styles}
      title="Which styles do you like?"
      lead="Choose one or several. You can change this later in your profile."
      testID="register-style"
      footer={
        <>
          <Button label="Next" onPress={() => router.push('/register/weather')} testID="register-next" />
          <LinkText
            label="Skip"
            center
            onPress={() => {
              setDraft({ styles: [] });
              router.push('/register/weather');
            }}
          />
        </>
      }>
      <StyleChoice value={chosen} gender={gender} onChange={(styles) => setDraft({ styles })} />
    </WizardStep>
  );
}
