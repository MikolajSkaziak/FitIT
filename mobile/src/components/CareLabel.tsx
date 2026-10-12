import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { SplitText } from './SplitText';

interface CareLabelProps {
  label: string;
  /** A small icon before the words, in the action colour: the check of "Added". */
  icon?: IconName;
  /** Which corner of the photo it is laid over. Leave out to place it yourself with `style`, or in a row. */
  corner?: 'topLeft' | 'bottomLeft';
  /** Sets the label as a row of words and lets this wrap one of them (a kinetic detail); the sentence stays one label for screen readers. */
  wrapWord?: (word: string, node: ReactNode) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A care label: the small white tag sewn over the corner of a photo, saying one thing about it ("Safe choice", "Added").
 * White with ink in both schemes, because the well under it stays light. Put it inside the well, after the picture.
 */
export function CareLabel({ label, icon, corner, wrapWord, style, testID }: CareLabelProps) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.wellChip }, corner ? styles[corner] : null, style]} testID={testID}>
      {icon ? <Icon name={icon} size={12} color="wellRail" /> : null}
      {wrapWord ? (
        <SplitText text={label} variant="eyebrow" color="onWellChip" wrap={wrapWord} />
      ) : (
        <AppText variant="eyebrow" color="onWellChip" numberOfLines={1}>
          {label}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 8, borderRadius: radius.tag },
  topLeft: { position: 'absolute', left: 12, top: 12 },
  bottomLeft: { position: 'absolute', left: 20, bottom: 12 },
});
