import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/controls';
import { TitleBlock, type TitleAccent } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import type { FlowStep } from '@/features/flow';
import { space } from '@/theme';

import { PendingPieces } from './PiecesNotice';

interface FrameProps {
  /** Which step of the journey this is (see `flow`); its line fills. Left out on the screens of a redo from Profile. */
  step?: FlowStep;
  /** A way back. The first screen after the account is created has none: that part of the journey cannot be undone. */
  onBack?: () => void;
  title: string;
  /** One sentence, at most. */
  lead?: string;
  /** A screen led by what it shows: the title is set in the smaller serif, so the picture or the grid carries the page. */
  visual?: boolean;
  /** A green line draws itself under the last word of the title, once (the screens that arrive at something). */
  underlined?: boolean;
  /** One word of the title in the green italic that acts out what it says, a moment after the screen has arrived. */
  accent?: TitleAccent;
  /** What opens the screen, above the title: a look, an example. */
  picture?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  testID?: string;
}

/** The frame shared by the steps before and after the account is created: where you are, what this is, the controls, the way forward. */
export function Frame({ step, onBack, title, lead, visual = false, underlined = false, accent, picture, children, footer, testID }: FrameProps) {
  const header = step ? <StepHeader step={step} onBack={onBack} /> : onBack ? (
    <View style={styles.back}>
      <IconButton icon="back" label="Back" onPress={onBack} />
    </View>
  ) : null;
  const words = <TitleBlock title={title} lead={lead} compact={visual} underlined={underlined} accent={accent} />;
  return (
    <Screen footer={footer} testID={testID}>
      <View style={styles.content}>
        {picture ? (
          <>
            {header}
            {picture}
            {words}
          </>
        ) : (
          <View style={styles.head}>
            {header}
            {words}
          </View>
        )}
        <PendingPieces />
        {children}
      </View>
    </Screen>
  );
}

/** The stack in a footer: the design spaces the buttons 10 apart, a little more than the footer's own hairline gap. */
export function Actions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  content: { gap: space[6] },
  // The design sets the title 10 under the step header (or the round back button), and the rest 24 under the title.
  head: { gap: 10 },
  back: { alignSelf: 'flex-start' },
});
