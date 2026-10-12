import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorToken, TextVariant } from '@/theme';

import { AppText } from './AppText';

interface SplitTextProps {
  text: string;
  variant?: TextVariant;
  color?: ColorToken;
  role?: AccessibilityRole;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  /**
   * Gives one word a wrapper (a kinetic detail) and returns it in place of `node`, the word as it would have been drawn. `word` has
   * no space after it; `last` is true for the final word and `index` counts from 0.
   */
  wrap?: (word: string, node: ReactNode, last: boolean, index: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A sentence set as a wrapping row of words, for the one case where a single word has to move: React Native cannot transform a
 * `Text` nested in a `Text`. Each word is an `AppText` of the same variant and colour as the sentence would have, with its space after it, so
 * it looks the same and wraps the same (to within one space at the end of a line). Screen readers get the whole sentence as one
 * label on the row and skip the pieces.
 */
export function SplitText({ text, variant, color, role, accessibilityLiveRegion, wrap, style, testID }: SplitTextProps) {
  const words = text.split(' ');
  return (
    <View accessible accessibilityRole={role} accessibilityLabel={text} accessibilityLiveRegion={accessibilityLiveRegion} style={[styles.row, style]} testID={testID}>
      {words.map((word, index) => {
        const last = index === words.length - 1;
        const node = (
          <AppText variant={variant} color={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {last ? word : `${word} `}
          </AppText>
        );
        return <Fragment key={index}>{wrap ? wrap(word, node, last, index) : node}</Fragment>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
