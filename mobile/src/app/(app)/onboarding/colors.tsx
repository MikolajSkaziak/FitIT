import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { ColorExample } from '@/features/colors/ColorExample';
import { intro } from '@/features/colors/copy';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { useAdvance } from '@/features/onboarding/useAdvance';

/** The third step after the account, and the start of a redo from Profile: an example of what the color analysis gives, one sentence about the photo, and the two ways to do it. */
export default function OnboardingColors() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const advance = useAdvance();
  const params = redo ? { redo: '1' } : {};

  return (
    <Frame
      step={redo ? undefined : 'colors'}
      onBack={redo ? () => router.back() : () => advance.back('/onboarding/colors', false)}
      visual
      picture={<ColorExample />}
      title={intro.title}
      accent={{ word: 'colors', act: 'letters' }}
      lead={intro.lead}
      testID="onboarding-colors"
      footer={
        <Actions>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button label={intro.selfie} icon="camera" onPress={() => router.push({ pathname: '/onboarding/selfie', params })} testID="colors-selfie" />
          <Button label={intro.quiz} kind="secondary" onPress={() => router.push({ pathname: '/onboarding/quiz', params })} testID="colors-quiz" />
          <Button
            label={intro.skip}
            kind="text"
            compact
            onPress={() => (redo ? router.back() : advance.to(3, '/onboarding/done'))}
            testID="colors-skip"
          />
        </Actions>
      }
    />
  );
}
