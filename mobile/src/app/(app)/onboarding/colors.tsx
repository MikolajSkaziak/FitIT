import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Card, Row } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { intro } from '@/features/colors/copy';
import { flow } from '@/features/flow';
import { Frame } from '@/features/onboarding/Frame';
import { useAdvance } from '@/features/onboarding/useAdvance';

/** Step 7 of 9, the first after the account is created, and the start of a redo from Profile: what the color analysis is, and the two ways to do it. */
export default function OnboardingColors() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const advance = useAdvance();
  const params = redo ? { redo: '1' } : {};

  return (
    <Frame
      step={redo ? undefined : flow.colors}
      onBack={redo ? () => router.back() : undefined}
      title={intro.title}
      lead={intro.lead}
      testID="onboarding-colors"
      footer={
        <>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button label={intro.selfie} icon="camera" onPress={() => router.push({ pathname: '/onboarding/selfie', params })} testID="colors-selfie" />
          <Button label={intro.quiz} kind="secondary" onPress={() => router.push({ pathname: '/onboarding/quiz', params })} testID="colors-quiz" />
          <LinkText
            label={intro.skip}
            center
            onPress={() => (redo ? router.back() : advance.to(1, '/onboarding/basics'))}
            testID="colors-skip"
          />
        </>
      }>
      <Card>
        {intro.points.map((point, index) => (
          <Row key={point.label} label={point.label} meta={point.meta} icon="flower" last={index === intro.points.length - 1} />
        ))}
      </Card>
    </Frame>
  );
}
