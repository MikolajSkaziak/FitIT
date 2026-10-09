import type { Occasion } from '@/api/outfits';
import { occasionOptions } from '@/copy/labels';

export interface ProposalsRequest {
  occasion: Occasion;
  note: string;
  baseItemId?: string;
}

/**
 * Where "Suggest outfits" leads. The request travels as route parameters; `request` is a fresh id, so the screen
 * asks the server once per press, and coming back to it does not ask again.
 */
export function proposalsRoute({ occasion, note, baseItemId }: ProposalsRequest) {
  const trimmed = note.trim();
  return {
    pathname: '/proposals',
    params: { request: Date.now().toString(36), occasion, ...(trimmed ? { note: trimmed } : null), ...(baseItemId ? { base: baseItemId } : null) },
  } as const;
}

export const isOccasion = (value: unknown): value is Occasion => occasionOptions.some((option) => option.value === value);
