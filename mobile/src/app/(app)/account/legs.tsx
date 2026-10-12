import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LegLength } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LegFigures } from '@/components/LegFigures';
import { legDetails, legsNotSet } from '@/copy/labels';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { space } from '@/theme';

export default function EditLegs() {
  const router = useRouter();
  const user = useSession((session) => session.user);
  const [value, setValue] = useState<LegLength | null>(user?.legLength ?? null);
  const save = useSaveProfile(() => router.back(), { weather: false });

  if (!user) {
    return null;
  }

  const unchanged = value === (user.legLength ?? null);
  const { title, hint } = value ? legDetails[value] : legsNotSet;
  return (
    <EditScreen
      title="Leg length"
      accent={{ word: 'length', act: 'rise' }}
      lead="Where does your waist sit?"
      leadIcon="height"
      busy={save.isPending}
      error={save.error}
      onAction={() => (unchanged ? router.back() : save.mutate(value ? { legLength: value } : { clearLegLength: true }))}
      secondary={<Button kind="text" compact label="I’d rather not say" onPress={() => setValue(null)} style={styles.clear} testID="legs-none" />}
      testID="edit-legs">
      <LegFigures value={value} onChange={setValue} />
      <View accessibilityLiveRegion="polite" style={styles.about} testID="legs-card">
        <AppText variant="heading">{title}</AppText>
        <AppText variant="secondary" color="textSecondary">
          {hint}
        </AppText>
      </View>
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  about: { gap: space[1] },
  clear: { alignSelf: 'center' },
});
