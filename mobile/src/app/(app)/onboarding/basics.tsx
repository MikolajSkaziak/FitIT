import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { addStarterPieces, fetchStarterPieces, wardrobeKeys } from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { flow } from '@/features/flow';
import { Frame } from '@/features/onboarding/Frame';
import { basics } from '@/features/onboarding/copy';
import { StarterPicker } from '@/features/onboarding/StarterPicker';
import { useAdvance } from '@/features/onboarding/useAdvance';

/** Step 8 of 9: tick the common pieces you own and they join the wardrobe as ready garments. Skippable. */
export default function OnboardingBasics() {
  const advance = useAdvance();
  const client = useQueryClient();
  const hasColors = useSession((session) => Boolean(session.user?.colorAnalysis));
  const pieces = useQuery({ queryKey: wardrobeKeys.starter, queryFn: fetchStarterPieces, staleTime: Infinity });
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const add = useMutation({
    mutationFn: (codes: string[]) => addStarterPieces(codes),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: wardrobeKeys.all });
      advance.to(2, '/onboarding/done');
    },
  });

  const all = pieces.data ?? [];
  const count = chosen.size;
  const error = add.error ?? advance.error;

  return (
    <Frame
      step={flow.basics}
      onBack={() => advance.back('/onboarding/basics', hasColors)}
      title={basics.title}
      lead={basics.lead}
      testID="onboarding-basics"
      footer={
        <>
          <FormError message={error ? messageFor(error) : null} />
          {count > 0 ? null : (
            <AppText variant="meta" color="textSecondary" align="center">
              {basics.missing}
            </AppText>
          )}
          <Button
            label={count > 0 ? basics.add(count) : basics.addIdle}
            disabled={count === 0}
            busy={add.isPending || advance.pending}
            onPress={() => add.mutate([...chosen])}
            testID="basics-add"
          />
          <LinkText label={basics.skip} center onPress={() => advance.to(2, '/onboarding/done')} testID="basics-skip" />
        </>
      }>
      <StarterPicker
        pieces={all}
        pending={pieces.isPending}
        failed={pieces.isError}
        onRetry={() => void pieces.refetch()}
        chosen={chosen}
        onChange={setChosen}
      />
    </Frame>
  );
}
