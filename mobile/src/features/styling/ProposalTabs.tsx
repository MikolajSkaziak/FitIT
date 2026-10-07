import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { size, space, useTheme } from '@/theme';

interface ProposalTabsProps {
  labels: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
}

/** One pill per proposal: the chosen one is filled with sage. They name the pages and show where you are among them. */
export function ProposalTabs({ labels, selected, onSelect }: ProposalTabsProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {labels.map((label, index) => {
        const on = index === selected;
        return (
          <Pressable
            key={index}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label}, ${index + 1} z ${labels.length}`}
            onPress={() => onSelect(index)}
            testID={`proposal-tab-${index}`}
            style={({ pressed }) => [styles.pill, { backgroundColor: on ? theme.sage : 'transparent' }, pressed ? styles.pressed : null]}>
            <AppText variant="secondaryStrong" color={on ? 'onSage' : 'textSecondary'} numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pill: { height: size.touch, borderRadius: size.touch / 2, paddingHorizontal: space[4], alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
});
