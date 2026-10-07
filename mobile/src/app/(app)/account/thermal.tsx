import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { ThermalPreference } from '@/api/account';
import { useSession } from '@/auth/session';
import { ThermalChoice } from '@/components/choices';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';

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
      title="Odczuwanie temperatury"
      busy={save.isPending}
      error={save.error}
      onAction={() => (value === user.thermalPreference ? router.back() : save.mutate({ thermalPreference: value }))}
      testID="edit-thermal">
      <ThermalChoice value={value} onChange={setValue} />
    </EditScreen>
  );
}
