import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CrossFade, PressScale } from '@/components/motion';
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
          <PressScale
            key={index}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label}, ${index + 1} of ${labels.length}`}
            onPress={() => onSelect(index)}
            testID={`proposal-tab-${index}`}>
            <CrossFade on={on}>
              {(lit) => (
                <View style={[styles.pill, { backgroundColor: lit ? theme.sage : 'transparent' }]}>
                  <AppText variant="secondaryStrong" color={lit ? 'onSage' : 'textSecondary'} numberOfLines={1}>
                    {label}
                  </AppText>
                </View>
              )}
            </CrossFade>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pill: { height: size.touch, borderRadius: size.touch / 2, paddingHorizontal: space[4], alignItems: 'center', justifyContent: 'center' },
});
