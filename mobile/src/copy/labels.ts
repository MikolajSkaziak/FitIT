import type { ClothingSize, Gender, LegLength, StyleTag, ThermalPreference } from '@/api/account';
import type { Occasion, OutfitKind } from '@/api/outfits';
import type { IconName } from '@/components/Icon';

/** How the codes of the API read in the interface. Order here is the order on screen. */
export const genderOptions: readonly { value: Gender; label: string }[] = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

export const styleOptions: readonly { value: StyleTag; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart', label: 'Smart casual' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'old_money', label: 'Old money' },
  { value: 'preppy', label: 'Preppy' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'y2k', label: 'Y2K' },
  { value: 'boho', label: 'Boho' },
  { value: 'grunge', label: 'Grunge' },
  { value: 'gorpcore', label: 'Gorpcore' },
  { value: 'business', label: 'Business' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'edgy', label: 'Edgy' },
];

export const thermalOptions: readonly { value: ThermalPreference; label: string }[] = [
  { value: 'runs_cold', label: 'I get cold easily' },
  { value: 'normal', label: 'About average' },
  { value: 'runs_warm', label: 'I run warm' },
];

export const sizeOptions: readonly { value: ClothingSize; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
  { value: 'xxl', label: 'XXL' },
];

/** The size written out, for screen readers and for the label on the size screen. */
export const sizeNames: Record<ClothingSize, string> = {
  xs: 'Extra small',
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
  xxl: 'Double extra large',
};

/** Neutral words: a comparison with average, never a judgement. */
export const legOptions: readonly { value: LegLength; label: string }[] = [
  { value: 'shorter', label: 'Shorter' },
  { value: 'average', label: 'Average' },
  { value: 'longer', label: 'Longer' },
];

/** What each leg length means for fit, in a sentence: the caption under its figure, and the card under the choice. */
export const legDetails: Record<LegLength, { caption: string; title: string; hint: string }> = {
  shorter: { caption: 'longer torso', title: 'Shorter legs', hint: 'Pants often run long on you and need a hem or a cuff.' },
  average: { caption: 'balanced', title: 'Average legs', hint: 'Regular lengths usually fit you as they are.' },
  longer: { caption: 'shorter torso', title: 'Longer legs', hint: 'Pants often end above the ankle unless you buy a long cut.' },
};

/** Shown in the card under the figures while nothing is chosen. */
export const legsNotSet = { title: 'Not set', hint: 'Pick the one closest to you whenever you like.' } as const;

/** Each occasion with the icon that stands for it wherever the occasion is named (the one place the pairing lives). */
export const occasionOptions: readonly { value: Occasion; label: string; icon: IconName }[] = [
  { value: 'everyday', label: 'Everyday', icon: 'coffee' },
  { value: 'work', label: 'Work or school', icon: 'briefcase' },
  { value: 'business', label: 'Business meeting', icon: 'handshake' },
  { value: 'date', label: 'Date or night out', icon: 'wine' },
  { value: 'friends', label: 'With friends', icon: 'friends' },
  { value: 'workout', label: 'Workout', icon: 'barbell' },
];

export const kindOptions: readonly { value: OutfitKind; label: string }[] = [
  { value: 'sure_bet', label: 'Sure bet' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'new_pairing', label: 'New pairing' },
];

const find = <T extends string>(options: readonly { value: T; label: string }[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const genderLabel = (value: Gender): string => find(genderOptions, value);
export const styleLabel = (value: StyleTag): string => find(styleOptions, value);
export const thermalLabel = (value: ThermalPreference): string => find(thermalOptions, value);
export const sizeLabel = (value: ClothingSize | null | undefined): string => (value ? find(sizeOptions, value) : 'Not set');
export const legsLabel = (value: LegLength | null | undefined): string => (value ? find(legOptions, value) : 'Not set');
export const occasionLabel = (value: Occasion): string => find(occasionOptions, value);
export const occasionIcon = (value: Occasion): IconName => occasionOptions.find((option) => option.value === value)?.icon ?? 'coffee';
export const kindLabel = (value: OutfitKind): string => find(kindOptions, value);
