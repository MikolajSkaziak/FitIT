import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { StyleChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';

export default function RegisterStyle() {
  const router = useRouter();
  const chosen = useRegistrationDraft((draft) => draft.styles);
  const setDraft = useRegistrationDraft((draft) => draft.set);

  return (
    <WizardStep
      step={4}
      title="Jaki styl jest Ci bliski?"
      lead="Wybierz jeden lub kilka. Zmienisz to potem w profilu."
      testID="register-style"
      footer={
        <>
          <Button label="Dalej" onPress={() => router.push('/register/weather')} testID="register-next" />
          <LinkText
            label="Pomiń"
            center
            onPress={() => {
              setDraft({ styles: [] });
              router.push('/register/weather');
            }}
          />
        </>
      }>
      <StyleChoice value={chosen} onChange={(styles) => setDraft({ styles })} />
    </WizardStep>
  );
}
