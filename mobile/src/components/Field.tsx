import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { size, space, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Fade } from './motion';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  /** Shown above the input. Leave out only for a search box, and then pass `accessibilityLabel`. */
  label?: string;
  /** One line of help under the input. Replaced by `error` when there is one. */
  helper?: string;
  /** What is wrong and how to fix it. Shown under the input and read out by screen readers. */
  error?: string | null;
  /** Marks the line as wrong while the explanation is given elsewhere (one message for several boxes). */
  invalid?: boolean;
  /** Functional icon inside the input on the left (search only). */
  leadingIcon?: IconName;
  /** A control inside the input on the right, such as "show password". */
  trailing?: ReactNode;
}

/**
 * Text input written on a line: a caption above, the value, a control line underneath, and help or an error below.
 * The line turns green and thickens while typing and red when wrong; it is drawn over the row, so nothing moves.
 * Without a label and with a leading icon it is a search box instead: a quiet capsule the colour of the well.
 */
export function Field({ label, helper, error, invalid = false, leadingIcon, trailing, onFocus, onBlur, ...input }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const labelId = useId();
  const wrong = Boolean(error) || invalid;
  const line = wrong ? theme.danger : focused ? theme.action : theme.borderControl;
  const search = !label && Boolean(leadingIcon);
  return (
    <View style={styles.field}>
      {label ? (
        <AppText variant="caption" color="textSecondary" nativeID={labelId}>
          {label}
        </AppText>
      ) : null}
      <View style={search ? [styles.search, { backgroundColor: theme.sage, borderColor: wrong || focused ? line : theme.sage }] : styles.row}>
        {leadingIcon ? <Icon name={leadingIcon} size={20} color="textSecondary" /> : null}
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
          style={[styles.input, { color: theme.text }]}
        />
        {trailing}
        {search ? null : <View style={[styles.line, { backgroundColor: line, height: wrong || focused ? 2 : 1 }]} />}
      </View>
      {error ? (
        <Fade key={error}>
          <AppText variant="meta" color="danger" accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.note}>
            {error}
          </AppText>
        </Fade>
      ) : helper ? (
        <AppText variant="meta" color="textSecondary" style={styles.note}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch' },
  // 44 high, so the whole line is a comfortable target; the value sits 10 above the line.
  row: { height: size.touch, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  search: { height: 48, borderRadius: 24, borderWidth: 2, paddingLeft: 14, paddingRight: space[1], flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, height: '100%', fontFamily: typography.body.fontFamily, fontSize: typography.body.fontSize, paddingVertical: 0 },
  note: { marginTop: space[2] },
});
