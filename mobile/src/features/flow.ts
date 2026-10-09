/**
 * One journey from the first sign-up screen to the last onboarding screen, counted once. The account is created by the
 * button of the weather step; the steps after it carry on in the same frame, so the person never sees a second start.
 */
export const flow = { account: 1, about: 2, silhouette: 3, fit: 4, styles: 5, weather: 6, colors: 7, basics: 8, done: 9, total: 9 } as const;
