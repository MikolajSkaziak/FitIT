import type { ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import type { Haptic } from '@/lib/haptics';
import { radius, size, space, useTheme, type ColorToken } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressScale, Shimmer } from './motion';

/**
 * What used to be the bordered frame of a list. Lists are hairline rows straight on the page now, so this only
 * groups them; it is kept so the screens that wrap their rows in it need no change.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

interface RowProps {
  label: string;
  /** An icon before the label. Rows of one list that have one all start their text at the same place. */
  icon?: IconName;
  /** Ink by default; the secondary colour for a quiet fact, the action colour for a way into something. */
  iconColor?: ColorToken;
  /** Anything else in front of the label instead of an icon: the 56 point thumbnail of a garment. */
  leading?: ReactNode;
  /** Shown on the right in the secondary colour. */
  value?: string;
  /** A second, smaller line under the label. */
  meta?: string;
  /** A control on the right, such as a switch. */
  right?: ReactNode;
  /** Makes the whole row a button and adds a chevron. */
  onPress?: () => void;
  /** The label is the name of a thing rather than of a setting: semibold. A chosen row is always strong. */
  strong?: boolean;
  /** The chosen row of a list: an ink line under it and a green check at its end instead of a chevron. */
  selected?: boolean;
  /** With `onPress`: "radio" or "checkbox" when the row is an option that `selected` answers. A plain button otherwise. */
  role?: 'button' | 'radio' | 'checkbox';
  /** The row is itself a call to action: label in the action colour. */
  accent?: boolean;
  /** A destructive way out: the icon, the words and the chevron all in the danger colour. */
  danger?: boolean;
  /** The tap on a press: `auto` is a selection tick (Rigid for a danger row, nothing for an option that is already chosen); `none` where another cue takes over. */
  haptic?: Haptic;
  /** No line under the row. Only for a row that closes against another line. */
  last?: boolean;
  testID?: string;
}

/** One hairline row of a list: settings, the pieces of an outfit, search matches, the options of a question. */
export function Row({ label, icon, iconColor = 'text', leading, value, meta, right, onPress, strong = false, selected = false, role = 'button', accent = false, danger = false, haptic = 'auto', last = false, testID }: RowProps) {
  const theme = useTheme();
  const chevron = Boolean(onPress) && role === 'button' && !selected;
  const content = (
    <>
      <View style={styles.rowLead}>
        {leading}
        {icon ? <Icon name={icon} size={20} color={danger ? 'danger' : accent ? 'action' : iconColor} /> : null}
        <View style={styles.rowText}>
          <AppText variant={strong || selected || accent ? 'title' : 'body'} color={danger ? 'danger' : accent ? 'action' : 'text'}>
            {label}
          </AppText>
          {meta ? (
            <AppText variant="caption" color="textSecondary">
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>
      {value || right || chevron || selected ? (
        <View style={styles.rowRight}>
          {value ? (
            <AppText variant="secondary" color="textSecondary" tabular align="right" numberOfLines={1} style={styles.value}>
              {value}
            </AppText>
          ) : null}
          {right}
          {selected ? <Icon name="check" size={20} color="action" /> : null}
          {chevron ? <Icon name="forward" size={16} color={danger ? 'danger' : accent ? 'action' : 'textSecondary'} /> : null}
        </View>
      ) : null}
    </>
  );
  const frame = [styles.row, last ? null : { borderBottomWidth: 1, borderBottomColor: selected ? theme.text : theme.border }];
  if (!onPress) {
    return (
      <View style={frame} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={role === 'button' ? undefined : { checked: selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      haptic={haptic === 'auto' ? (danger ? 'danger' : role !== 'button' && selected ? 'none' : 'nav') : haptic}
      testID={testID}
      style={frame}>
      {content}
    </PressScale>
  );
}

/** An eyebrow label with the rows it names. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <AppText variant="eyebrow" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A placeholder in the shape of what is loading, with a light that sweeps across it while it waits. */
export function Skeleton({ width = '100%', height, radius: corner = radius.thumb, style }: SkeletonProps) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: corner, backgroundColor: theme.skeleton, overflow: 'hidden' }, style]}>
      <Shimmer color={theme.skeletonShine} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.option, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  rowLead: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flexShrink: 1 },
  // The value gives way long before the label does: a label never breaks mid-word to make room for it.
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 8 },
  value: { flexShrink: 1 },
});
