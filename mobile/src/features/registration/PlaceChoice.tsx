import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { PressScale, ToggleFade } from '@/components/motion';
import { size, space, useTheme } from '@/theme';

interface PlaceChoiceProps {
  label: string;
  icon: IconName;
  /** A second, quieter line under the label: the place that was found. */
  caption?: ReactNode;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * One way of setting the place, as a hairline row with a caption under its name. Chosen, the line under it turns to ink, the
 * icon turns green and a green check closes the row; only those fade, the words never move. The same as an option tile, with room for the caption.
 */
export function PlaceChoice({ label, icon, caption, selected, onPress, testID }: PlaceChoiceProps) {
  const theme = useTheme();
  return (
    <PressScale accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress} testID={testID}>
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.icon}>
          <Icon name={icon} size={20} color="textSecondary" />
          <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
            <Icon name={icon} size={20} color="action" />
          </ToggleFade>
        </View>
        <View style={styles.words}>
          <AppText variant={selected ? 'title' : 'body'}>{label}</AppText>
          {caption}
        </View>
        <ToggleFade on={selected} style={styles.icon}>
          <Icon name="check" size={20} color="action" />
        </ToggleFade>
        <ToggleFade on={selected} style={[styles.line, { backgroundColor: theme.text }]} />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.option, paddingVertical: space[3], borderBottomWidth: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1 },
  // The ink line lies over the hairline of the row, so choosing changes its colour and nothing else.
  line: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 1 },
});
