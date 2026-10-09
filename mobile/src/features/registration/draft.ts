import { create } from 'zustand';

import type { ClothingSize, Gender, LegLength, StyleTag, ThermalPreference } from '@/api/account';
import { emptyDateParts, type DateParts } from '@/lib/dates';
import { shapeFits } from '@/lib/gender';

/**
 * What the person has entered so far in the registration steps.
 * It lives in memory only (it holds a password) and is sent to the server once, at the last step.
 */
export interface RegistrationDraft {
  email: string;
  password: string;
  displayName: string;
  /** As entered: a month chosen by name, a typed day and a typed year. */
  birthDate: DateParts;
  gender: Gender | null;
  avatarId: string | null;
  /** The set the chosen body shape was made for, so a change of gender can tell whether the shape still applies. */
  avatarGender: Gender | null;
  styles: StyleTag[];
  thermalPreference: ThermalPreference;
  /** Optional, asked on the fit step. */
  clothingSize: ClothingSize | null;
  legLength: LegLength | null;
}

const empty: RegistrationDraft = {
  email: '',
  password: '',
  displayName: '',
  birthDate: emptyDateParts,
  gender: null,
  avatarId: null,
  avatarGender: null,
  styles: [],
  thermalPreference: 'normal',
  clothingSize: null,
  legLength: null,
};

interface DraftStore extends RegistrationDraft {
  set: (change: Partial<RegistrationDraft>) => void;
  reset: () => void;
}

export const useRegistrationDraft = create<DraftStore>((set) => ({
  ...empty,
  set: (change) =>
    set((draft) => {
      const genderChanged = change.gender !== undefined && change.gender !== draft.gender;
      // Women and men are offered their own five shapes, so a choice made for the other set no longer applies.
      // Non-binary and "prefer not to say" are offered all ten, so a shape stays whenever it is still on offer.
      const stillOffered = genderChanged && change.avatarId === undefined && shapeFits(change.gender ?? null, draft.avatarGender);
      return genderChanged && !stillOffered ? { avatarId: null, avatarGender: null, ...change } : change;
    }),
  reset: () => set(empty),
}));
