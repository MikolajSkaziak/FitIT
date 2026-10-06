/**
 * Design tokens. The mock-ups in docs/design are the source; .ux-profile.md states the same values as rules.
 * One colour (sage) on quiet neutrals, bottle green for actions. Components use these tokens only.
 */

export const palettes = {
  light: {
    canvas: '#F5F7F3',
    surface: '#FFFFFF',
    text: '#1F2A25',
    textSecondary: '#57625C',
    border: '#E1E6DF',
    borderControl: '#838A84',
    action: '#2F5D4C',
    onAction: '#FFFFFF',
    sage: '#DCE7DA',
    onSage: '#2B5846',
    /** Backdrop of every garment and silhouette photo. */
    well: '#DCE7DA',
    wellLine: 'rgba(31,42,37,0.05)',
    skeleton: '#E7ECE5',
    disabledFill: '#E1E6DF',
    disabledText: '#57625C',
    danger: '#A33B3B',
    onDanger: '#FFFFFF',
    scrim: 'rgba(31,42,37,0.5)',
  },
  dark: {
    canvas: '#121815',
    surface: '#1B2320',
    text: '#ECF0EB',
    textSecondary: '#A5AFA8',
    border: '#2A342F',
    borderControl: '#6E7972',
    action: '#A8D2BD',
    onAction: '#10201A',
    sage: '#22362D',
    onSage: '#A8D2BD',
    /** Stays light in dark mode so dark clothes remain visible. */
    well: '#C3D1C4',
    wellLine: 'rgba(0,0,0,0)',
    skeleton: '#252E29',
    disabledFill: '#2A342F',
    disabledText: '#A5AFA8',
    danger: '#F2A3A3',
    onDanger: '#2A0E0E',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ColorToken = keyof typeof palettes.light;
export type Palette = Record<ColorToken, string>;

export const fonts = {
  display: 'BricolageGrotesque_600SemiBold',
  text: 'Figtree_400Regular',
  textStrong: 'Figtree_600SemiBold',
} as const;

/** Minor Third scale. `meta` is for helper text and counts only, never for primary content. */
export const typography = {
  meta: { fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
  metaStrong: { fontFamily: fonts.textStrong, fontSize: 12, lineHeight: 16 },
  secondary: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  secondaryStrong: { fontFamily: fonts.textStrong, fontSize: 14, lineHeight: 21 },
  body: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.textStrong, fontSize: 16, lineHeight: 24 },
  subheading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.19 },
  heading: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, letterSpacing: -0.23 },
  display: { fontFamily: fonts.display, fontSize: 33, lineHeight: 38, letterSpacing: -0.66 },
  logo: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, letterSpacing: -0.96 },
  logoSmall: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
} as const;

export type TextVariant = keyof typeof typography;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;

/** One shape rule: controls, cards, garment tiles, thumbnails, sheets. Pills only for proposal tabs and filter chips. */
export const radius = { control: 10, card: 16, well: 12, thumb: 8, sheet: 20, pill: 22, segment: 6 } as const;

export const size = {
  /** Height of buttons and inputs. */
  control: 48,
  controlCompact: 44,
  option: 56,
  /** Smallest touch target. */
  touch: 44,
  gutter: 16,
  /** Thickness of progress bars, step bars and the sheet grabber. */
  bar: 4,
} as const;

export const motion = { press: 100, exit: 150, enter: 200, sheet: 300 } as const;
