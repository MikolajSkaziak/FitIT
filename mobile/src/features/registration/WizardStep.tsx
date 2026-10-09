import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TitleBlock } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { space } from '@/theme';

interface WizardStepProps {
  step: number;
  title: string;
  lead: string;
  children: ReactNode;
  /** The button that moves on, and whatever sits around it. Stays above the keyboard. */
  footer: ReactNode;
  testID?: string;
}

/** The shared frame of a registration step: where you are, what is asked, the controls, the way forward. */
export function WizardStep({ step, title, lead, children, footer, testID }: WizardStepProps) {
  const router = useRouter();
  return (
    <Screen footer={footer} testID={testID}>
      <View style={styles.content}>
        <StepHeader step={step} onBack={() => router.back()} />
        <TitleBlock title={title} lead={lead} />
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
});
