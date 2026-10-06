import { useColorScheme } from 'react-native';

import { palettes, type Palette } from './tokens';

export * from './tokens';

/** Colours for the current system scheme. */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}
