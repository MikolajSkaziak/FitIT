import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { digitsUpTo, months, type DateParts } from '@/lib/dates';
import { motion, radius, size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';
import { Field, type FieldProps } from './Field';
import { Icon } from './Icon';
import { Fade, PressScale } from './motion';

/** Password input with a control to show what was typed. */
export function PasswordField({ isNew = false, ...field }: FieldProps & { isNew?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      textContentType={isNew ? 'newPassword' : 'password'}
      secureTextEntry={!visible}
      maxLength={128}
      {...field}
      trailing={
        <IconButton icon={visible ? 'eyeOff' : 'eye'} label={visible ? 'Hide password' : 'Show password'} color="textSecondary" onPress={() => setVisible((shown) => !shown)} />
      }
    />
  );
}

interface BirthDateFieldProps {
  value: DateParts;
  onChange: (parts: DateParts) => void;
  label?: string;
  helper?: string;
  error?: string | null;
  testID?: string;
}

/**
 * A date with no numeric order to misread: the month is picked by name from a list, the day and the year are typed
 * into boxes of their own, each with its label above.
 */
export function BirthDateField({ value, onChange, label = 'Birth date', helper, error, testID }: BirthDateFieldProps) {
  const [choosing, setChoosing] = useState(false);
  return (
    <View style={styles.labeled} testID={testID}>
      <AppText variant="secondaryStrong">{label}</AppText>
      <View style={styles.parts}>
        <View style={[styles.part, styles.partMonth]}>
          <AppText variant="meta" color="textSecondary">
            Month
          </AppText>
          <MonthButton month={value.month} invalid={Boolean(error)} onPress={() => setChoosing(true)} testID={testID ? `${testID}-month` : undefined} />
        </View>
        <View style={[styles.part, styles.partDay]}>
          <AppText variant="meta" color="textSecondary">
            Day
          </AppText>
          <Field
            accessibilityLabel={`${label}, day`}
            value={value.day}
            onChangeText={(text) => onChange({ ...value, day: digitsUpTo(text, 2) })}
            placeholder="5"
            keyboardType="number-pad"
            maxLength={2}
            invalid={Boolean(error)}
            testID={testID ? `${testID}-day` : undefined}
          />
        </View>
        <View style={[styles.part, styles.partYear]}>
          <AppText variant="meta" color="textSecondary">
            Year
          </AppText>
          <Field
            accessibilityLabel={`${label}, year`}
            value={value.year}
            onChangeText={(text) => onChange({ ...value, year: digitsUpTo(text, 4) })}
            placeholder="1999"
            keyboardType="number-pad"
            autoComplete="birthdate-year"
            maxLength={4}
            invalid={Boolean(error)}
            testID={testID ? `${testID}-year` : undefined}
          />
        </View>
      </View>
      {error ? (
        <Fade key={error}>
          <AppText variant="meta" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        </Fade>
      ) : helper ? (
        <AppText variant="meta" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
      <MonthSheet
        visible={choosing}
        month={value.month}
        onChoose={(month) => {
          onChange({ ...value, month });
          setChoosing(false);
        }}
        onClose={() => setChoosing(false)}
      />
    </View>
  );
}

interface MonthButtonProps {
  month: number | null;
  invalid: boolean;
  onPress: () => void;
  testID?: string;
}

/** Looks like the text boxes next to it; opens the list of months. */
function MonthButton({ month, invalid, onPress, testID }: MonthButtonProps) {
  const theme = useTheme();
  const name = month === null ? null : months[month - 1];
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={name ? `Month, ${name}` : 'Month, not chosen'}
      onPress={onPress}
      testID={testID}
      style={[styles.month, { backgroundColor: theme.surface, borderColor: invalid ? theme.danger : theme.borderControl, borderWidth: invalid ? 2 : 1 }]}>
      <AppText numberOfLines={1} color={name ? 'text' : 'textSecondary'} style={styles.monthName}>
        {name ?? 'Select'}
      </AppText>
      <Icon name="down" size={16} color="textSecondary" />
    </PressScale>
  );
}

interface MonthSheetProps {
  visible: boolean;
  month: number | null;
  onChoose: (month: number) => void;
  onClose: () => void;
}

/** The twelve month names in a sheet from the bottom; one press chooses and closes. */
function MonthSheet({ visible, month, onChoose, onClose }: MonthSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />
      <View style={[styles.sheet, { backgroundColor: theme.canvas, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <View style={[styles.grabber, { backgroundColor: theme.borderControl }]} />
        <AppText variant="heading" accessibilityRole="header">
          Month
        </AppText>
        <ScrollView style={styles.monthList} showsVerticalScrollIndicator={false}>
          {months.map((name, index) => {
            const chosen = month === index + 1;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                accessibilityLabel={name}
                onPress={() => onChoose(index + 1)}
                testID={`month-${index + 1}`}
                style={({ pressed }) => [styles.monthRow, pressed ? { backgroundColor: theme.sage } : null]}>
                <AppText variant="body" color={chosen ? 'action' : 'text'}>
                  {name}
                </AppText>
                {chosen ? <Icon name="check" size={20} color="action" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface LabeledProps {
  label: string;
  helper?: string;
  error?: string | null;
  children: ReactNode;
}

/** A control that is not a text input (a segmented choice), with the same label, help and error lines as a field. */
export function Labeled({ label, helper, error, children }: LabeledProps) {
  return (
    <View style={styles.labeled}>
      <AppText variant="secondaryStrong">{label}</AppText>
      {children}
      {error ? (
        <Fade key={error}>
          <AppText variant="meta" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        </Fade>
      ) : helper ? (
        <AppText variant="meta" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

/** What went wrong with the whole form, said right above the button that sends it. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) {
    return null;
  }

  return (
    <Fade key={message} exit duration={motion.exit}>
      <AppText variant="secondary" color="danger" align="center" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
        {message}
      </AppText>
    </Fade>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: size.gutter,
    gap: space[2],
  },
  grabber: { alignSelf: 'center', width: 40, height: size.bar, borderRadius: size.bar / 2, marginTop: space[2], marginBottom: space[1] },
  labeled: { gap: space[2] },
  formError: { paddingBottom: space[1] },
  parts: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  part: { gap: space[1] },
  partMonth: { flex: 5 },
  partDay: { flex: 2 },
  partYear: { flex: 3 },
  month: { height: size.control, borderRadius: radius.control, paddingLeft: 16, paddingRight: space[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] },
  monthName: { flexShrink: 1 },
  monthList: { maxHeight: 360 },
  monthRow: { minHeight: size.touch, paddingHorizontal: space[2], borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
