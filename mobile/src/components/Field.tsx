import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  /** Shown above the input. Leave out only for a search box, and then pass `accessibilityLabel`. */
  label?: string;
  /** One line of help under the input. Replaced by `error` when there is one. */
  helper?: string;
  /** What is wrong and how to fix it. Shown under the input and read out by screen readers. */
  error?: string | null;
  /** Functional icon inside the input on the left (search only). */
  leadingIcon?: IconName;
  /** A control inside the input on the right, such as "show password". */
  trailing?: ReactNode;
}

/** Text input with its label above, at control height, and help or an error below. */
export function Field({ label, helper, error, leadingIcon, trailing, onFocus, onBlur, ...input }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const labelId = useId();
  const line = error ? theme.danger : focused ? theme.action : theme.borderControl;
  return (
    <View style={styles.field}>
      {label ? (
        <AppText variant="secondaryStrong" nativeID={labelId}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: line, borderWidth: error || focused ? 2 : 1 }]}>
        {leadingIcon ? (
          <View style={styles.leading}>
            <Icon name={leadingIcon} color="textSecondary" />
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={label ? labelId : undefined}
          placeholderTextColor={theme.textSecondary}
          maxFontSizeMultiplier={1.3}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: theme.text, paddingLeft: leadingIcon ? 0 : 16 - (error || focused ? 1 : 0), paddingRight: trailing ? 0 : 16 }]}
        />
        {trailing}
      </View>
      {error ? (
        <AppText variant="meta" color="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="meta" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  box: { height: size.control, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  leading: { width: 44, alignItems: 'center' },
  input: { flex: 1, height: '100%', fontFamily: fonts.text, fontSize: 16, paddingVertical: 0 },
});
