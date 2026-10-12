import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ClothingSize } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SizeButtons } from '@/components/SizeButtons';
import { SizeLabel } from '@/components/SizeLabel';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { space, useTheme } from '@/theme';

/** The label sits on the well colour, which also fills the strip under the status bar above it. */
function SizeHero({ value }: { value: ClothingSize | null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.well, paddingTop: insets.top }}>
      <SizeLabel value={value} />
    </View>
  );
}

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
      hero={<SizeHero value={value} />}
      busy={save.isPending}
      error={save.error}
      onAction={() => (unchanged ? router.back() : save.mutate(value ? { clothingSize: value } : { clearClothingSize: true }))}
      secondary={<Button kind="text" compact label={value ? 'I’d rather not say' : 'Not set for now'} onPress={() => setValue(null)} style={styles.clear} testID="size-none" />}
      testID="edit-size">
      <View style={styles.choice}>
        <View style={styles.ask}>
          <Icon name="ruler" size={20} color="textSecondary" />
          <AppText variant="title">The size you reach for most</AppText>
        </View>
        <SizeButtons value={value} onChange={setValue} />
      </View>
      <AppText variant="secondary" color="textSecondary" testID="size-note">
        Only used so try-on pictures fit the way your clothes do.
      </AppText>
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  choice: { gap: space[3] },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  clear: { alignSelf: 'center' },
});
