/**
 * Design tokens. The artboards in docs/design/redesign (and their `fitit.css`) are the source.
 * Porcelain, ink and hairlines, bottle green for actions, a serif for the large words. Components use these tokens only.
 */

export const palettes = {
  light: {
    /** Porcelain page. */
    canvas: '#FAFAF7',
    surface: '#FFFFFF',
    /** Ink. */
    text: '#17201C',
    textSecondary: '#5A635E',
    /** The hairline: list rows, round buttons, the floating bar, progress tracks. */
    border: '#D9DED6',
    /** The line of a control: an underlined field, a secondary button. */
    borderControl: '#7C857F',
    action: '#2F5D4C',
    onAction: '#FFFFFF',
    /** The quiet fill of the active tab, an avatar, a pressed row: the colour of the well. */
    sage: '#E6EBE3',
    onSage: '#2F5D4C',
    /** Backdrop of every garment and silhouette photo. */
    well: '#E6EBE3',
    wellLine: 'rgba(23,32,28,0)',
    /** The bottle-green rail and its stitching that a garment label hangs from; fixed, because the well stays light. */
    wellRail: '#2F5D4C',
    wellStitch: 'rgba(47,93,76,0.35)',
    /** The care label laid over a photo corner, light and dark; fixed for the same reason. */
    wellChip: '#FFFFFF',
    onWellChip: '#17201C',
    wellBadge: 'rgba(23,32,28,0.72)',
    onWellBadge: '#FFFFFF',
    /** The idle dots of a pager. */
    dot: '#B9C2B8',
    /** A tailor's tape: light paper in both schemes, with its ticks, hairline and marker. */
    paper: '#F3EFE2',
    paperInk: '#5A635E',
    paperLine: 'rgba(23,32,28,0.12)',
    paperMark: '#2F5D4C',
    /** Schematic figures on the well, idle and chosen. */
    figureTorso: '#BECBBD',
    figureLegs: '#A2B5A6',
    figureLine: 'rgba(23,32,28,0.3)',
    figureTorsoOn: '#A2B5A6',
    figureLegsOn: '#2F5D4C',
    skeleton: '#ECEFE9',
    /** The light that sweeps across a placeholder while its content loads. */
    skeletonShine: '#F8FAF6',
    disabledFill: '#D9DED6',
    disabledText: '#5A635E',
    danger: '#A33B3B',
    onDanger: '#FFFFFF',
    scrim: 'rgba(23,32,28,0.4)',
    /** The camera: chrome drawn over a live scene, the same in both schemes because the scene does not follow the theme. */
    scene: '#000000',
    onScene: '#FFFFFF',
    onSceneDim: 'rgba(255,255,255,0.5)',
    /** The framing guide: a hairline that reads on any scene. */
    sceneLine: 'rgba(255,255,255,0.9)',
    /** Behind the controls and the caption. White text on it holds 4.5:1 even over a white scene. */
    sceneScrim: 'rgba(0,0,0,0.6)',
    /** What the one soft shadow is cast in (the floating bar, the add button, a hanging tag). See `shadow`. */
    shadow: '#17201C',
  },
  dark: {
    canvas: '#111613',
    surface: '#1A211D',
    text: '#EEF1EC',
    textSecondary: '#A3ACA6',
    border: '#2B342F',
    borderControl: '#727C75',
    action: '#A8D2BD',
    onAction: '#10201A',
    sage: '#22332B',
    onSage: '#A8D2BD',
    /** Stays light in dark mode so dark clothes remain visible. */
    well: '#C9D2C8',
    wellLine: 'rgba(0,0,0,0)',
    wellRail: '#2F5D4C',
    wellStitch: 'rgba(47,93,76,0.35)',
    wellChip: '#FFFFFF',
    onWellChip: '#17201C',
    wellBadge: 'rgba(23,32,28,0.72)',
    onWellBadge: '#FFFFFF',
    dot: '#3A4740',
    paper: '#F3EFE2',
    paperInk: '#5A635E',
    paperLine: 'rgba(23,32,28,0.12)',
    paperMark: '#2F5D4C',
    figureTorso: '#AFC2B1',
    figureLegs: '#8FA894',
    figureLine: 'rgba(23,32,28,0.3)',
    figureTorsoOn: '#4F6B5C',
    figureLegsOn: '#A8D2BD',
    skeleton: '#232B27',
    skeletonShine: '#313B36',
    disabledFill: '#2B342F',
    disabledText: '#A3ACA6',
    danger: '#F2A3A3',
    onDanger: '#2A0E0E',
    scrim: 'rgba(0,0,0,0.6)',
    scene: '#000000',
    onScene: '#FFFFFF',
    onSceneDim: 'rgba(255,255,255,0.5)',
    sceneLine: 'rgba(255,255,255,0.9)',
    sceneScrim: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
  },
} as const;

export type ColorToken = keyof typeof palettes.light;
export type Palette = Record<ColorToken, string>;

/** Two families: Bodoni Moda for the serif display sizes, Figtree for everything else. Loaded in `app/_layout.tsx`. */
export const fonts = {
  display: 'BodoniModa_500Medium',
  displayItalic: 'BodoniModa_500Medium_Italic',
  text: 'Figtree_400Regular',
  textMedium: 'Figtree_500Medium',
  textStrong: 'Figtree_600SemiBold',
} as const;

/**
 * The scale. The serif is used at 26 points and above only: `heading`, `display`, `figure` and the wordmark. The italic
 * variants carry the one accent word of a title (a name); nest them inside the upright variant of the same size.
 */
export const typography = {
  /** Helper text and counts, never primary content. */
  meta: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  metaStrong: { fontFamily: fonts.textStrong, fontSize: 13, lineHeight: 18 },
  /** The quiet line under a title in a tile or a row. */
  caption: { fontFamily: fonts.textMedium, fontSize: 13, lineHeight: 18 },
  /** The small uppercase label above a title or a list. Drawn in the secondary colour unless told otherwise. */
  eyebrow: { fontFamily: fonts.textStrong, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  /** The label under a tab icon. */
  micro: { fontFamily: fonts.textMedium, fontSize: 11, lineHeight: 14 },
  secondary: { fontFamily: fonts.text, fontSize: 15, lineHeight: 20 },
  secondaryStrong: { fontFamily: fonts.textStrong, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.text, fontSize: 17, lineHeight: 24 },
  /** The words on a button or a link. */
  label: { fontFamily: fonts.textStrong, fontSize: 17, lineHeight: 22 },
  /** The name of a thing: a garment under its photo, the chosen row, the active text tab. */
  title: { fontFamily: fonts.textStrong, fontSize: 17, lineHeight: 22 },
  subheading: { fontFamily: fonts.textStrong, fontSize: 17, lineHeight: 22 },
  heading: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, letterSpacing: -0.13 },
  headingItalic: { fontFamily: fonts.displayItalic, fontSize: 26, lineHeight: 34, letterSpacing: -0.13 },
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 46, letterSpacing: -0.36 },
  displayItalic: { fontFamily: fonts.displayItalic, fontSize: 36, lineHeight: 46, letterSpacing: -0.36 },
  /** The one large number of the app: the temperature on Today. */
  figure: { fontFamily: fonts.display, fontSize: 56, lineHeight: 68, letterSpacing: -0.56 },
  logo: { fontFamily: fonts.display, fontSize: 48, lineHeight: 58, letterSpacing: -0.48 },
  logoSmall: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
} as const;

export type TextVariant = keyof typeof typography;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;

/**
 * Shapes. Photos, wells and thumbnails are barely rounded (6); buttons are capsules; sheets are round at the top.
 * `card` is kept for the few quiet panels that remain and shares the radius of a well; `tag` is the care label.
 */
export const radius = { control: 28, card: 6, well: 6, thumb: 6, sheet: 28, pill: 28, segment: 6, tag: 2 } as const;

export const size = {
  /** Height of capsule buttons. */
  control: 54,
  controlCompact: 44,
  option: 56,
  /** Smallest touch target, and the round icon button. */
  touch: 44,
  gutter: 20,
  /** Thickness of progress bars and step bars, and of the line under the active text tab. */
  bar: 2,
  /** The grabber at the top of a sheet: 36 by 5. */
  grabber: 5,
} as const;

/** The one shadow of the app, under what floats: the tab capsule, the add button, a hanging tag. Colour comes from `theme.shadow`. */
export const shadow = { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 } as const;

/**
 * `reveal` is the one exception to the short durations: a curtain draws aside across the whole width of a picture, and
 * a move that long needs more time than `sheet` to stay readable. It is used for that move and nothing else.
 */
/** `sweep` is the one long, steady move: the light crossing a loading placeholder, a functional loop that says "still coming". */
export const motion = { press: 100, exit: 150, enter: 200, sheet: 300, reveal: 450, sweep: 1200 } as const;

/** Control points of the two cubic-bezier curves: enter decelerates, exit accelerates. No springs, no overshoot. */
export const easing = { enter: [0.16, 1, 0.3, 1], exit: [0.7, 0, 0.84, 0] } as const;

/** How far content travels while it appears: 4 to 8 points, never more. */
export const travel = { rise: 6 } as const;

/** What a pressed surface looks like, how small a confirming check starts, and how small a peek starts before it settles at full size, and how far a card that is not the chosen one steps back. `liftScale` is how much larger a piece held in a finger is, `leaveScale` how small a tile is when it has gone. `breathOpacity` is how far a curtain dims while it breathes, `unveilOpacity` where a picture starts as its curtain opens. */
export const feel = { pressScale: 0.97, pressOpacity: 0.85, popScale: 0.9, pulseOpacity: 0.5, peekScale: 0.94, liftScale: 1.03, leaveScale: 0.97, restOpacity: 0.72, flashOpacity: 0.7, breathOpacity: 0.9, unveilOpacity: 0.85 } as const;
