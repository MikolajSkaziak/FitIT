import { Platform, StyleSheet, Switch, View } from 'react-native';

import { size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { OptionTile } from './controls';
import { Grid } from './Grid';
import { Icon, type IconName } from './Icon';
import { PressScale, ToggleFade } from './motion';

/**
 * The size the native switch really draws at. React Native reserves 51x31 for it on iOS, but the iOS 26 switch is
 * 63x28; left at the reserved size it is drawn from the corner of a box that is not its own and sits off centre.
 * Giving the switch its real size, in a wrapper of the same size that the row centres, keeps the layout box and the
 * drawn control identical. Android measures its own control, so the wrapper only centres whatever it measures.
 */
const switchSize = Platform.OS === 'ios' ? (parseInt(String(Platform.Version), 10) >= 26 ? { width: 63, height: 28 } : { width: 51, height: 31 }) : null;

interface ToggleRowProps {
  label: string;
  /** A quiet icon before the label, lined up with the icons of the rows around it. */
  icon?: IconName;
  /** What switching it on means, in one short line. */
  meta?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  testID?: string;
}

/** A setting that takes effect the moment it is switched: one row of a list, the system switch on the right. */
export function ToggleRow({ label, icon, meta, value, onChange, disabled, last = false, testID }: ToggleRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, last ? null : { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={styles.rowLead}>
        {icon ? <Icon name={icon} size={20} color="textSecondary" /> : null}
        <View style={styles.rowText}>
          <AppText>{label}</AppText>
          {meta ? (
            <AppText variant="meta" color="textSecondary">
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={[styles.switchBox, switchSize]}>
        <Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ false: theme.borderControl, true: theme.action }}
          ios_backgroundColor={theme.borderControl}
          thumbColor={value ? theme.onAction : theme.surface}
          style={switchSize}
          testID={testID}
        />
      </View>
    </View>
  );
}

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** "radio" when one of the group is chosen, "checkbox" when several may be. */
  role?: 'radio' | 'checkbox';
  /** A decorative icon before the label. */
  icon?: IconName;
  testID?: string;
}

/**
 * A filter written as a pill, one of several in a row or a wrapped line. Outlined when idle; sage fill and a green border when
 * chosen. Like the option tile, the label is drawn once and never moves: only the two faces under it fade, and the chosen face
 * is an overlay, so the pill keeps its size. No check and no "x": the fill and the border are the cue. The one fully rounded
 * shape besides the proposal tabs.
 */
export function Pill({ label, selected, onPress, role = 'checkbox', icon, testID }: PillProps) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={styles.pill}>
      <View style={[StyleSheet.absoluteFill, styles.pillFace, { backgroundColor: theme.surface, borderColor: theme.borderControl, borderWidth: 1 }]} />
      <ToggleFade on={selected} style={[StyleSheet.absoluteFill, styles.pillFace, { backgroundColor: theme.sage, borderColor: theme.action, borderWidth: 2 }]} />
      {icon ? (
        <View style={styles.pillIcon}>
          <Icon name={icon} size={20} color="textSecondary" />
          <ToggleFade on={selected} style={StyleSheet.absoluteFill}>
            <Icon name={icon} size={20} color="action" />
          </ToggleFade>
        </View>
      ) : null}
      <AppText variant="secondaryStrong" numberOfLines={1}>
        {label}
      </AppText>
    </PressScale>
  );
}

interface ChoiceGridProps<T extends string | number> {
  /** Names the group for screen readers. */
  label: string;
  options: readonly { value: T; label: string; icon?: IconName }[];
  /** One value for a single choice, a list for several. */
  value: T | null | readonly T[];
  onChange: (value: T) => void;
  columns?: 2 | 3;
  testID?: string;
}

/** A closed list shown as tiles: all options visible at once, no menu to open. */
export function ChoiceGrid<T extends string | number>({ label, options, value, onChange, columns = 2, testID }: ChoiceGridProps<T>) {
  const several = Array.isArray(value);
  const chosen = (option: T) => (several ? (value as readonly T[]).includes(option) : value === option);
  return (
    <Grid
      items={options}
      columns={columns}
      keyOf={(option) => String(option.value)}
      accessibilityRole={several ? undefined : 'radiogroup'}
      accessibilityLabel={label}
      renderItem={(option) => (
        <OptionTile
          role={several ? 'checkbox' : 'radio'}
          label={option.label}
          icon={option.icon}
          selected={chosen(option.value)}
          onPress={() => onChange(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  rowLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: 2 },
  switchBox: { alignItems: 'center', justifyContent: 'center' },
  pill: { height: size.touch, paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  pillIcon: { width: 20, height: 20 },
  pillFace: { borderRadius: size.touch / 2 },
});
