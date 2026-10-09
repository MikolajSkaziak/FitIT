import { StyleSheet, View } from 'react-native';

import type { StarterPiece } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Grid } from '@/components/Grid';
import { Skeleton } from '@/components/lists';
import { space } from '@/theme';

import { basics } from './copy';
import { StarterTile } from './StarterTile';

interface StarterPickerProps {
  pieces: readonly StarterPiece[];
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
  chosen: ReadonlySet<string>;
  onChange: (chosen: ReadonlySet<string>) => void;
}

/** The count, Select all / Clear and the grid of common pieces: shared by the onboarding step and the picker sheet. */
export function StarterPicker({ pieces, pending, failed, onRetry, chosen, onChange }: StarterPickerProps) {
  if (failed) {
    return (
      <View style={styles.failed}>
        <AppText color="textSecondary" accessibilityRole="alert">
          {basics.loadFailed}
        </AppText>
        <Button label={basics.retry} kind="secondary" compact inline onPress={onRetry} testID="basics-retry" />
      </View>
    );
  }

  const everything = pieces.length > 0 && chosen.size === pieces.length;
  const toggle = (code: string) => {
    const next = new Set(chosen);
    if (!next.delete(code)) {
      next.add(code);
    }

    onChange(next);
  };

  return (
    <View style={styles.pieces}>
      <View style={styles.bar}>
        <AppText variant="meta" color="textSecondary" tabular testID="basics-count">
          {basics.count(chosen.size, pieces.length)}
        </AppText>
        <LinkText
          label={everything ? basics.clear : basics.selectAll}
          onPress={() => onChange(everything ? new Set() : new Set(pieces.map((piece) => piece.code)))}
          testID="basics-all"
        />
      </View>
      {pending ? (
        <View accessibilityRole="progressbar" accessibilityLabel={basics.loading}>
          {/* Where the tiles will be, so the page does not shift when they arrive. */}
          <Grid items={[0, 1, 2, 3, 4, 5]} columns={3} rowGap={space[3]} keyOf={String} renderItem={() => <Skeleton height={150} />} />
        </View>
      ) : (
        <Grid
          items={pieces}
          columns={3}
          rowGap={space[3]}
          keyOf={(piece) => piece.code}
          accessibilityLabel="Common pieces"
          renderItem={(piece) => <StarterTile piece={piece} selected={chosen.has(piece.code)} onPress={() => toggle(piece.code)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pieces: { gap: space[3] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  failed: { gap: space[3] },
});
