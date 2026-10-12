import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import type { TitleAccent } from '@/components/headers';
import type { FlowStep } from '@/features/flow';
import { Frame } from '@/features/onboarding/Frame';

interface WizardStepProps {
  step: FlowStep;
  title: string;
  /** One sentence, at most. */
  lead?: string;
  /** Led by its picture or grid: the title is set in the smaller serif. */
  visual?: boolean;
  /** A green line draws itself under the last word of the title, once. */
  underlined?: boolean;
  /** One word of the title in the green italic that acts out what it says. */
  accent?: TitleAccent;
  /** What opens the screen, above the title. */
  picture?: ReactNode;
  children?: ReactNode;
  /** The button that moves on, and whatever sits around it. Stays above the keyboard. */
  footer: ReactNode;
  testID?: string;
}

/** A step before the account exists: the shared frame of the journey, with Back leading to the screen before it. */
export function WizardStep(props: WizardStepProps) {
  const router = useRouter();
  return <Frame {...props} onBack={() => router.back()} />;
}
