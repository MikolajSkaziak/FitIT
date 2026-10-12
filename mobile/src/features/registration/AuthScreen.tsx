import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TitleBlock } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { size, space } from '@/theme';

import { AuthHero } from './AuthHero';

interface AuthScreenProps {
  /** The small uppercase label above the title. */
  eyebrow: string;
  title: string;
  lead?: string;
  onBack: () => void;
  /** The fields under the title. */
  children: ReactNode;
  /** The button that moves on, and whatever sits around it. */
  footer: ReactNode;
  testID?: string;
}

/** The frame of log in and password reset: the garments on their well with a way back, the title, the fields, the button underneath. */
export function AuthScreen({ eyebrow, title, lead, onBack, children, footer, testID }: AuthScreenProps) {
  return (
    <Screen testID={testID} footer={footer} contentStyle={styles.flush}>
      <AuthHero onBack={onBack} />
      <View style={styles.title}>
        <TitleBlock eyebrow={eyebrow} title={title} lead={lead} />
      </View>
      <View style={styles.fields}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The well runs to the edges of the screen and under the status bar; the rest keeps the gutter.
  flush: { paddingHorizontal: 0, paddingTop: 0 },
  title: { paddingHorizontal: size.gutter, paddingTop: space[6] },
  fields: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: size.gutter },
});
