import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, useTheme, type ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Kind = 'primary' | 'secondary' | 'text' | 'danger' | 'dangerText';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: IconName;
  /** 44 high instead of 48, for a button inside a row of controls. */
  compact?: boolean;
  /** Takes the width of its text instead of the full row. */
  inline?: boolean;
  /** Work is under way: the button stays readable, shows it is busy and ignores presses. */
  busy?: boolean;
  /** Cannot act yet. Use only next to a visible explanation of why. */
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const looks: Record<Kind, { fill: ColorToken | null; text: ColorToken; line: ColorToken | null }> = {
  primary: { fill: 'action', text: 'onAction', line: 'action' },
  secondary: { fill: 'surface', text: 'text', line: 'borderControl' },
  text: { fill: null, text: 'action', line: null },
  danger: { fill: 'danger', text: 'onDanger', line: 'danger' },
  dangerText: { fill: null, text: 'danger', line: null },
};

export function Button({ label, onPress, kind = 'primary', icon, compact, inline, busy, disabled, accessibilityLabel, style, testID }: ButtonProps) {
  const theme = useTheme();
  const look = disabled ? { fill: 'disabledFill' as const, text: 'disabledText' as const, line: 'disabledFill' as const } : looks[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          height: compact ? size.controlCompact : size.control,
          backgroundColor: look.fill ? theme[look.fill] : 'transparent',
          borderColor: look.line ? theme[look.line] : 'transparent',
          alignSelf: inline ? 'flex-start' : 'stretch',
        },
        pressed ? styles.pressed : null,
        style,
      ]}>
      {busy ? <ActivityIndicator size="small" color={theme[look.text]} /> : icon ? <Icon name={icon} size={20} color={look.text} /> : null}
      <View style={styles.label}>
        <AppText variant="label" color={look.text} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  label: { flexShrink: 1 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
});
