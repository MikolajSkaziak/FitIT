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
import { radius, space, useTheme } from '@/theme';

export default function EditLegs() {
  const router = useRouter();
  const theme = useTheme();
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
      busy={save.isPending}
      error={save.error}
      onAction={() => (unchanged ? router.back() : save.mutate(value ? { legLength: value } : { clearLegLength: true }))}
      secondary={<Button kind="text" compact label="I’d rather not say" onPress={() => setValue(null)} style={styles.clear} testID="legs-none" />}
      testID="edit-legs">
      <View style={styles.ask}>
        <AppText variant="label">Where does your waist sit?</AppText>
        <AppText variant="secondary" color="textSecondary">
          Only used so try-on pictures fit the way your clothes do.
        </AppText>
      </View>
      <LegFigures value={value} onChange={setValue} />
      <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} testID="legs-card">
        <AppText variant="subheading">{title}</AppText>
        <AppText color="textSecondary">{hint}</AppText>
      </View>
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  ask: { gap: 2 },
  card: { borderWidth: 1, borderRadius: radius.well, paddingVertical: 14, paddingHorizontal: space[4], gap: 2 },
  clear: { alignSelf: 'center' },
});
