import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { space } from '@/theme';

export const aiNote = 'Described by AI — check it and change anything that’s off.';

/**
 * One quiet line, wherever the name and tags the AI wrote are shown: it says who wrote them. The server clears it for a
 * garment the person has edited, and a starter piece never has it, so it is shown exactly while the claim is true.
 */
export function AiNote({ testID }: { testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <Icon name="sparkle" size={12} color="textSecondary" />
      <AppText variant="caption" color="textSecondary" style={styles.words}>
        {aiNote}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  words: { flexShrink: 1 },
});
