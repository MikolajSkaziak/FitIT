import { Linking, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { privacyPolicyUrl, termsUrl } from '@/features/profile/legal';
import { space } from '@/theme';

/**
 * What creating an account means, said right under the button that does it. Creating the account is also the agreement to
 * AI processing, so this one line carries it: both documents are links. A document that is not published yet is plain text.
 */
export function LegalNote() {
  return (
    <AppText variant="meta" color="textSecondary" align="center" style={styles.note} testID="legal-note">
      By creating an account you agree to our <Document label="Terms" url={termsUrl()} testID="legal-terms" /> and{' '}
      <Document label="Privacy Policy" url={privacyPolicyUrl()} testID="legal-privacy" />.
    </AppText>
  );
}

function Document({ label, url, testID }: { label: string; url: string | null; testID: string }) {
  if (!url) {
    return <AppText variant="meta" color="textSecondary">{label}</AppText>;
  }

  return (
    <AppText variant="meta" color="action" accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.link} testID={testID}>
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  note: { paddingTop: space[1] },
  link: { textDecorationLine: 'underline' },
});
