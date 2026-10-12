import { useRouter } from 'expo-router';

import { useSession } from '@/auth/session';

import type { ConsentKind } from './copy';

/** Whoever opened the consent sheet is waiting here for the answer. One sheet is open at a time. */
let waiting: ((allowed: boolean) => void) | null = null;

/** The sheet reports what the person chose; `false` also when it is swiped away. */
export function finishConsent(allowed: boolean): void {
  waiting?.(allowed);
  waiting = null;
}

/**
 * Asks, in context, for the consent to send photos to AI services: `const allowed = await askConsent('clothes')` answers
 * at once when it stands, and otherwise opens the consent sheet and answers with the person's choice. The action that
 * would send a photo goes on only when this says true. Saying yes saves the one consent that covers both kinds.
 */
export function useAiConsent(): (kind: ConsentKind, options?: { force?: boolean }) => Promise<boolean> {
  const router = useRouter();
  // `force` opens the sheet although this phone believes the consent stands: the server just said it does not (withdrawn elsewhere).
  return (kind, { force = false } = {}) => {
    if (!force && useSession.getState().user?.aiConsentAt) {
      return Promise.resolve(true);
    }

    finishConsent(false);
    router.push({ pathname: '/consent', params: { kind } });
    return new Promise((resolve) => {
      waiting = resolve;
    });
  };
}
