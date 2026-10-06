import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { space } from '@/theme';

/** What creating an account means, said right above the button that does it. */
export function LegalNote() {
  return (
    <AppText variant="meta" color="textSecondary" align="center" style={styles.note}>
      Zakładając konto, akceptujesz Regulamin i Politykę prywatności.
    </AppText>
  );
}

const styles = StyleSheet.create({
  note: { paddingBottom: space[2] },
});
