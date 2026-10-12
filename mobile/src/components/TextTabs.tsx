import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import * as haptics from '@/lib/haptics';
import { size, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { CrossFade, PressScale } from './motion';

interface TextTabProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** "radio" when one of the group is chosen, "checkbox" when several may be, "tab" when it switches what is shown below. */
  role?: 'radio' | 'checkbox' | 'tab';
  /** A small decorative icon before the label. */
  icon?: IconName;
  /** What a screen reader says, when it is more than the label ("Sure bet, 1 of 3"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * One word of a row of text tabs. Idle it is a quiet 15 point word; chosen it is 17 point semibold ink on a two point
 * green line. The tab is always as wide as its chosen look, which is drawn once unseen to hold the room, so choosing
 * moves nothing: the chosen look shows at once and the lost one fades out over `motion.press`, like every selection.
 */
export function TextTab({ label, selected, onPress, role = 'radio', icon, accessibilityLabel, style, testID }: TextTabProps) {
  const theme = useTheme();
  const look = (lit: boolean) => (
    <>
      <View style={styles.words}>
        {icon ? <Icon name={icon} size={16} color={lit ? 'text' : 'textSecondary'} /> : null}
        <AppText variant={lit ? 'title' : 'secondary'} color={lit ? 'text' : 'textSecondary'} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <View style={[styles.line, lit ? { backgroundColor: theme.action } : null]} />
    </>
  );
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={role === 'tab' ? { selected } : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      haptic="none"
      onPress={() => {
        // Choosing the one that is already chosen changes nothing, so it gives no cue.
        if (role === 'checkbox' || !selected) {
          haptics.select();
        }

        onPress();
      }}
      testID={testID}
      style={[styles.tab, style]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.room}>
        {look(true)}
      </View>
      <CrossFade on={selected} style={StyleSheet.absoluteFill} faceStyle={styles.face}>
        {look}
      </CrossFade>
    </PressScale>
  );
}

interface TextTabsProps<T extends string | number> {
  /** Names the group for screen readers. */
  label: string;
  options: readonly { value: T; label: string; icon?: IconName; accessibilityLabel?: string }[];
  /** One value for a single choice, a list for several. */
  value: T | null | readonly T[];
  onChange: (value: T) => void;
  /**
   * "scroll": one line that scrolls sideways and runs to both screen edges, for the sections of a screen.
   * "wrap": as many lines as it takes, for the values of a filter. "row": one line that never scrolls, for two or three words.
   */
  layout?: 'scroll' | 'wrap' | 'row';
  /** The tabs switch what is shown below them, so they are announced as tabs instead of as a choice. */
  tabs?: boolean;
  /** Each tab gets `${testID}-${value}`. */
  testID?: string;
}

/** Local switching and filter values, written as words: no pills, no boxes. The line under the chosen word is the cue. */
export function TextTabs<T extends string | number>({ label, options, value, onChange, layout = 'scroll', tabs = false, testID }: TextTabsProps<T>) {
  const several = Array.isArray(value);
  const chosen = (option: T) => (several ? (value as readonly T[]).includes(option) : value === option);
  const groupRole = tabs ? 'tablist' : several ? undefined : 'radiogroup';
  const items = options.map((option) => (
    <TextTab
      key={String(option.value)}
      role={tabs ? 'tab' : several ? 'checkbox' : 'radio'}
      label={option.label}
      icon={option.icon}
      accessibilityLabel={option.accessibilityLabel}
      selected={chosen(option.value)}
      onPress={() => onChange(option.value)}
      testID={testID ? `${testID}-${option.value}` : undefined}
    />
  ));
  if (layout === 'scroll') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole={groupRole}
        accessibilityLabel={label}
        style={styles.bleed}
        contentContainerStyle={styles.scroll}
        testID={testID}>
        {items}
      </ScrollView>
    );
  }

  return (
    <View accessibilityRole={groupRole} accessibilityLabel={label} style={layout === 'wrap' ? styles.wrap : styles.row} testID={testID}>
      {items}
    </View>
  );
}

/** The gap between two words of a row. */
const gap = 22;

const styles = StyleSheet.create({
  // A 44 point target; the words sit on its floor, so tabs of a row share one baseline whichever is chosen.
  tab: { height: size.touch },
  room: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', opacity: 0 },
  face: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start' },
  words: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { alignSelf: 'stretch', height: size.bar, marginTop: 6 },
  bleed: { marginHorizontal: -size.gutter, flexGrow: 0 },
  scroll: { paddingHorizontal: size.gutter, gap, alignItems: 'flex-end' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: gap },
  row: { flexDirection: 'row', gap, alignItems: 'flex-end' },
});
