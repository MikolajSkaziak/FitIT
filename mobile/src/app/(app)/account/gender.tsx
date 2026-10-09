import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { Gender } from '@/api/account';
import { useSession } from '@/auth/session';
import { GenderChoice } from '@/components/choices';
import { Labeled } from '@/components/forms';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { shapeFits } from '@/lib/gender';

export default function EditGender() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const current = user?.gender ?? null;
  const [gender, setGender] = useState<Gender | null>(current);
  const save = useSaveProfile(() => router.back(), { weather: false });
  const changed = gender !== null && gender !== current;
  // The body shape stays whenever the new gender is still offered it; otherwise a new one is picked next.
  const keepsShape = changed && shapeFits(gender, user?.avatar.gender ?? null);
  const picksShape = changed && !keepsShape;

  return (
    <EditScreen
      title="Gender"
      actionLabel={picksShape ? 'Next' : changed ? 'Save' : 'Done'}
      busy={save.isPending}
      error={save.error}
      onAction={() => {
        if (picksShape) {
          // Silhouettes belong to a gender, so the change is saved together with a new silhouette on the next screen.
          router.push({ pathname: '/account/silhouette', params: { gender } });
        } else if (keepsShape) {
          save.mutate({ gender });
        } else {
          router.back();
        }
      }}
      testID="edit-gender">
      <Labeled label="Gender" helper="This decides which body shapes we show. If your current shape isn’t offered for a new choice, you’ll pick another.">
        <GenderChoice value={gender} onChange={setGender} />
      </Labeled>
    </EditScreen>
  );
}
