import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { MyStarterPiece } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { LinkText } from '@/components/controls';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/motion';
import { radius, size, space, useTheme } from '@/theme';

import { pieces } from './copy';
import { useAddStarters, useMyStarters } from './useMyStarters';

const tileWidth = 104;
const imageHeight = 96;
const button = 32;

/** The end of the wardrobe list: common pieces not added yet, one tap each. Gone once none remain. */
export function StarterStrip() {
  const router = useRouter();
  const { remaining } = useMyStarters();
  const add = useAddStarters();
  if (remaining.length === 0) {
    return null;
  }

  const adding = add.isPending ? add.variables : [];
  return (
    <View style={styles.section} testID="wardrobe-starters">
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {pieces.title}
        </AppText>
        <LinkText label={pieces.see} onPress={() => router.push('/basics')} testID="starters-see-all" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.strip} contentContainerStyle={styles.tiles}>
        {remaining.map((piece) => (
          <Tile key={piece.code} piece={piece} busy={adding.includes(piece.code)} onAdd={() => add.mutate([piece.code])} />
        ))}
      </ScrollView>
    </View>
  );
}

function Tile({ piece, busy, onAdd }: { piece: MyStarterPiece; busy: boolean; onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.tile} testID={`starter-tile-${piece.code}`}>
      <View>
        <GarmentImage url={piece.imageUrl} cacheKey={`starter-${piece.code}`} height={imageHeight} inset={space[2]} />
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={pieces.addOne(piece.name)}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          hitSlop={(size.touch - button) / 2}
          onPress={onAdd}
          testID={`starter-add-${piece.code}`}
          style={[styles.add, { backgroundColor: theme.wellChip }, busy ? styles.busy : null]}>
          <Icon name="plus" size={16} color="onWellChip" />
        </PressScale>
      </View>
      <AppText variant="secondaryStrong" numberOfLines={2}>
        {piece.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3], paddingTop: space[2] },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // Runs to both screen edges, like the text tabs above the list.
  strip: { marginHorizontal: -size.gutter, flexGrow: 0 },
  tiles: { paddingHorizontal: size.gutter, gap: space[2] },
  tile: { width: tileWidth, gap: space[2] },
  add: { position: 'absolute', right: space[2], top: space[2], width: button, height: button, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.4 },
});
