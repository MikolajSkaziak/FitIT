import type { Gender, StyleTag, ThermalPreference } from '@/api/account';

/** How the codes of the API read in the interface. Order here is the order on screen. */
export const genderOptions: readonly { value: Gender; label: string }[] = [
  { value: 'female', label: 'Kobieta' },
  { value: 'male', label: 'Mężczyzna' },
];

export const styleOptions: readonly { value: StyleTag; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart', label: 'Smart' },
  { value: 'elegant', label: 'Elegancki' },
  { value: 'sporty', label: 'Sportowy' },
  { value: 'streetwear', label: 'Streetwear' },
];

export const thermalOptions: readonly { value: ThermalPreference; label: string }[] = [
  { value: 'runs_cold', label: 'Marznę' },
  { value: 'normal', label: 'Normalnie' },
  { value: 'runs_warm', label: 'Jest mi ciepło' },
];

const find = <T extends string>(options: readonly { value: T; label: string }[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const genderLabel = (value: Gender): string => find(genderOptions, value);
export const styleLabel = (value: StyleTag): string => find(styleOptions, value);
export const thermalLabel = (value: ThermalPreference): string => find(thermalOptions, value);
