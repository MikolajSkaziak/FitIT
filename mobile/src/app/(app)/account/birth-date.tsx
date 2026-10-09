import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/auth/session';
import { BirthDateField } from '@/components/forms';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { checkBirthDate } from '@/features/registration/validation';
import { emptyDateParts, fromIso, toDateParts, toIso, type DateParts } from '@/lib/dates';

export default function EditBirthDate() {
  const router = useRouter();
  const current = useSession((session) => session.user?.birthDate ?? '');
  const [parts, setParts] = useState<DateParts>(() => {
    const date = fromIso(current);
    return date ? toDateParts(date) : emptyDateParts;
  });
  const [error, setError] = useState<string | null>(null);
  const save = useSaveProfile(() => router.back());

  const submit = () => {
    const checked = checkBirthDate(parts);
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
    <EditScreen title="Birth date" onAction={submit} busy={save.isPending} error={save.error} testID="edit-birth-date">
      <BirthDateField
        value={parts}
        onChange={(next) => {
          setParts(next);
          setError(null);
        }}
        error={error}
        helper="We only use it to check your age. No one else sees it."
        testID="edit-birth-date-field"
      />
    </EditScreen>
  );
}
