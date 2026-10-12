import { create } from 'zustand';

import type { Gender, StyleTag, ThermalPreference } from '@/api/account';
import { emptyDateParts, type DateParts } from '@/lib/dates';
import type { Place } from '@/lib/location';

/** Where the weather will be checked: the phone's (rounded) location, a city picked by hand, or nothing yet. */
export type WeatherPlace = (Place & { source: 'device' | 'manual' }) | null;

/**
 * What the person has picked and entered before the account exists: who is being dressed, styles, the pieces they own,
 * a place, then the account itself. It lives in memory only (it holds a password) and nothing in it is sent until the account is created.
 */
export interface RegistrationDraft {
  /** Asked first and never preselected; null until the person answers. "Prefer not to say" is an answer. */
  gender: Gender | null;
  styles: StyleTag[];
  /** Codes of the common pieces ticked as owned. They join the wardrobe once there is an account to hold them. */
  starters: string[];
  place: WeatherPlace;
  /** How the person feels the temperature. "Average" until they say otherwise: a suggestion, not a question that must be answered. */
  thermalPreference: ThermalPreference;
  displayName: string;
  /** As entered: a month chosen by name, a typed day and a typed year. */
  birthDate: DateParts;
  email: string;
  password: string;
}

const empty: RegistrationDraft = {
  gender: null,
  styles: [],
  starters: [],
  place: null,
  thermalPreference: 'normal',
  displayName: '',
  birthDate: emptyDateParts,
  email: '',
  password: '',
};

interface DraftStore extends RegistrationDraft {
  set: (change: Partial<RegistrationDraft>) => void;
  reset: () => void;
}

export const useRegistrationDraft = create<DraftStore>((set) => ({
  ...empty,
  set: (change) => set(change),
  reset: () => set(empty),
}));
