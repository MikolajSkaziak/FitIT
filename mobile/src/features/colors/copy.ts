/** The words of the color analysis, in one place. */
export const intro = {
  title: 'Find your colors',
  lead: 'A quick color analysis gives you a personal palette. The stylist favors those colors when it builds your outfits.',
  points: [
    { label: 'A palette made for you', meta: 'The colors that suit your coloring best.' },
    { label: 'A few to go easy on', meta: 'So you know what to skip.' },
    { label: 'Outfits that use it', meta: 'Your stylist leans toward your colors.' },
  ],
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
  /** Always visible, right under the buttons. No checkbox and no extra step: creating the account covered the consent. */
  notice: 'Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.',
  quiz: 'Answer a few questions instead',
  working: 'Reading your colors…',
  cameraDenied: 'fitit. can’t use your camera. Turn it on in Settings, or choose a photo from your library.',
  openSettings: 'Open settings',
};

export const quiz = {
  title: 'A few quick questions',
  lead: 'Look in a mirror in daylight and pick the closest match for each. Tap a color to choose it.',
  skinTone: { label: 'Skin tone' },
  undertone: { label: 'Skin undertone', helper: 'Gold jewelry looks better on warm, silver on cool. Not sure? Pick neutral.' },
  hair: { label: 'Hair color', helper: 'Your natural color. If you color it, pick the closest, or dyed.' },
  eyes: { label: 'Eye color' },
  action: 'Show my colors',
  missing: 'Answer all four to see your colors.',
};

export const resultCopy = {
  best: 'Wear more of',
  soften: 'Go easy on',
  redo: 'Redo',
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
