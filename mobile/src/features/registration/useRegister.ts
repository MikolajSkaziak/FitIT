import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { register } from '@/api/account';
import { startSession } from '@/auth/session';
import { toIso } from '@/lib/dates';
import type { Place } from '@/lib/location';

import { useRegistrationDraft } from './draft';
import { checkBirthDate, firstIncompleteStep } from './validation';

/** Where the weather will be checked: the phone's (rounded) location, a city picked by hand, or nothing yet. */
export type WeatherPlace = (Place & { source: 'device' | 'manual' }) | null;

/**
 * Sends the whole draft as one request. On success the session starts and the app moves to the tabs on its own.
 */
export function useRegister() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async (place: WeatherPlace) => {
      const draft = useRegistrationDraft.getState();
      const birth = checkBirthDate(draft.birthDate);
      if (!birth.date || !draft.gender || !draft.avatarId) {
        throw new Error('The registration draft is incomplete.');
      }

      return register({
        email: draft.email.trim(),
        password: draft.password,
        displayName: draft.displayName.trim(),
        birthDate: toIso(birth.date),
        gender: draft.gender,
        avatarId: draft.avatarId,
        styles: draft.styles,
        thermalPreference: draft.thermalPreference,
        clothingSize: draft.clothingSize ?? undefined,
        legLength: draft.legLength ?? undefined,
        location: place,
      });
    },
    onSuccess: async (auth) => {
      await startSession(auth);
      useRegistrationDraft.getState().reset();
    },
  });

  /**
   * True when every earlier step is filled in. Otherwise takes the person back to the first one that is not
   * (this happens when a step is opened out of order), so they see what is missing instead of a server error.
   */
  const ready = (): boolean => {
    const incomplete = firstIncompleteStep(useRegistrationDraft.getState());
    if (incomplete) {
      router.dismissTo(incomplete);
      return false;
    }

    return true;
  };

  return { ready, submit: mutation.mutate, pending: mutation.isPending, error: mutation.error, clearError: mutation.reset };
}
