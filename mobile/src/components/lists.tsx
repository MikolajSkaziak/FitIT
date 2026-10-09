import type { ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressScale } from './motion';

/** The quiet frame of a list: surface, hairline border, card radius. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

interface RowProps {
  label: string;
  /** A quiet icon before the label. Rows of one list that have one all start their text at the same place. */
  icon?: IconName;
  /** Shown on the right in the secondary colour. */
  value?: string;
  /** A second, smaller line under the label. */
  meta?: string;
  /** A control on the right, such as a switch. */
  right?: ReactNode;
  /** Makes the whole row a button and adds a chevron. */
  onPress?: () => void;
  /** The row is itself a call to action: label in the action colour. */
  accent?: boolean;
  last?: boolean;
  testID?: string;
}

/** One line of a settings list. */
export function Row({ label, icon, value, meta, right, onPress, accent = false, last = false, testID }: RowProps) {
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.rowLead}>
        {icon ? <Icon name={icon} size={20} color="textSecondary" /> : null}
        <View style={styles.rowText}>
          <AppText variant={accent ? 'label' : 'body'} color={accent ? 'action' : 'text'}>
            {label}
          </AppText>
          {meta ? (
            <AppText variant="meta" color="textSecondary">
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>
      {value || right || onPress ? (
        <View style={styles.rowRight}>
          {value ? (
            <AppText color="textSecondary" tabular align="right" numberOfLines={1} style={styles.value}>
              {value}
            </AppText>
          ) : null}
          {right}
          {onPress ? <Icon name="forward" size={20} color={accent ? 'action' : 'textSecondary'} /> : null}
        </View>
      ) : null}
    </>
  );
  const frame = [styles.row, last ? null : { borderBottomWidth: 1, borderBottomColor: theme.border }];
  if (!onPress) {
    return (
      <View style={frame} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <PressScale accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} testID={testID} style={frame}>
      {content}
    </PressScale>
  );
}

/** A heading with the list it names. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="subheading" accessibilityRole="header">
        {title}
      </AppText>
      <Card>{children}</Card>
    </View>
  );
}

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A still placeholder in the shape of what is loading. */
export function Skeleton({ width = '100%', height, radius: corner = radius.thumb, style }: SkeletonProps) {
  const theme = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: corner, backgroundColor: theme.skeleton }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  row: { minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  rowLead: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flexShrink: 1, gap: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  value: { flexShrink: 1 },
  group: { gap: space[2] },
});
