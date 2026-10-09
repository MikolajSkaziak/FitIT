import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, useTheme, type ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { CrossFade, PressScale, ProgressFill, ToggleFade } from './motion';

interface IconButtonProps {
  icon: IconName;
  /** What pressing does, for screen readers: the icon alone says nothing. */
  label: string;
  onPress?: () => void;
  color?: ColorToken;
  /** Drawn as a control of its own, with a face and a border and a 20 icon, where it stands apart from text. */
  outlined?: boolean;
  /** Work it started is under way: it ignores presses and says it is busy. */
  busy?: boolean;
  testID?: string;
}

/** A 44 by 44 target around a 24 icon. */
export function IconButton({ icon, label, onPress, color = 'text', outlined = false, busy = false, testID }: IconButtonProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { busy, disabled: true } : undefined}
      disabled={busy}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={[styles.iconButton, outlined ? { backgroundColor: theme.surface, borderColor: theme.borderControl, borderWidth: 1 } : null]}>
      <Icon name={icon} size={outlined ? 20 : 24} color={busy ? 'textSecondary' : color} />
    </PressScale>
  );
}

interface IconToggleButtonProps {
  icon: IconName;
  /** What pressing does, and the state when it is on ("Filters, 2 active"). */
  label: string;
  /** On: sage fill and a green ring. The fill and ring fade, so the button keeps its size. */
  active: boolean;
  onPress: () => void;
  testID?: string;
}

/** A 44 by 44 icon button that shows plainly when what it opens is in use. */
export function IconToggleButton({ icon, label, active, onPress, testID }: IconToggleButtonProps) {
  const theme = useTheme();
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} testID={testID} style={styles.iconButton}>
      <View style={[StyleSheet.absoluteFill, styles.iconToggleFace, { backgroundColor: theme.surface, borderColor: theme.borderControl, borderWidth: 1 }]} />
      <ToggleFade on={active} style={[StyleSheet.absoluteFill, styles.iconToggleFace, { backgroundColor: theme.sage, borderColor: theme.action, borderWidth: 2 }]} />
      <Icon name={icon} size={20} color={active ? 'action' : 'text'} />
    </PressScale>
  );
}

interface SwatchProps {
  /** The garment colour as it looks, `#RRGGBB`. A content colour, not an interface colour. */
  hex: string;
  /** The colour's name: the swatch alone says nothing to a screen reader. */
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** A round colour swatch in a 44 by 44 target. Chosen: a green ring around it, drawn over the same box, so nothing moves. */
export function Swatch({ hex, label, selected, onPress, testID }: SwatchProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={styles.swatchTarget}>
      <ToggleFade on={selected} style={[styles.swatchRing, { borderColor: theme.action }]} />
      <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.borderControl }]} />
    </PressScale>
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
    <PressScale
      accessibilityRole="link"
      onPress={onPress}
      testID={testID}
      hitSlop={{ left: 8, right: 8 }}
      style={[styles.link, center ? styles.linkCentered : styles.linkLeading]}>
      <AppText variant="secondaryStrong" color={color} style={styles.underline}>
        {label}
      </AppText>
    </PressScale>
  );
}

interface OptionTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** "radio" when one of the group is chosen, "checkbox" when several may be. */
  role?: 'radio' | 'checkbox';
  /** A decorative icon before the label; it takes the same room whether the tile is chosen or not. */
  icon?: IconName;
  /** A content colour (`#RRGGBB`) shown as a small dot before the label: hair, eyes, skin. Not an interface colour. */
  swatch?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Selectable tile shared by occasions, groups and styles: outlined when idle; sage fill, green ring and a check when chosen.
 * The label is drawn once and never moves: only the two backgrounds under it and the check fade. A tile with an icon has
 * no check; its icon turns green instead, which leaves the label the full width.
 */
export function OptionTile({ label, selected, onPress, role = 'radio', icon, swatch, style, testID }: OptionTileProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={style}>
      <View style={styles.option}>
        <View style={[StyleSheet.absoluteFill, styles.optionFace, { backgroundColor: theme.surface, borderColor: theme.borderControl, borderWidth: 1 }]} />
        <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.optionFace, { backgroundColor: theme.sage, borderColor: theme.action, borderWidth: 2 }]} />
        {swatch ? <View style={[styles.optionDot, { backgroundColor: swatch, borderColor: theme.borderControl }]} /> : null}
        {icon ? (
          <View style={styles.optionIcon}>
            <Icon name={icon} size={20} color="textSecondary" />
            <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
              <Icon name={icon} size={20} color="action" />
            </ToggleFade>
          </View>
        ) : null}
        <AppText variant="secondaryStrong" style={styles.optionLabel}>
          {label}
        </AppText>
        {icon ? null : (
          <ToggleFade on={selected} style={styles.optionIcon}>
            <Icon name="check" size={20} color="action" />
          </ToggleFade>
        )}
      </View>
    </PressScale>
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
          <PressScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={styles.segment}>
            <CrossFade on={on} style={styles.segmentFrame} faceStyle={styles.segmentFrame}>
              {(lit) => (
                <View style={[styles.segmentFace, lit ? { backgroundColor: theme.action } : null]}>
                  <AppText variant="secondaryStrong" color={lit ? 'onAction' : 'text'} numberOfLines={1}>
                    {option.label}
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
      <ProgressFill progress={clamped} style={{ backgroundColor: theme.action }} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  iconToggleFace: { borderRadius: radius.control },
  swatchTarget: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  swatchRing: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2 },
  link: { minHeight: size.touch, justifyContent: 'center' },
  linkLeading: { alignSelf: 'flex-start' },
  linkCentered: { alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  option: {
    minHeight: size.option,
    paddingVertical: 6,
    paddingLeft: 17,
    paddingRight: 13,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  optionFace: { borderRadius: radius.control },
  optionDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  optionIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  // With an icon in front, the label takes the free room so the check still ends the row.
  optionLabel: { flexShrink: 1, flexGrow: 1 },
  segmented: { flexDirection: 'row', gap: space[1], padding: 3, borderWidth: 1, borderRadius: radius.control },
  segment: { flex: 1, height: size.touch },
  segmentFrame: { flex: 1 },
  segmentFace: { flex: 1, borderRadius: radius.segment, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[1] },
  track: { height: size.bar, borderRadius: size.bar / 2, overflow: 'hidden' },
});
