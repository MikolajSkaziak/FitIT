import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { fetchStarterPieces, wardrobeKeys } from '@/api/wardrobe';
import { Button } from '@/components/Button';
import { piecesFor } from '@/features/onboarding/audience';
import { basics } from '@/features/onboarding/copy';
import { StarterPicker } from '@/features/onboarding/StarterPicker';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';

/**
 * The third step: tick the common pieces you own. The list is public, so it loads without an account; the ticks stay
 * in the draft and join the wardrobe when the account is created. Going on with none ticked is fine. The list is narrowed to
 * the gender chosen at step one, so a woman is not shown men's pieces and the other way round.
 */
export default function RegisterBasics() {
  const router = useRouter();
  const pieces = useQuery({ queryKey: wardrobeKeys.starter, queryFn: fetchStarterPieces, staleTime: Infinity });
  const starters = useRegistrationDraft((draft) => draft.starters);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const gender = useRegistrationDraft((draft) => draft.gender);
  const all = useMemo(() => piecesFor(pieces.data ?? [], gender), [pieces.data, gender]);
  // Ticks for pieces the gender no longer shows (the person went back and changed it) are not counted and not kept.
  const shown = useMemo(() => new Set(all.map((piece) => piece.code)), [all]);
  const owned = starters.filter((code) => shown.has(code));

  return (
    <WizardStep
      step="basics"
      visual
      title={basics.title}
      accent={{ word: 'Tap', act: 'tap' }}
      lead={basics.lead}
      testID="register-basics"
      footer={
        <Button
          label={owned.length > 0 ? basics.use(owned.length) : basics.useNone}
          onPress={() => {
            if (owned.length !== starters.length) {
              setDraft({ starters: owned });
            }

            router.push('/register/place');
          }}
          testID="register-next"
        />
      }>
      <StarterPicker
        pieces={all}
        pending={pieces.isPending}
        failed={pieces.isError}
        onRetry={() => void pieces.refetch()}
        chosen={new Set(owned)}
        // Kept in the order of the catalogue, so the same ticks always make the same first look.
        onChange={(chosen) => setDraft({ starters: all.filter((piece) => chosen.has(piece.code)).map((piece) => piece.code) })}
      />
    </WizardStep>
  );
}
