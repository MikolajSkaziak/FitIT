import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { StyleChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';

/**
 * The second step: photos of styles to tap, each shown on a woman or a man by the gender chosen in the first step. For
 * non-binary and "prefer not to say" the photos show a woman and a man in turn. Skippable; the picks stay if the person
 * goes back and changes the gender, only the photos change.
 */
export default function RegisterStyles() {
  const router = useRouter();
  const gender = useRegistrationDraft((draft) => draft.gender);
  const chosen = useRegistrationDraft((draft) => draft.styles);
  const setDraft = useRegistrationDraft((draft) => draft.set);

  return (
    <WizardStep
      step="styles"
      visual
      title="What do you like to wear?"
      accent={{ word: 'wear', act: 'sway' }}
      lead="Pick as many as you like, and touch and hold a photo to see it larger."
      testID="register-styles"
      footer={
        <>
          <Button label="Continue" onPress={() => router.push('/register/basics')} testID="register-next" />
          <LinkText
            label="Skip for now"
            center
            onPress={() => {
              setDraft({ styles: [] });
              router.push('/register/basics');
            }}
            testID="register-skip-styles"
          />
        </>
      }>
      <StyleChoice value={chosen} gender={gender} onChange={(styles) => setDraft({ styles })} />
    </WizardStep>
  );
}
