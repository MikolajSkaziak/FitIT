import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/auth/session';
import { BirthDateField } from '@/components/forms';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { checkBirthDate } from '@/features/registration/validation';
import { formatDate, fromIso, toIso } from '@/lib/dates';

export default function EditBirthDate() {
  const router = useRouter();
  const current = useSession((session) => session.user?.birthDate ?? '');
  const [text, setText] = useState(() => {
    const date = fromIso(current);
    return date ? formatDate(date) : '';
  });
  const [error, setError] = useState<string | null>(null);
  const save = useSaveProfile(() => router.back());

  const submit = () => {
    const checked = checkBirthDate(text);
    setError(checked.error);
    if (!checked.date) {
      return;
    }

    const iso = toIso(checked.date);
    if (iso === current) {
      router.back();
    } else {
      save.mutate({ birthDate: iso });
    }
  };

  return (
    <EditScreen title="Data urodzenia" onAction={submit} busy={save.isPending} error={save.error} testID="edit-birth-date">
      <BirthDateField
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        error={error}
        helper="Potrzebna do potwierdzenia wieku. Nikomu jej nie pokazujemy."
        testID="edit-birth-date-field"
      />
    </EditScreen>
  );
}
