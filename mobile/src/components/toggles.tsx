import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { OptionTile } from './controls';
import { Grid } from './Grid';
import { Icon } from './Icon';

interface ToggleRowProps {
  label: string;
  /** What switching it on means, in one short line. */
  meta?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  testID?: string;
}

/** A setting that takes effect the moment it is switched: one row of a list, the system switch on the right. */
export function ToggleRow({ label, meta, value, onChange, disabled, last = false, testID }: ToggleRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, last ? null : { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <AppText>{label}</AppText>
        {meta ? (
          <AppText variant="meta" color="textSecondary">
            {meta}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: theme.borderControl, true: theme.action }}
        ios_backgroundColor={theme.borderControl}
        thumbColor={value ? theme.onAction : theme.surface}
        testID={testID}
      />
    </View>
  );
}

interface ChipProps {
  label: string;
  /** What pressing does, for screen readers ("Usuń filtr: zapomniane"). */
  actionLabel: string;
  onRemove: () => void;
  testID?: string;
}

/** An active filter. Pressing it removes the filter. The one fully rounded shape besides the proposal tabs. */
export function Chip({ label, actionLabel, onRemove, testID }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      onPress={onRemove}
      testID={testID}
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.sage }, pressed ? styles.pressed : null]}>
      <AppText variant="secondaryStrong" color="onSage" numberOfLines={1}>
        {label}
      </AppText>
      <Icon name="close" size={16} color="onSage" />
    </Pressable>
  );
}

interface ChoiceGridProps<T extends string | number> {
  /** Names the group for screen readers. */
  label: string;
  options: readonly { value: T; label: string }[];
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
  rowText: { flex: 1, gap: 2 },
  chip: { height: size.touch, borderRadius: size.touch / 2, paddingLeft: space[4], paddingRight: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1] },
  pressed: { opacity: 0.85 },
});
