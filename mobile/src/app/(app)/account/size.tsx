import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ClothingSize } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SizeButtons } from '@/components/SizeButtons';
import { SizeLabel } from '@/components/SizeLabel';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { space } from '@/theme';

export default function EditSize() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const [value, setValue] = useState<ClothingSize | null>(user?.clothingSize ?? null);
  const save = useSaveProfile(() => router.back(), { weather: false });

  if (!user) {
    return null;
  }

  const unchanged = value === (user.clothingSize ?? null);
  return (
    <EditScreen
      title="Usual size"
      busy={save.isPending}
      error={save.error}
      onAction={() => (unchanged ? router.back() : save.mutate(value ? { clothingSize: value } : { clearClothingSize: true }))}
      secondary={<Button kind="text" compact label={value ? 'I’d rather not say' : 'Not set for now'} onPress={() => setValue(null)} style={styles.clear} testID="size-none" />}
      testID="edit-size">
      <SizeLabel value={value} />
      <View style={styles.choice}>
        <AppText variant="label">The size you reach for most</AppText>
        <SizeButtons value={value} onChange={setValue} />
      </View>
      <View style={styles.note}>
        <View style={styles.noteIcon}>
          <Icon name="sparkle" size={20} color="textSecondary" />
        </View>
        <AppText variant="secondary" color="textSecondary" style={styles.noteText} testID="size-note">
          Only used so try-on pictures fit the way your clothes do. Change it any time in Profile.
        </AppText>
      </View>
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  choice: { gap: space[3] },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1 },
  clear: { alignSelf: 'center' },
});
