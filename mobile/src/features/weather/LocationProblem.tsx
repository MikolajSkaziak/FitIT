import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LinkText } from '@/components/controls';
import { Fade } from '@/components/motion';
import { space } from '@/theme';

import { locationProblems } from './copy';

interface LocationProblemProps {
  /** What the phone said when asked for its place; nothing yet, or a success, shows nothing. */
  outcome: keyof typeof locationProblems | null | undefined;
  /** A problem of another kind (the request itself failed), in the app's own words. */
  message?: string | null;
}

/** Why the phone's location could not be used, with the way to the phone's Settings when it was refused. */
export function LocationProblem({ outcome, message }: LocationProblemProps) {
  const text = message ?? (outcome ? locationProblems[outcome] : null);
  if (!text) {
    return null;
  }

  return (
    <View style={styles.problem}>
      <Fade key={text} exit>
        <AppText variant="secondary" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {text}
        </AppText>
      </Fade>
      {outcome === 'denied' ? <LinkText label="Open phone settings" onPress={() => void Linking.openSettings()} testID="place-settings" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  problem: { gap: space[1] },
});
