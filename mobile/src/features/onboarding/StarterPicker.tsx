import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GarmentGroup, StarterPiece } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Skeleton } from '@/components/lists';
import { TextTabs } from '@/components/TextTabs';
import { space } from '@/theme';

import { basics, groupLabel } from './copy';
import { StarterTile, tileImageHeight } from './StarterTile';

interface StarterPickerProps {
  pieces: readonly StarterPiece[];
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
  chosen: ReadonlySet<string>;
  onChange: (chosen: ReadonlySet<string>) => void;
}

type Shown = GarmentGroup | 'all';

/** The groups in the order of the server's list (tops, layers, bottoms, dresses, shoes, bags), so the tabs read the way a shop does. */
const order = Object.keys(groupLabel) as GarmentGroup[];

/** Two columns, 13 apart and 20 between rows, like the design's grid; a short last row keeps the column width. */
function Pairs<T>({ items, keyOf, render }: { items: readonly T[]; keyOf: (item: T) => string; render: (item: T) => ReactNode }) {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += 2) {
    rows.push(items.slice(start, start + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={keyOf(row[0] as T)} style={styles.pair}>
          {row.map((item) => (
            <View key={keyOf(item)} style={styles.cell}>
              {render(item)}
            </View>
          ))}
          {row.length < 2 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

/** The groups as tabs, the count with Select all / Clear, and the grid of common pieces: shared by the onboarding step and the picker sheet. */
export function StarterPicker({ pieces, pending, failed, onRetry, chosen, onChange }: StarterPickerProps) {
  const [shown, setShown] = useState<Shown>('all');
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

  // A tab only for a group that has pieces in this list, which is already narrowed to what suits the person.
  const groups = order.filter((group) => pieces.some((piece) => piece.group === group));
  // A tab for a group that has since emptied (every piece of it was added elsewhere) falls back to everything.
  const filter: Shown = groups.includes(shown as GarmentGroup) ? shown : 'all';
  const visible = filter === 'all' ? pieces : pieces.filter((piece) => piece.group === filter);
  const everything = visible.length > 0 && visible.every((piece) => chosen.has(piece.code));
  const toggle = (code: string) => {
    const next = new Set(chosen);
    if (!next.delete(code)) {
      next.add(code);
    }

    onChange(next);
  };

  // Only the pieces on show are selected or cleared; the list keeps the catalog's order either way.
  const selectVisible = () => {
    const onShow = new Set(visible.map((piece) => piece.code));
    onChange(new Set(pieces.filter((piece) => (onShow.has(piece.code) ? !everything : chosen.has(piece.code))).map((piece) => piece.code)));
  };

  return (
    <View style={styles.pieces}>
      {groups.length > 1 ? (
        <TextTabs<Shown>
          label="Kind of piece"
          tabs
          options={[{ value: 'all', label: 'All' }, ...groups.map((group) => ({ value: group, label: groupLabel[group] }))]}
          value={filter}
          onChange={setShown}
          testID="basics-tabs"
        />
      ) : null}
      <View style={styles.bar}>
        <AppText variant="meta" color="textSecondary" tabular testID="basics-count">
          {basics.count(chosen.size, pieces.length)}
        </AppText>
        <LinkText label={everything ? basics.clear : basics.selectAll} onPress={selectVisible} testID="basics-all" />
      </View>
      {pending ? (
        <View accessibilityRole="progressbar" accessibilityLabel={basics.loading}>
          {/* Where the tiles will be, so the page does not shift when they arrive. */}
          <Pairs
            items={[0, 1, 2, 3]}
            keyOf={String}
            render={() => (
              <View style={styles.skeleton}>
                <Skeleton height={tileImageHeight} />
                <Skeleton height={16} width="70%" />
              </View>
            )}
          />
        </View>
      ) : (
        <View accessibilityLabel="Common pieces">
          <Pairs
            items={visible}
            keyOf={(piece) => piece.code}
            render={(piece) => <StarterTile piece={piece} caption={groupLabel[piece.group]} selected={chosen.has(piece.code)} onPress={() => toggle(piece.code)} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pieces: { gap: space[3] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  failed: { gap: space[3] },
  grid: { gap: 20 },
  pair: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  cell: { flex: 1, minWidth: 0 },
  skeleton: { gap: space[2] },
});
