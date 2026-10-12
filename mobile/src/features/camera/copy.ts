/** The words of the camera screen, in one place. */
export const camera = {
  close: 'Close',
  shutter: 'Take photo',
  done: 'Done',
  flash: { off: 'Flash off', on: 'Flash on', auto: 'Flash auto' },
  clothes: {
    guide: 'Lay the piece flat, fill the frame',
    dayLimit: 'That’s the limit for today',
    batchLimit: 'That’s the most in one go',
  },
  photo: {
    guide: 'The back, a detail, or how it fits you',
    limit: 'That’s all this piece can hold',
  },
  selfie: {
    guide: 'Face the window, no filter',
    still: 'Your selfie',
    use: 'Use this photo',
    retake: 'Retake',
  },
  failed: 'That photo didn’t save. Try again.',
  taken: (count: number) => `Photo ${count} taken`,
  count: (count: number) => (count === 1 ? '1 photo taken' : `${count} photos taken`),
  permission: {
    title: 'Let fitit. use your camera',
    clothes: 'fitit. uses the camera only while this screen is open, to photograph your clothes.',
    selfie: 'fitit. uses the camera only while this screen is open, to take your selfie for your color analysis.',
    photo: 'fitit. uses the camera only while this screen is open, to photograph your clothes.',
    continue: 'Continue',
    denied: 'Camera access is turned off for fitit. You can turn it on in Settings.',
    settings: 'Open Settings',
  },
  unavailable: 'The camera isn’t available on this device.',
  library: 'Choose from library instead',
};
