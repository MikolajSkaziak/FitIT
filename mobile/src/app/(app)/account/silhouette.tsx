import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/auth/session';
import { SilhouettePicker } from '@/components/SilhouettePicker';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { messages } from '@/features/registration/validation';
import { parseGender } from '@/lib/gender';

export default function EditSilhouette() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  // Opened from the gender screen, this carries the gender being changed to.
  const params = useLocalSearchParams<{ gender?: string }>();
  const newGender = parseGender(params.gender);
  const gender = newGender ?? user?.gender ?? null;
  const genderChanges = newGender !== null && newGender !== user?.gender;
  const [avatarId, setAvatarId] = useState<string | null>(genderChanges ? null : (user?.avatar.id ?? null));
  const [missing, setMissing] = useState(false);
  const save = useSaveProfile(() => router.dismissTo('/profile'));

  if (!user || !gender) {
    return null;
  }

  return (
    <EditScreen
      title="Body shape"
      accent={{ word: 'shape', act: 'stretch' }}
      lead="It’s only used for the try-on picture. Choose the closest match."
      busy={save.isPending}
      error={save.error}
      notice={missing && !avatarId ? messages.avatarMissing : null}
      onAction={() => {
        if (!avatarId) {
          setMissing(true);
          return;
        }

        if (!genderChanges && avatarId === user.avatar.id) {
          router.dismissTo('/profile');
        } else {
          save.mutate(genderChanges ? { gender, avatarId } : { avatarId });
        }
      }}
      testID="edit-silhouette">
      <SilhouettePicker gender={gender} value={avatarId} onChange={(avatar) => setAvatarId(avatar.id)} />
    </EditScreen>
  );
}
