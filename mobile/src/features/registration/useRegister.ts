import { useMutation, useQueryClient } from '@tanstack/react-query';

import { register } from '@/api/account';
import { addStarterPieces, wardrobeKeys } from '@/api/wardrobe';
import { startSession } from '@/auth/session';
import { usePendingPieces } from '@/features/onboarding/pendingPieces';
import { toIso } from '@/lib/dates';
import * as haptics from '@/lib/haptics';

import { useRegistrationDraft } from './draft';
import { checkBirthDate } from './validation';

/**
 * Creates the account from the draft and hands over what was picked before it: the gender, the styles and the place go with the
 * request (how the person feels the cold starts at "normal" and is changed in Profile), and the pieces join the new
 * wardrobe right after. On success the session starts and the app moves on by itself.
 *
 * The pieces are a second request, so they can fail on their own. The account stays created: what was not added is
 * kept for the next screens to say so and try again.
 */
export function useRegister() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const draft = useRegistrationDraft.getState();
      const birth = checkBirthDate(draft.birthDate);
      if (!birth.date) {
        throw new Error('The registration draft is incomplete.');
      }

      const auth = await register({
        email: draft.email.trim(),
        password: draft.password,
        displayName: draft.displayName.trim(),
        birthDate: toIso(birth.date),
        gender: draft.gender,
        styles: draft.styles,
        thermalPreference: draft.thermalPreference,
        location: draft.place,
      });
      const pieces = draft.starters;
      await startSession(auth);
      haptics.success();
      // Nothing typed during registration (a password among it) outlives the registration.
      useRegistrationDraft.getState().reset();
      if (pieces.length > 0) {
        try {
          await addStarterPieces(pieces);
          await client.invalidateQueries({ queryKey: wardrobeKeys.all });
        } catch {
          usePendingPieces.getState().set(pieces);
        }
      }
    },
  });

  return { submit: () => mutation.mutate(), pending: mutation.isPending, error: mutation.error, clearError: mutation.reset };
}
