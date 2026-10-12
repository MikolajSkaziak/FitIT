import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { openDocument, privacyPolicyUrl, termsUrl } from '@/features/profile/legal';
import { press } from '@/lib/haptics';
import { space } from '@/theme';

/**
 * What creating an account means, said right under the button that does it: the agreement to the two documents, both links.
 * It does not carry any consent to AI processing: that is asked in context, before the first photo. A document that is not
 * published yet is plain text.
 */
export function LegalNote() {
  return (
    <AppText variant="caption" color="textSecondary" align="center" style={styles.note} testID="legal-note">
      By creating an account you agree to the <Document label="Terms" url={termsUrl()} testID="legal-terms" /> and{' '}
      <Document label="Privacy Policy" url={privacyPolicyUrl()} testID="legal-privacy" />.
    </AppText>
  );
}

function Document({ label, url, testID }: { label: string; url: string | null; testID: string }) {
  if (!url) {
    return <AppText variant="caption" color="textSecondary">{label}</AppText>;
  }

  return (
    <AppText variant="caption" color="action" accessibilityRole="link" onPress={() => {
        press('quiet');
        void openDocument(url);
      }} style={styles.link} testID={testID}>
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  note: { paddingTop: space[1] },
  link: { textDecorationLine: 'underline' },
});
