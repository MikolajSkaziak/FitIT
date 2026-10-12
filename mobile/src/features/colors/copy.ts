/** The words of the color analysis, in one place. */
export const intro = {
  title: 'Find your colors',
  /** The one sentence of the screen: what it takes, and what happens to the photo. */
  lead: 'A selfie in daylight is all it takes, and the photo is deleted right after.',
  selfie: 'Take a selfie',
  quiz: 'Answer a few questions instead',
  skip: 'Skip for now',
};

export const selfie = {
  title: 'Take a selfie',
  lead: 'We read your coloring from a photo of your face.',
  tip: 'Use daylight, no filter, and face the light.',
  camera: 'Take a selfie',
  library: 'Choose from library',
  /** Always visible, right under the buttons. The consent sheet comes up before the photo, the first time. */
  notice: 'Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.',
  quiz: 'Answer a few questions instead',
  working: 'Reading your colors…',
};

export const quiz = {
  title: 'A few quick questions',
  lead: 'Look in a mirror in daylight and pick the closest match for each.',
  skinTone: { label: 'Skin tone' },
  undertone: { label: 'Skin undertone', helper: 'Gold jewelry looks better on warm, silver on cool. Not sure? Pick neutral.' },
  hair: { label: 'Hair color', helper: 'Your natural color. If you color it, pick the closest, or dyed.' },
  eyes: { label: 'Eye color' },
  action: 'Show my colors',
  missing: 'Answer all four to see your colors.',
};

export const resultCopy = {
  eyebrow: 'Your colors',
  best: 'Wear more of',
  soften: 'Wear less of',
  redo: 'Redo',
  /** The link under Continue when the palette is first shown. */
  retake: 'Retake the selfie',
  continue: 'Continue',
  done: 'Done',
  remove: 'Remove my colors',
};

export const profile = {
  row: 'Your colors',
  none: 'Not set',
  empty: {
    title: 'No palette yet',
    text: 'Find your colors and the stylist will favor them in your outfits.',
    action: 'Find my colors',
  },
  removeNote: 'Removing your colors does not touch your clothes or outfits.',
};

/**
 * The picture that opens the colors step: what a result looks like, shown on somebody else's palette and said to be an
 * example. The swatches are content, like the colors of the quiz, and the sweater is the same one in two of them.
 */
export const example = {
  label: 'An example palette',
  swatches: [
    { name: 'Sage green', hex: '#A3B18A' },
    { name: 'Warm taupe', hex: '#A68F7D' },
    { name: 'Terracotta', hex: '#C4745A' },
    { name: 'Muted teal', hex: '#5E8C87' },
    { name: 'Soft olive', hex: '#8A8F5A' },
    { name: 'Cream', hex: '#F1E6D0' },
    { name: 'Dusty rose', hex: '#C99A8E' },
    { name: 'Chocolate brown', hex: '#6B4226' },
  ],
  /** Read out in place of the picture. */
  description: 'An example: a palette of eight colors, and the same sweater in terracotta to wear more of and in icy blue to wear less of.',
} as const;
