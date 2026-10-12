import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { motion, space } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { BackdropIcon, type IconName } from './Icon';
import { Fade, Sway } from './motion';

interface EmptyStateProps {
  /** The icon of the tab this screen belongs to. */
  icon: IconName;
  /** What belongs here. */
  title: string;
  /** Why it is worth filling, in one sentence. */
  text: string;
  /** The one thing to do next. An empty screen is a starting point, never a dead end. */
  action?: { label: string; onPress: () => void; icon?: IconName; testID?: string };
  /** Something quiet under the action, such as a hint about how much is needed. */
  footnote?: ReactNode;
  /** For a search or filter that found nothing: no icon, set at the top, so the way out stays above the keyboard. */
  compact?: boolean;
  testID?: string;
}

/** The content rises this far as it arrives: the top of the 4 to 8 range, because the block is large. */
const rise = 8;

/**
 * What a tab shows while it has nothing of its own: its icon, large and blended into the page, with a title,
 * one sentence and the next step. The icon sways once, like a hanger on a rail, when the block appears. It fills the free space under the screen title and sits a little above centre.
 */
export function EmptyState({ icon, title, text, action, footnote, compact = false, testID }: EmptyStateProps) {
  return (
    <Fade testID={testID} rise={rise} duration={motion.enter} style={compact ? styles.compact : styles.frame}>
      {compact ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Sway testID={testID ? `${testID}-icon` : undefined}>
            <BackdropIcon name={icon} />
          </Sway>
        </View>
      )}
      <View style={styles.words}>
        <AppText variant="heading" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText color="textSecondary" align="center">
          {text}
        </AppText>
      </View>
      {action ? (
        <Button label={action.label} icon={action.icon} onPress={action.onPress} inline style={styles.action} testID={action.testID} />
      ) : null}
      {footnote}
    </Fade>
  );
}

const styles = StyleSheet.create({
  // The bottom padding lifts the group to the optical centre: a block set at the exact middle looks as if it were sinking.
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[6], paddingBottom: space[12] },
  compact: { alignItems: 'center', gap: space[4], paddingTop: space[6] },
  words: { alignSelf: 'stretch', gap: 10 },
  action: { alignSelf: 'center' },
});
