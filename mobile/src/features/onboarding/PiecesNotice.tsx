import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { space } from '@/theme';

import { pending } from './copy';
import { usePendingPieces } from './pendingPieces';
import { useAddStarters } from './useMyStarters';

/** Says plainly that the pieces picked before sign-up did not reach the wardrobe, and offers another try. Nothing when they did. */
export function PendingPieces() {
  const codes = usePendingPieces((store) => store.codes);
  const clear = usePendingPieces((store) => store.clear);
  const add = useAddStarters();
  if (codes.length === 0) {
    return null;
  }

  return (
    <View style={styles.notice} testID="pending-pieces">
      <AppText variant="secondary" color="danger" accessibilityRole="alert">
        {pending.text}
      </AppText>
      <Button label={pending.retry} kind="secondary" compact inline busy={add.isPending} onPress={() => add.mutate([...codes], { onSuccess: clear })} testID="pending-pieces-retry" />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { gap: space[2] },
});
