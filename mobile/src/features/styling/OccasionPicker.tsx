import { StyleSheet, View } from 'react-native';

import type { Occasion } from '@/api/outfits';
import { AppText } from '@/components/AppText';
import { Field } from '@/components/Field';
import { ChoiceGrid } from '@/components/toggles';
import { occasionOptions } from '@/copy/labels';
import { space } from '@/theme';

/** The longest note the server takes. */
export const noteMaxLength = 200;

interface OccasionPickerProps {
  occasion: Occasion;
  onOccasion: (occasion: Occasion) => void;
  note: string;
  onNote: (note: string) => void;
}

/** "Okazja": six tiles, one chosen, and an optional note in the person's own words. Shared by Dziś and "Dobierz do tego". */
export function OccasionPicker({ occasion, onOccasion, note, onNote }: OccasionPickerProps) {
  return (
    <View style={styles.picker}>
      <View style={styles.group}>
        <AppText variant="subheading" accessibilityRole="header">
          Okazja
        </AppText>
        <ChoiceGrid label="Okazja" options={occasionOptions} value={occasion} onChange={onOccasion} testID="occasion" />
      </View>
      <Field
        label="Notatka (opcjonalnie)"
        value={note}
        onChangeText={onNote}
        placeholder="np. prezentacja przed klientem"
        maxLength={noteMaxLength}
        returnKeyType="done"
        testID="occasion-note"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space[6] },
  group: { gap: space[2] },
});
