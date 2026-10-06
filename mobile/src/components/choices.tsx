import type { StyleTag, ThermalPreference } from '@/api/account';
import { styleOptions, thermalOptions } from '@/copy/labels';

import { OptionTile, Segmented } from './controls';
import { Labeled } from './forms';
import { Grid } from './Grid';

interface StyleChoiceProps {
  value: readonly StyleTag[];
  onChange: (styles: StyleTag[]) => void;
}

/** Style tiles, two to a row; several can be chosen. */
export function StyleChoice({ value, onChange }: StyleChoiceProps) {
  return (
    <Grid
      items={styleOptions}
      columns={2}
      keyOf={(option) => option.value}
      accessibilityLabel="Styl"
      renderItem={(option) => {
        const selected = value.includes(option.value);
        return (
          <OptionTile
            role="checkbox"
            label={option.label}
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

/** "How do you usually feel the temperature?" It shifts the weather thresholds a few degrees either way. */
export function ThermalChoice({ value, onChange }: ThermalChoiceProps) {
  return (
    <Labeled label="Jak zwykle odczuwasz temperaturę?" helper="Dzięki temu dobierzemy cieplejsze albo lżejsze zestawy.">
      <Segmented label="Odczuwanie temperatury" options={thermalOptions} value={value} onChange={onChange} />
    </Labeled>
  );
}
