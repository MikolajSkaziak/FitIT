import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { ThermalPreference } from '@/api/account';
import { useSession } from '@/auth/session';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { ThermalPicker } from '@/features/profile/ThermalPicker';

export default function EditThermalPreference() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const [value, setValue] = useState<ThermalPreference>(user?.thermalPreference ?? 'normal');
  const save = useSaveProfile(() => router.back());

  if (!user) {
    return null;
  }

  return (
    <EditScreen
      title="How you feel the cold"
      accent={{ word: 'cold', act: 'shiver', replay: { shiver: value === 'runs_cold', rise: value === 'runs_warm' } }}
      busy={save.isPending}
      disabled={value === user.thermalPreference}
      error={save.error}
      onAction={() => save.mutate({ thermalPreference: value })}
      testID="edit-thermal">
      <ThermalPicker value={value} onChange={setValue} gender={user.gender} shapeGender={user.avatar?.gender} />
    </EditScreen>
  );
}
