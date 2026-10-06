import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDate, fromJsDate, maskDate, parseDate, toJsDate } from '@/lib/dates';
import { radius, size, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { IconButton } from './controls';
import { Field, type FieldProps } from './Field';

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
        <IconButton icon={visible ? 'eyeOff' : 'eye'} label={visible ? 'Ukryj hasło' : 'Pokaż hasło'} color="textSecondary" onPress={() => setVisible((shown) => !shown)} />
      }
    />
  );
}

interface BirthDateFieldProps {
  /** "DD.MM.RRRR" as typed so far. */
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  helper?: string;
  error?: string | null;
  testID?: string;
}

const defaultPickerDate = { day: 1, month: 1, year: 2000 };

/** A date typed as digits (the dots appear on their own), or picked from the system calendar. */
export function BirthDateField({ value, onChangeText, label = 'Data urodzenia', helper, error, testID }: BirthDateFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState<Date | null>(null);
  const now = new Date();

  const openPicker = () => {
    const start = toJsDate(parseDate(value) ?? defaultPickerDate);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start,
        mode: 'date',
        maximumDate: now,
        onValueChange: (_event, date) => onChangeText(formatDate(fromJsDate(date))),
      });
    } else {
      setPicking(start);
    }
  };

  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={(text) => onChangeText(maskDate(text))}
        placeholder="DD.MM.RRRR"
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        maxLength={10}
        helper={helper}
        error={error}
        testID={testID}
        trailing={<IconButton icon="calendar" label="Wybierz datę z kalendarza" color="textSecondary" onPress={openPicker} />}
      />
      {Platform.OS === 'ios' ? (
        <Modal visible={picking !== null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij kalendarz" onPress={() => setPicking(null)} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />
          <View style={[styles.sheet, { backgroundColor: theme.canvas, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
            <View style={[styles.grabber, { backgroundColor: theme.borderControl }]} />
            <AppText variant="heading">{label}</AppText>
            {picking ? (
              <DateTimePicker
                value={picking}
                mode="date"
                display="spinner"
                locale="pl-PL"
                maximumDate={now}
                themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                onValueChange={(_event, date) => setPicking(date)}
              />
            ) : null}
            <Button
              label="Gotowe"
              onPress={() => {
                if (picking) {
                  onChangeText(formatDate(fromJsDate(picking)));
                }

                setPicking(null);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </>
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
        <AppText variant="meta" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
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
    <AppText variant="secondary" color="danger" align="center" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
      {message}
    </AppText>
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
});
