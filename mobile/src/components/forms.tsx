import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { digitsUpTo, months, type DateParts } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
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
        <IconButton bare icon={visible ? 'eyeOff' : 'eye'} label={visible ? 'Hide password' : 'Show password'} color="textSecondary" onPress={() => setVisible((shown) => !shown)} />
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
 * onto lines of their own, each with its caption above. The month looks like the lines beside it.
 */
export function BirthDateField({ value, onChange, label = 'Birth date', helper, error, testID }: BirthDateFieldProps) {
  const [choosing, setChoosing] = useState(false);
  return (
    <View style={styles.labeled} testID={testID}>
      <AppText variant="eyebrow">{label}</AppText>
      <View style={styles.parts}>
        <View style={styles.partMonth}>
          <AppText variant="caption" color="textSecondary">
            Month
          </AppText>
          <MonthButton month={value.month} invalid={Boolean(error)} onPress={() => setChoosing(true)} testID={testID ? `${testID}-month` : undefined} />
        </View>
        <View style={styles.partDay}>
          <Field
            label="Day"
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
        <View style={styles.partYear}>
          <Field
            label="Year"
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

/** Looks like the underlined fields next to it; opens the list of months. */
function MonthButton({ month, invalid, onPress, testID }: MonthButtonProps) {
  const theme = useTheme();
  const name = month === null ? null : months[month - 1];
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={name ? `Month, ${name}` : 'Month, not chosen'}
      onPress={onPress}
      testID={testID}
      style={styles.month}>
      <AppText numberOfLines={1} color={name ? 'text' : 'textSecondary'} style={styles.monthName}>
        {name ?? 'Select'}
      </AppText>
      <Icon name="down" size={16} color="textSecondary" />
      <View style={[styles.monthLine, { backgroundColor: invalid ? theme.danger : theme.borderControl, height: invalid ? 2 : 1 }]} />
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => {
          haptics.press('quiet');
          onClose();
        }}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
      />
      <View style={[styles.sheet, { backgroundColor: theme.canvas, paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
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
                onPress={() => {
                  haptics.press('nav');
                  onChoose(index + 1);
                }}
                testID={`month-${index + 1}`}
                style={({ pressed }) => [styles.monthRow, { borderBottomColor: chosen ? theme.text : theme.border }, pressed ? { backgroundColor: theme.sage } : null]}>
                <AppText variant={chosen ? 'title' : 'body'}>
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

/** A control that is not a text input (a row of text tabs, a list of rows), under an eyebrow label, with the help and error lines of a field. */
export function Labeled({ label, helper, error, children }: LabeledProps) {
  return (
    <View style={styles.labeled}>
      <AppText variant="eyebrow">{label}</AppText>
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
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: size.gutter,
    gap: space[2],
  },
  grabber: { alignSelf: 'center', width: 36, height: size.grabber, borderRadius: 3, marginTop: 10, marginBottom: space[2] },
  labeled: { gap: space[2] },
  formError: { paddingBottom: space[1] },
  parts: { flexDirection: 'row', gap: space[4], alignItems: 'flex-start' },
  partMonth: { flex: 5 },
  partDay: { flex: 2 },
  partYear: { flex: 3 },
  month: { height: size.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] },
  monthLine: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  monthName: { flexShrink: 1 },
  monthList: { maxHeight: 360 },
  monthRow: { minHeight: size.option, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
