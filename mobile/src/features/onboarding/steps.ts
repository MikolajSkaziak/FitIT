import type { User } from '@/api/account';

/**
 * The steps after the account is created, in order: steps 7 to 9 of the one journey (see `flow`). The colors and the basics are
 * skippable; the recap is not. The server keeps the index of the first one left to do.
 */
export const onboardingRoutes = ['/onboarding/colors', '/onboarding/basics', '/onboarding/done'] as const;

export type OnboardingRoute = (typeof onboardingRoutes)[number];

/**
 * Where the flow resumes: the first step that is not finished, as the server remembers it. Colors that were analyzed
 * before the app was closed count as that step done, so the person is not asked twice.
 */
export function resumeRoute(user: Pick<User, 'onboardingStep' | 'colorAnalysis'>): OnboardingRoute {
  const step = user.onboardingStep === 0 && user.colorAnalysis ? 1 : user.onboardingStep;
  return onboardingRoutes[Math.min(Math.max(step, 0), onboardingRoutes.length - 1)] as OnboardingRoute;
}

/** Where Back goes from a step: the one before it, or the result of the colors when there is one. */
export function previousRoute(route: OnboardingRoute, hasColors: boolean): OnboardingRoute | '/onboarding/palette' | null {
  if (route === '/onboarding/done') {
    return '/onboarding/basics';
  }

  return route === '/onboarding/basics' ? (hasColors ? '/onboarding/palette' : '/onboarding/colors') : null;
}

/** The flow is shown while the account has not been marked done. The mark lives on the server, so a new phone does not replay it. */
export const needsOnboarding = (user: Pick<User, 'onboardingDoneAt'> | null): boolean => user !== null && user.onboardingDoneAt === null;

/** The recap offers the first outfit from this many pieces. */
export const piecesForFirstOutfit = 5;
