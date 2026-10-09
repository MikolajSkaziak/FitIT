import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { StyleTag } from '@/api/account';
import { useSession } from '@/auth/session';
import { StyleChoice } from '@/components/choices';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';

/** The same style tiles as in registration; none chosen is allowed there too, and then the stylist has no leaning. */
export default function EditStyles() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const [value, setValue] = useState<StyleTag[]>(user?.styles ?? []);
  // Only the stylist on the server reads styles, so the forecast does not need to be asked for again.
  const save = useSaveProfile(() => router.back(), { weather: false });

  if (!user) {
    return null;
  }

  const unchanged = value.length === user.styles.length && value.every((style) => user.styles.includes(style));
  return (
    <EditScreen
      title="Favorite styles"
      lead="Pick as many as you like, or none. We’ll lean toward them when we put outfits together."
      busy={save.isPending}
      error={save.error}
      onAction={() => (unchanged ? router.back() : save.mutate({ styles: value }))}
      testID="edit-styles">
      <StyleChoice value={value} gender={user.gender} onChange={setValue} />
    </EditScreen>
  );
}
