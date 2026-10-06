import { create } from 'zustand';

import type { Gender, StyleTag, ThermalPreference } from '@/api/account';

/**
 * What the person has entered so far in the five registration steps.
 * It lives in memory only (it holds a password) and is sent to the server once, at the last step.
 */
export interface RegistrationDraft {
  email: string;
  password: string;
  displayName: string;
  /** As typed: "DD.MM.RRRR". */
  birthDate: string;
  gender: Gender | null;
  avatarId: string | null;
  styles: StyleTag[];
  thermalPreference: ThermalPreference;
}

const empty: RegistrationDraft = {
  email: '',
  password: '',
  displayName: '',
  birthDate: '',
  gender: null,
  avatarId: null,
  styles: [],
  thermalPreference: 'normal',
};

interface DraftStore extends RegistrationDraft {
  set: (change: Partial<RegistrationDraft>) => void;
  reset: () => void;
}

export const useRegistrationDraft = create<DraftStore>((set) => ({
  ...empty,
  set: (change) =>
    set((draft) => ({
      ...change,
      // Silhouettes are offered per gender, so a choice made for the other one no longer applies.
      ...(change.gender !== undefined && change.gender !== draft.gender ? { avatarId: change.avatarId ?? null } : null),
    })),
  reset: () => set(empty),
}));
