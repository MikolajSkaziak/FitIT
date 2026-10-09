import type { Gender, StyleTag, ThermalPreference } from '@/api/account';
import { genderOptions, styleOptions, thermalOptions } from '@/copy/labels';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { space } from '@/theme';

import { OptionTile, Segmented } from './controls';
import { Labeled } from './forms';
import { Grid } from './Grid';
import { StyleTile } from './StyleTile';

interface StyleChoiceProps {
  value: readonly StyleTag[];
  onChange: (styles: StyleTag[]) => void;
  /** Decides whose photo each style shows: a woman's for female, a man's for male, and the two in turn for anyone else. */
  gender: Gender | null;
}

/** Which of the two reference photos a tile at this place in the grid shows. */
export function photoModel(gender: Gender | null, index: number): 'woman' | 'man' {
  if (gender === 'female') {
    return 'woman';
  }

  if (gender === 'male') {
    return 'man';
  }

  return index % 2 === 0 ? 'woman' : 'man';
}

/** Photo tiles of the styles, two to a row; several can be chosen. The photos come with the server's dictionaries, the labels do not wait for them. */
export function StyleChoice({ value, onChange, gender }: StyleChoiceProps) {
  const dictionaries = useDictionaries();
  return (
    <Grid
      items={styleOptions}
      columns={2}
      rowGap={space[4]}
      keyOf={(option) => option.value}
      accessibilityLabel="Style"
      renderItem={(option, index) => {
        const selected = value.includes(option.value);
        const entry = dictionaries.data?.styles.find((style) => style.code === option.value);
        return (
          <StyleTile
            label={option.label}
            photoUrl={photoModel(gender, index) === 'woman' ? entry?.womanImageUrl : entry?.manImageUrl}
            selected={selected}
            onPress={() => onChange(selected ? value.filter((style) => style !== option.value) : [...value, option.value])}
            testID={`style-${option.value}`}
          />
        );
      }}
    />
  );
}

interface ThermalChoiceProps {
  value: ThermalPreference;
  onChange: (value: ThermalPreference) => void;
}

/** "How do you usually feel the cold?" It shifts the weather thresholds a few degrees either way. */
export function ThermalChoice({ value, onChange }: ThermalChoiceProps) {
  return (
    <Labeled label="How do you usually feel the cold?" helper="We’ll pick warmer or lighter outfits to match.">
      <Segmented label="How you feel the cold" options={thermalOptions} value={value} onChange={onChange} />
    </Labeled>
  );
}

interface GenderChoiceProps {
  value: Gender | null;
  onChange: (value: Gender) => void;
}

/** Gender tiles, two to a row, so the longer labels fit; one can be chosen. */
export function GenderChoice({ value, onChange }: GenderChoiceProps) {
  return (
    <Grid
      items={genderOptions}
      columns={2}
      keyOf={(option) => option.value}
      accessibilityRole="radiogroup"
      accessibilityLabel="Gender"
      renderItem={(option) => <OptionTile label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} testID={`gender-${option.value}`} />}
    />
  );
}
