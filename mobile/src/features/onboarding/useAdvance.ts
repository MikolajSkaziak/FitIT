import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { updateProfile, type ProfileChange } from '@/api/account';
import { setUser } from '@/auth/session';

import { previousRoute, type OnboardingRoute } from './steps';

/**
 * Saves how far the person got on the account, then moves on. The server remembers the step (it only ever moves
 * forward) so closing the app, or signing in on another phone, resumes at the next unfinished one.
 */
export function useAdvance() {
  const router = useRouter();
  const mutation = useMutation({ mutationFn: (change: ProfileChange) => updateProfile(change), onSuccess: (user) => setUser(user) });
  return {
    pending: mutation.isPending,
    error: mutation.error,
    /** Marks `step` as the first one left to do, and goes to `route` like any step forward, so Back leads to where the person was. */
    to: (step: 1 | 2, route: OnboardingRoute) => mutation.mutate({ onboardingStep: step }, { onSuccess: () => router.push(route) }),
    /** One step back. Pops to the screen if it is still in the history, and opens it if the flow was resumed after a restart. */
    back: (from: OnboardingRoute, hasColors: boolean) => {
      const to = previousRoute(from, hasColors);
      if (to) {
        router.dismissTo(to);
      }
    },
    /** Marks the whole flow done and opens the app on its first tab. */
    finish: () => mutation.mutate({ onboardingDone: true }, { onSuccess: () => router.replace('/') }),
  };
}
