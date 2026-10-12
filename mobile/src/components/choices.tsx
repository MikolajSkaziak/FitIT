import { View } from 'react-native';

import type { Gender, StyleTag } from '@/api/account';
import { genderOptions, styleOptions } from '@/copy/labels';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { OptionTile } from './controls';
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

/** Photos of the styles with their names underneath, two to a row; several can be chosen. The photos come with the server's dictionaries, the labels do not wait for them. */
export function StyleChoice({ value, onChange, gender }: StyleChoiceProps) {
  const dictionaries = useDictionaries();
  return (
    <Grid
      items={styleOptions}
      columns={2}
      rowGap={20}
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

interface GenderChoiceProps {
  value: Gender | null;
  onChange: (value: Gender) => void;
}

/** The genders as a list of hairline rows; one can be chosen. */
export function GenderChoice({ value, onChange }: GenderChoiceProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Gender">
      {genderOptions.map((option) => (
        <OptionTile key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} testID={`gender-${option.value}`} />
      ))}
    </View>
  );
}
