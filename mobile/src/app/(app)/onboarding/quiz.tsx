import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/controls';
import { FormError, Labeled } from '@/components/forms';
import { SwatchPicker } from '@/components/SwatchPicker';
import { messageFor } from '@/copy/errors';
import { quiz as copy } from '@/features/colors/copy';
import { completeQuiz, emptyQuiz, eyeOptions, hairOptions, skinToneOptions, undertoneOptions, type QuizDraft } from '@/features/colors/quiz';
import { useAnalyzeAnswers } from '@/features/colors/useColors';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { space } from '@/theme';

/** The questions that replace the photo: skin tone, undertone, hair and eyes. Colors are answered with round swatches, the undertone with a short choice. */
export default function OnboardingQuiz() {
  const router = useRouter();
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const [draft, setDraft] = useState<QuizDraft>(emptyQuiz);
  const analyze = useAnalyzeAnswers();
  const answers = completeQuiz(draft);

  const show = () => {
    if (answers) {
      analyze.mutate(answers, { onSuccess: () => router.push({ pathname: '/onboarding/palette', params: redo ? { redo: '1' } : {} }) });
    }
  };

  return (
    <Frame
      step={redo ? undefined : 'colors'}
      onBack={() => router.back()}
      title={copy.title}
      lead={copy.lead}
      testID="onboarding-quiz"
      footer={
        <Actions>
          <FormError message={analyze.isError ? messageFor(analyze.error) : null} />
          {answers ? null : (
            <AppText variant="caption" color="textSecondary" align="center">
              {copy.missing}
            </AppText>
          )}
          <Button label={copy.action} disabled={!answers} busy={analyze.isPending} onPress={show} testID="quiz-show" />
        </Actions>
      }>
      <View style={styles.questions}>
        <Labeled label={copy.skinTone.label}>
          <SwatchPicker label={copy.skinTone.label} options={skinToneOptions} value={draft.skinTone} onChange={(skinTone) => setDraft({ ...draft, skinTone })} testID="quiz-skin" />
        </Labeled>
        <Labeled label={copy.undertone.label} helper={copy.undertone.helper}>
          <Segmented label={copy.undertone.label} options={undertoneOptions} value={draft.undertone} onChange={(undertone) => setDraft({ ...draft, undertone })} />
        </Labeled>
        <Labeled label={copy.hair.label} helper={copy.hair.helper}>
          <SwatchPicker label={copy.hair.label} options={hairOptions} value={draft.hair} onChange={(hair) => setDraft({ ...draft, hair })} testID="quiz-hair" />
        </Labeled>
        <Labeled label={copy.eyes.label}>
          <SwatchPicker label={copy.eyes.label} options={eyeOptions} value={draft.eyes} onChange={(eyes) => setDraft({ ...draft, eyes })} testID="quiz-eyes" />
        </Labeled>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  questions: { gap: space[6] },
});
