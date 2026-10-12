import type { User } from '@/api/account';

/**
 * The steps after the account is created, in order: the body shape, the fit, the colors and the recap. The body shape
 * is required, the fit and the colors can be skipped. The server keeps the index of the first one left to do.
 */
export const onboardingRoutes = ['/onboarding/shape', '/onboarding/fit', '/onboarding/colors', '/onboarding/done'] as const;

export type OnboardingRoute = (typeof onboardingRoutes)[number];

/** A step by its place in `onboardingRoutes`, as the server counts them. */
export type OnboardingIndex = 1 | 2 | 3;

const colorsStep = onboardingRoutes.indexOf('/onboarding/colors');

/**
 * Where the flow resumes: the first step that is not finished, as the server remembers it. Colors that were analyzed
 * before the app was closed count as that step done, so the person is not asked twice.
 */
export function resumeRoute(user: Pick<User, 'onboardingStep' | 'colorAnalysis'>): OnboardingRoute {
  const step = user.onboardingStep === colorsStep && user.colorAnalysis ? colorsStep + 1 : user.onboardingStep;
  return onboardingRoutes[Math.min(Math.max(step, 0), onboardingRoutes.length - 1)] as OnboardingRoute;
}

/** Where Back goes from a step: the one before it, or the result of the colors when there is one. The first step has none. */
export function previousRoute(route: OnboardingRoute, hasColors: boolean): OnboardingRoute | '/onboarding/palette' | null {
  if (route === '/onboarding/done') {
    return hasColors ? '/onboarding/palette' : '/onboarding/colors';
  }

  const index = onboardingRoutes.indexOf(route);
  return index > 0 ? (onboardingRoutes[index - 1] as OnboardingRoute) : null;
}

/** The flow is shown while the account has not been marked done. The mark lives on the server, so a new phone does not replay it. */
export const needsOnboarding = (user: Pick<User, 'onboardingDoneAt'> | null): boolean => user !== null && user.onboardingDoneAt === null;
