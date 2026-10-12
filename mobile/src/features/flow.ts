/**
 * One journey in two halves. Before an account exists the person says who is being dressed, picks styles, pieces and a
 * place, and gets a first look for it; creating the account keeps it. After that come the body shape, the fit, the colors and the recap.
 *
 * No step says how many there are in all. Each carries a promise that counts down to the next thing the person gets,
 * and how full the line above it is: it starts part filled and is full when the promise is kept.
 */
export const flow = {
  gender: { progress: 0.2, label: 'Four steps to your first look' },
  styles: { progress: 0.4, label: 'Three more steps to your first look' },
  basics: { progress: 0.6, label: 'Two more steps to your first look' },
  place: { progress: 0.8, label: 'One more step to your first look' },
  look: { progress: 1, label: 'Your wardrobe so far' },
  account: { progress: 0.5, label: 'One step to save your picks' },
  shape: { progress: 0.25, label: 'Almost done — 3 left' },
  fit: { progress: 0.5, label: 'Almost done — 2 left' },
  colors: { progress: 0.75, label: 'Almost done — 1 left' },
  done: { progress: 1, label: 'All done' },
} as const;

export type FlowStep = keyof typeof flow;

/** The steps whose lines belong together: the line carries over from one to the next. The account is a line of its own, and the part after it starts afresh. */
const lines: readonly (readonly FlowStep[])[] = [['gender', 'styles', 'basics', 'place', 'look'], ['account'], ['shape', 'fit', 'colors', 'done']];

/**
 * Where the line of `step` starts when its screen comes into view, given the step that was in view before it: from that
 * step's fill, so the line grows when going on and shrinks when going back. With nothing before it, or a step of another
 * line, it starts at half of its own, so a line is never seen empty.
 */
export function fillStart(step: FlowStep, shown: FlowStep | null): number {
  const carried = shown !== null && shown !== step && lines.some((line) => line.includes(step) && line.includes(shown));
  return carried ? flow[shown].progress : flow[step].progress / 2;
}

/** The screens before the account, in order: nothing on them is sent anywhere until the account is created. */
export const registrationRoutes = ['/register', '/register/style', '/register/basics', '/register/place', '/register/look', '/register/account'] as const;
