import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { Gender } from '@/api/account';
import { useSession } from '@/auth/session';
import { Segmented } from '@/components/controls';
import { Labeled } from '@/components/forms';
import { genderOptions } from '@/copy/labels';
import { EditScreen } from '@/features/profile/EditScreen';

export default function EditGender() {
  const router = useRouter();
  const current = useSession((session) => session.user?.gender ?? null);
  const [gender, setGender] = useState<Gender | null>(current);
  const changed = gender !== null && gender !== current;

  return (
    <EditScreen
      title="Płeć"
      actionLabel={changed ? 'Dalej' : 'Gotowe'}
      onAction={() => {
        // Silhouettes belong to a gender, so the change is saved together with a new silhouette on the next screen.
        if (changed) {
          router.push({ pathname: '/account/silhouette', params: { gender } });
        } else {
          router.back();
        }
      }}
      testID="edit-gender">
      <Labeled label="Płeć" helper="Od niej zależy, które typy sylwetek pokazujemy. Po zmianie wybierzesz nową sylwetkę.">
        <Segmented label="Płeć" options={genderOptions} value={gender} onChange={setGender} />
      </Labeled>
    </EditScreen>
  );
}
