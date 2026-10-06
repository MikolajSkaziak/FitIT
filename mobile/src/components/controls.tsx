import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, useTheme, type ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** What pressing does, for screen readers: the icon alone says nothing. */
  label: string;
  onPress?: () => void;
  color?: ColorToken;
  testID?: string;
}

/** A 44 by 44 target around a 24 icon. */
export function IconButton({ icon, label, onPress, color = 'text', testID }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}>
      <Icon name={icon} color={color} />
    </Pressable>
  );
}

interface LinkTextProps {
  label: string;
  onPress?: () => void;
  color?: ColorToken;
  /** Centred in its row instead of starting at the left edge (under a full-width button). */
  center?: boolean;
  testID?: string;
}

/** A secondary action written as an underlined link, with a full-height touch target. */
export function LinkText({ label, onPress, color = 'action', center = false, testID }: LinkTextProps) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      testID={testID}
      hitSlop={{ left: 8, right: 8 }}
      style={({ pressed }) => [styles.link, center ? styles.linkCentered : styles.linkLeading, pressed ? styles.pressed : null]}>
      <AppText variant="secondaryStrong" color={color} style={styles.underline}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface OptionTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** "radio" when one of the group is chosen, "checkbox" when several may be. */
  role?: 'radio' | 'checkbox';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Selectable tile shared by occasions and styles: outlined when idle; sage fill, green ring and a check when chosen. */
export function OptionTile({ label, selected, onPress, role = 'radio', style, testID }: OptionTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.option,
        selected
          ? { backgroundColor: theme.sage, borderColor: theme.action, borderWidth: 2, paddingLeft: 15, paddingRight: 11 }
          : { backgroundColor: theme.surface, borderColor: theme.borderControl, borderWidth: 1, paddingHorizontal: 16 },
        pressed ? styles.pressed : null,
        style,
      ]}>
      <AppText variant="secondaryStrong" style={styles.optionLabel}>
        {label}
      </AppText>
      {selected ? <Icon name="check" size={20} color="action" /> : null}
    </Pressable>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  label: string;
}

/** A short either-or choice in one row. */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: theme.surface, borderColor: theme.borderControl }]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, on ? { backgroundColor: theme.action } : null, pressed ? styles.pressed : null]}>
            <AppText variant="secondaryStrong" color={on ? 'onAction' : 'text'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface BarProps {
  /** 0 to 1. */
  progress: number;
  label: string;
}

/** Thin progress bar. */
export function ProgressBar({ progress, label }: BarProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: theme.border }]}>
      <View style={[styles.fill, { backgroundColor: theme.action, width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  link: { minHeight: size.touch, justifyContent: 'center' },
  linkLeading: { alignSelf: 'flex-start' },
  linkCentered: { alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  option: {
    minHeight: size.option,
    borderRadius: radius.control,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  optionLabel: { flexShrink: 1 },
  segmented: { flexDirection: 'row', gap: space[1], padding: 3, borderWidth: 1, borderRadius: radius.control },
  segment: { flex: 1, height: size.touch, borderRadius: radius.segment, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[1] },
  track: { height: size.bar, borderRadius: size.bar / 2, overflow: 'hidden' },
  fill: { height: size.bar, borderRadius: size.bar / 2 },
  pressed: { opacity: 0.85 },
});
