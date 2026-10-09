import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/controls';
import { TitleBlock } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { space } from '@/theme';

interface FrameProps {
  /** Which step of the one journey this is (see `flow`); its bar fills. Left out on the screens of a redo from Profile. */
  step?: number;
  /** A way back. The first screen after the account is created has none: that part of the journey cannot be undone. */
  onBack?: () => void;
  title: string;
  lead?: string;
  children?: ReactNode;
  footer: ReactNode;
  testID?: string;
}

/** The frame shared by the screens after the account is created (same header and count as sign-up): where you are, what this is, the controls, the way forward. */
export function Frame({ step, onBack, title, lead, children, footer, testID }: FrameProps) {
  return (
    <Screen footer={footer} testID={testID}>
      <View style={styles.content}>
        {step ? <StepHeader step={step} onBack={onBack} /> : onBack ? (
          <View style={styles.back}>
            <IconButton icon="back" label="Back" onPress={onBack} />
          </View>
        ) : null}
        <TitleBlock title={title} lead={lead} />
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  // The 24 icon sits in a 44 target; pulling it out by 10 lines the icon up with the text edge below.
  back: { alignSelf: 'flex-start', marginLeft: -10 },
});
