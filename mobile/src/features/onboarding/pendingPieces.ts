import { create } from 'zustand';

import { onSessionEnd } from '@/auth/session';

interface PendingPieces {
  /** Codes of the common pieces picked before sign-up that could not be added to the new wardrobe. */
  codes: readonly string[];
  set: (codes: readonly string[]) => void;
  clear: () => void;
}

/**
 * The account is created even when adding the picked pieces fails right after it. What could not be added waits here,
 * in memory, so the next screens can say so and try again; closed and reopened, the wardrobe offers the pieces as usual.
 */
export const usePendingPieces = create<PendingPieces>((set) => ({
  codes: [],
  set: (codes) => set({ codes }),
  clear: () => set({ codes: [] }),
}));

onSessionEnd(() => usePendingPieces.getState().clear());
