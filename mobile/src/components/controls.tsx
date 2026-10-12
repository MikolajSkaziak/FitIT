import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import * as haptics from '@/lib/haptics';
import { motion, size, space, useTheme, type ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Fade, PressScale, ProgressFill, ToggleFade } from './motion';
import { TextTabs } from './TextTabs';

interface IconButtonProps {
  icon: IconName;
  /** What pressing does, for screen readers: the icon alone says nothing. */
  label: string;
  onPress?: () => void;
  color?: ColorToken;
  /** No face and no line, just the icon in its 44 target: for a control that lives inside another one (the eye of a password field). */
  bare?: boolean;
  /** Kept for older call sites: every icon button that is not `bare` is drawn as a control of its own now. */
  outlined?: boolean;
  /** Work it started is under way: it ignores presses and says it is busy. */
  busy?: boolean;
  /** `auto` is a Light tap; `none` where its own cue fires (the board's arrange buttons). */
  haptic?: haptics.Haptic;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The round icon button: a 44 point white disc with a hairline around a 20 point icon. Back, close, edit, filters.
 * Over a photo it needs nothing more; place it with `style`.
 */
export function IconButton({ icon, label, onPress, color = 'text', bare = false, busy = false, haptic = 'auto', style, testID }: IconButtonProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { busy, disabled: true } : undefined}
      disabled={busy}
      onPress={onPress}
      haptic={haptic === 'auto' ? 'icon' : haptic}
      testID={testID}
      hitSlop={4}
      style={[styles.iconButton, bare ? null : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }, style]}>
      <Icon name={icon} size={20} color={busy ? 'textSecondary' : color} />
    </PressScale>
  );
}

/** The same round button under the name the designs use for it. */
export const CircleButton = IconButton;

interface IconToggleButtonProps {
  icon: IconName;
  /** What pressing does, and the state when it is on ("Filters, 2 active"). */
  label: string;
  /** On: the fill of the well and a green ring. The fill and ring fade, so the button keeps its size. */
  active: boolean;
  onPress: () => void;
  /** No disc behind it: the icon alone on the page, larger, and solid green when on. */
  bare?: boolean;
  /** `auto` is a Light tap; `none` where its own cue fires (the bookmark's `keep`). */
  haptic?: haptics.Haptic;
  testID?: string;
}

/** A round icon button that shows plainly when what it opens is in use. */
export function IconToggleButton({ icon, label, active, onPress, bare = false, haptic = 'auto', testID }: IconToggleButtonProps) {
  const theme = useTheme();
  // What is on screen at the first frame is simply there; the filled icon only settles in when it turns on afterwards.
  const [first] = useState(active);
  const [toggled, setToggled] = useState(false);
  if (active !== first && !toggled) {
    setToggled(true);
  }

  if (bare) {
    return (
      <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} haptic={haptic === 'auto' ? 'icon' : haptic} testID={testID} style={styles.iconButton}>
        {active ? (
          <Fade pop enter={toggled} duration={motion.exit} testID={testID ? `${testID}-pop` : undefined}>
            <Icon name={icon} size={24} color="action" filled />
          </Fade>
        ) : (
          <Icon name={icon} size={24} color="text" />
        )}
      </PressScale>
    );
  }

  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} haptic={haptic === 'auto' ? 'icon' : haptic} testID={testID} style={styles.iconButton}>
      <View style={[StyleSheet.absoluteFill, styles.iconToggleFace, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]} />
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

/** A round 36 point colour swatch in a 44 by 44 target. Chosen: a green ring tight around it, drawn over the same box, so nothing moves. */
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
      <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.border }]} />
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

/** A secondary action written as green words, with a full-height touch target. */
export function LinkText({ label, onPress, color = 'action', center = false, testID }: LinkTextProps) {
  return (
    <PressScale
      accessibilityRole="link"
      onPress={onPress}
      haptic="quiet"
      testID={testID}
      hitSlop={{ left: 8, right: 8 }}
      style={[styles.link, center ? styles.linkCentered : styles.linkLeading]}>
      <AppText variant="label" color={color}>
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
 * One option of a list, shared by occasions, groups and answers: a hairline row. Chosen, the line under it turns to ink
 * and a green check closes the row; an icon in front turns green too. The label is drawn once and never moves: only the
 * ink line, the check and the green icon fade, on at once and off over `motion.press`.
 */
export function OptionTile({ label, selected, onPress, role = 'radio', icon, swatch, style, testID }: OptionTileProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      haptic="none"
      onPress={() => {
        // Choosing the one that is already chosen changes nothing, so it gives no cue.
        if (role === 'checkbox' || !selected) {
          haptics.select();
        }

        onPress();
      }}
      testID={testID}
      style={style}>
      <View style={[styles.option, { borderBottomColor: theme.border }]}>
        {swatch ? <View style={[styles.optionDot, { backgroundColor: swatch, borderColor: theme.border }]} /> : null}
        {icon ? (
          <View style={styles.optionIcon}>
            <Icon name={icon} size={20} color="textSecondary" />
            <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
              <Icon name={icon} size={20} color="action" />
            </ToggleFade>
          </View>
        ) : null}
        <AppText style={styles.optionLabel}>{label}</AppText>
        <ToggleFade on={selected} style={styles.optionIcon}>
          <Icon name="check" size={20} color="action" />
        </ToggleFade>
        <ToggleFade on={selected} style={[styles.optionLine, { backgroundColor: theme.text }]} />
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

/** A short either-or choice written as text tabs: the chosen word is ink on a green line. Wraps when the words do not fit one line. */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return <TextTabs label={label} options={options} value={value} onChange={onChange} layout="wrap" />;
}

interface BarProps {
  /** 0 to 1. */
  progress: number;
  label: string;
}

/** A two point hairline that fills with green. */
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
  iconButton: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: size.touch / 2 },
  iconToggleFace: { borderRadius: size.touch / 2 },
  swatchTarget: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  swatchRing: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 3 },
  link: { minHeight: size.touch, justifyContent: 'center' },
  linkLeading: { alignSelf: 'flex-start' },
  linkCentered: { alignSelf: 'center' },
  option: { minHeight: size.option, paddingVertical: 15, borderBottomWidth: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space[3] },
  // The ink line lies over the hairline of the row, so choosing changes its colour and nothing else.
  optionLine: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 1 },
  optionDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  optionIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flexShrink: 1, flexGrow: 1 },
  track: { height: size.bar, overflow: 'hidden' },
});
