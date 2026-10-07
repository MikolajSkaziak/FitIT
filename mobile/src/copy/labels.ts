import type { Gender, StyleTag, ThermalPreference } from '@/api/account';
import type { Occasion, OutfitKind } from '@/api/outfits';

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

export const occasionOptions: readonly { value: Occasion; label: string }[] = [
  { value: 'everyday', label: 'Na co dzień' },
  { value: 'work', label: 'Praca lub uczelnia' },
  { value: 'business', label: 'Spotkanie biznesowe' },
  { value: 'date', label: 'Randka lub wieczór' },
  { value: 'friends', label: 'Ze znajomymi' },
  { value: 'workout', label: 'Trening' },
];

export const kindOptions: readonly { value: OutfitKind; label: string }[] = [
  { value: 'sure_bet', label: 'Pewniak' },
  { value: 'discovery', label: 'Odkrycie' },
  { value: 'new_pairing', label: 'Nowe połączenie' },
];

const find = <T extends string>(options: readonly { value: T; label: string }[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const genderLabel = (value: Gender): string => find(genderOptions, value);
export const styleLabel = (value: StyleTag): string => find(styleOptions, value);
export const thermalLabel = (value: ThermalPreference): string => find(thermalOptions, value);
export const occasionLabel = (value: Occasion): string => find(occasionOptions, value);
export const kindLabel = (value: OutfitKind): string => find(kindOptions, value);
