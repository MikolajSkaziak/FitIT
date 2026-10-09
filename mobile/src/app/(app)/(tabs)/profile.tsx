import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { updateProfile } from '@/api/account';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { setUser, signOut, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/forms';
import { Group, Row } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { genderLabel, legsLabel, sizeLabel, styleLabel, thermalLabel } from '@/copy/labels';
import { initialOf } from '@/features/profile/avatar';
import { consentLine } from '@/features/profile/consent';
import { privacyPolicyUrl } from '@/features/profile/legal';
import { formatLongDate, fromIso } from '@/lib/dates';
import { space, useTheme } from '@/theme';

export default function Profile() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSession((session) => session.user);
  const leave = useMutation({ mutationFn: () => signOut() });
  // Switching it takes effect at once, like every switch of a settings list; the answer replaces the person kept in memory.
  const consent = useMutation({ mutationFn: (agreed: boolean) => updateProfile({ aiConsent: agreed }), onSuccess: (updated) => setUser(updated) });
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });

  // This tab only exists while somebody is signed in; the check keeps the types honest during sign out.
  if (!user) {
    return null;
  }

  const birthDate = fromIso(user.birthDate);
  const policyUrl = privacyPolicyUrl();
  const initial = initialOf(user.displayName);

  return (
    <Screen aboveTabBar testID="profile-screen">
      <View style={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Profile
        </AppText>
        <View style={styles.me}>
          <View accessible={false} style={[styles.avatar, { backgroundColor: theme.well, borderColor: theme.wellLine }]} testID="profile-avatar">
            {initial ? (
              <AppText variant="heading" testID="profile-avatar-initial">
                {initial}
              </AppText>
            ) : (
              <Icon name="user" size={24} color="textSecondary" />
            )}
          </View>
          <View style={styles.meText}>
            <AppText variant="heading" numberOfLines={1} testID="profile-name">
              {user.displayName}
            </AppText>
            <AppText variant="secondary" color="textSecondary" numberOfLines={1} testID="profile-email">
              {user.email}
            </AppText>
          </View>
        </View>
        <Group title="Account">
          <Row label="Name" icon="user" value={user.displayName} onPress={() => router.push('/account/name')} testID="profile-row-name" />
          <Row
            label="Birth date"
            icon="calendar"
            value={birthDate ? formatLongDate(birthDate) : undefined}
            onPress={() => router.push('/account/birth-date')}
            testID="profile-row-birth-date"
          />
          <Row label="Gender" icon="gender" value={genderLabel(user.gender)} onPress={() => router.push('/account/gender')} testID="profile-row-gender" />
          <Row label="Body shape" icon="person" value={user.avatar.label} onPress={() => router.push('/account/silhouette')} testID="profile-row-silhouette" />
          <Row label="Usual size" icon="ruler" value={sizeLabel(user.clothingSize)} onPress={() => router.push('/account/size')} testID="profile-row-size" />
          <Row label="Leg length" icon="height" value={legsLabel(user.legLength)} onPress={() => router.push('/account/legs')} testID="profile-row-legs" />
          <Row label="Email" icon="mail" value={user.email} last />
        </Group>
        <Group title="Weather and style">
          <Row
            label="Weather for"
            icon="pin"
            value={user.location ? (user.location.source === 'device' ? 'Phone location' : 'City you chose') : 'Not set'}
            meta={user.location?.name}
            onPress={() => router.push('/account/place')}
            testID="profile-row-place"
          />
          <Row
            label="Your colors"
            icon="flower"
            value={user.colorAnalysis?.name ?? 'Not set'}
            onPress={() => router.push('/account/colors')}
            testID="profile-row-colors"
          />
          <Row
            label="Feel the cold"
            icon="thermometer"
            value={thermalLabel(user.thermalPreference)}
            onPress={() => router.push('/account/thermal')}
            testID="profile-row-thermal"
          />
          <Row
            label="Favorite styles"
            icon="style"
            value={user.styles.length > 0 ? user.styles.map((tag) => styleLabel(tag).toLowerCase()).join(', ') : 'None chosen'}
            onPress={() => router.push('/account/styles')}
            last
            testID="profile-row-styles"
          />
        </Group>
        {usage.data ? (
          <Group title="Today’s limits">
            <Row label="Outfit suggestions" icon="sparkle" value={`${usage.data.suggestions.used} of ${usage.data.suggestions.limit}`} testID="profile-limit-suggestions" />
            <Row label="Try-on pictures" icon="image" value={`${usage.data.visualizations.used} of ${usage.data.visualizations.limit}`} testID="profile-limit-visualizations" />
            <Row label="New clothes" icon="hanger" value={`${usage.data.items.used} of ${usage.data.items.limit}`} last testID="profile-limit-items" />
          </Group>
        ) : null}
        <View style={styles.privacy}>
          <Group title="Privacy">
            <ToggleRow
              label="Send clothing photos to AI services"
              icon="shield"
              meta={consentLine(user.aiConsentAt)}
              value={Boolean(user.aiConsentAt)}
              onChange={(agreed) => consent.mutate(agreed)}
              disabled={consent.isPending}
              last={!policyUrl}
              testID="profile-consent"
            />
            {policyUrl ? <Row label="Privacy policy" icon="document" onPress={() => void Linking.openURL(policyUrl)} last testID="profile-row-privacy" /> : null}
          </Group>
          <FormError message={consent.isError ? messageFor(consent.error) : null} />
        </View>
        <Button label="Log out" kind="secondary" busy={leave.isPending} onPress={() => leave.mutate()} testID="profile-sign-out" />
        <View style={styles.danger}>
          <Group title="Delete account">
            <View style={styles.dangerBody}>
              <AppText variant="secondary" color="textSecondary">
                We’ll delete your account, clothes, outfits and images. This can’t be undone.
              </AppText>
              {/* A text button carries its own horizontal padding; here it has none, so its label starts at the text's left edge. */}
              <Button
                label="Delete account"
                kind="dangerText"
                inline
                style={styles.flush}
                onPress={() => router.push('/account/delete')}
                testID="profile-delete-account"
              />
            </View>
          </Group>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  meText: { flex: 1, gap: 2 },
  privacy: { gap: space[2] },
  // The mock-up sets the danger zone a little apart from the button above it.
  danger: { marginTop: space[2] },
  dangerBody: { padding: space[4], gap: space[1], alignItems: 'flex-start' },
  flush: { paddingHorizontal: 0 },
});
