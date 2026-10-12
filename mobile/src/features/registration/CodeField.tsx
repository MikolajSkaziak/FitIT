import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { Fade } from '@/components/motion';
import { size, space, useTheme } from '@/theme';

interface CodeFieldProps extends Pick<TextInputProps, 'autoFocus' | 'autoComplete' | 'textContentType' | 'keyboardType' | 'returnKeyType' | 'onSubmitEditing'> {
  value: string;
  onChangeText: (text: string) => void;
  /** How many digits the code has: one box each. */
  length: number;
  /** Names the field for screen readers; the boxes themselves are decorative. */
  label: string;
  error?: string | null;
  testID?: string;
}

/**
 * A code written into boxes on a line each, the way the digits are read out. One real input lies unseen over all of them,
 * so typing, pasting and the one-time-code suggestion of the keyboard work as in any field; the boxes only show its value.
 */
export function CodeField({ value, onChangeText, length, label, error, testID, ...input }: CodeFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const wrong = Boolean(error);
  return (
    <View style={styles.field}>
      <View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.boxes}>
          {Array.from({ length }, (_, index) => {
            const digit = value[index];
            const here = focused && index === Math.min(value.length, length - 1);
            const line = wrong ? theme.danger : here ? theme.action : digit ? theme.text : theme.borderControl;
            return (
              <View key={index} style={styles.box}>
                <AppText variant="display" maxFontSizeMultiplier={1}>
                  {digit ?? ''}
                </AppText>
                <View style={[styles.line, { backgroundColor: line, height: wrong || here ? size.bar : 1 }]} />
              </View>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={length}
          caretHidden
          {...input}
          style={styles.input}
          testID={testID}
        />
      </View>
      {error ? (
        <Fade key={error}>
          <AppText variant="meta" color="danger" accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.note}>
            {error}
          </AppText>
        </Fade>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch' },
  boxes: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Over every box and unseen: a touch anywhere on the code lands in it.
  input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, fontSize: 1 },
  note: { marginTop: space[2] },
});
