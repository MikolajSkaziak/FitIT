import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { updateProfile } from '@/api/account';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { setUser, signOut, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { Group, Row } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { genderLabel, legsLabel, sizeLabel, styleLabel, thermalLabel } from '@/copy/labels';
import { consentLine, consentSwitch } from '@/features/consent/copy';
import { initialOf } from '@/features/profile/avatar';
import { openDocument, privacyPolicyUrl, termsUrl } from '@/features/profile/legal';
import { weatherCredit } from '@/features/weather/credit';
import { formatLongDate, fromIso } from '@/lib/dates';
import { space, useTheme } from '@/theme';

export default function Profile() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSession((session) => session.user);
  const leave = useMutation({ mutationFn: () => signOut() });
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });
  // Switching takes effect at once, like every switch of a settings list: the row shows the answer straight away, and goes back
  // to what it was if the server says no. Nothing is deleted either way.
  const consent = useMutation({
    mutationFn: (agreed: boolean) => updateProfile({ aiConsent: agreed }),
    onMutate: (agreed) => {
      const before = useSession.getState().user;
      if (before) {
        setUser({ ...before, aiConsentAt: agreed ? (before.aiConsentAt ?? new Date().toISOString()) : null });
      }

      return { before };
    },
    onError: (_error, _agreed, context) => {
      if (context?.before) {
        setUser(context.before);
      }
    },
    onSuccess: (updated) => setUser(updated),
  });

  // This tab only exists while somebody is signed in; the check keeps the types honest during sign out.
  if (!user) {
    return null;
  }

  const birthDate = fromIso(user.birthDate);
  const policyUrl = privacyPolicyUrl();
  const terms = termsUrl();
  const initial = initialOf(user.displayName);

  return (
    <Screen aboveTabBar testID="profile-screen">
      <View style={styles.content}>
        <View style={styles.me}>
          <View accessible={false} style={[styles.avatar, { backgroundColor: theme.sage }]} testID="profile-avatar">
            {initial ? (
              <AppText variant="heading" color="action" testID="profile-avatar-initial">
                {initial}
              </AppText>
            ) : (
              <Icon name="user" size={24} color="textSecondary" />
            )}
          </View>
          <View style={styles.meText}>
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} testID="profile-name">
              {user.displayName}
            </AppText>
            <AppText variant="secondary" color="textSecondary" numberOfLines={1} testID="profile-email">
              {user.email}
            </AppText>
          </View>
        </View>
        <Group title="About you">
          <Row label="Name" icon="user" iconColor="textSecondary" value={user.displayName} onPress={() => router.push('/account/name')} testID="profile-row-name" />
          <Row
            label="Birth date"
            icon="calendar"
            iconColor="textSecondary"
            value={birthDate ? formatLongDate(birthDate) : undefined}
            onPress={() => router.push('/account/birth-date')}
            testID="profile-row-birth-date"
          />
          <Row label="Gender" icon="gender" iconColor="textSecondary" value={genderLabel(user.gender)} onPress={() => router.push('/account/gender')} testID="profile-row-gender" />
          <Row label="Body shape" icon="person" iconColor="textSecondary" value={user.avatar.label} onPress={() => router.push('/account/silhouette')} testID="profile-row-silhouette" />
          <Row label="Usual size" icon="ruler" iconColor="textSecondary" value={sizeLabel(user.clothingSize)} onPress={() => router.push('/account/size')} testID="profile-row-size" />
          <Row label="Leg length" icon="height" iconColor="textSecondary" value={legsLabel(user.legLength)} onPress={() => router.push('/account/legs')} testID="profile-row-legs" />
        </Group>
        <Group title="Weather and style">
          <Row
            label="Weather for"
            icon="pin"
            iconColor="textSecondary"
            value={user.location?.name ?? 'Not set'}
            meta={user.location ? (user.location.source === 'device' ? 'Phone location' : 'City you chose') : undefined}
            onPress={() => router.push('/account/place')}
            testID="profile-row-place"
          />
          <Row
            label="Thermal comfort"
            icon="thermometer"
            iconColor="textSecondary"
            value={thermalLabel(user.thermalPreference)}
            onPress={() => router.push('/account/thermal')}
            testID="profile-row-thermal"
          />
          <Row
            label="Styles"
            icon="style"
            iconColor="textSecondary"
            value={stylesValue(user.styles.map((tag) => styleLabel(tag).toLowerCase()))}
            onPress={() => router.push('/account/styles')}
            testID="profile-row-styles"
          />
          <Row
            label="Colors"
            icon="palette"
            iconColor="textSecondary"
            value={user.colorAnalysis?.name ?? 'Not set'}
            onPress={() => router.push('/account/colors')}
            testID="profile-row-colors"
          />
        </Group>
        {usage.data ? (
          <Group title="Today’s limits">
            <Row label="Outfit suggestions" icon="sparkle" iconColor="textSecondary" value={`${usage.data.suggestions.used} of ${usage.data.suggestions.limit}`} testID="profile-limit-suggestions" />
            <Row label="Try-on pictures" icon="image" iconColor="textSecondary" value={`${usage.data.visualizations.used} of ${usage.data.visualizations.limit}`} testID="profile-limit-visualizations" />
            <Row label="New clothes" icon="hanger" iconColor="textSecondary" value={`${usage.data.items.used} of ${usage.data.items.limit}`} testID="profile-limit-items" />
          </Group>
        ) : null}
        <Group title="About">
          <ToggleRow
            label={consentSwitch.label}
            icon="sparkle"
            meta={consentLine(user.aiConsentAt)}
            value={Boolean(user.aiConsentAt)}
            onChange={(agreed) => consent.mutate(agreed)}
            disabled={consent.isPending}
            testID="profile-consent"
          />
          <FormError message={consent.isError ? messageFor(consent.error) : null} />
          {policyUrl ? <Row label="Privacy Policy" icon="shield" iconColor="textSecondary" onPress={() => void openDocument(policyUrl)} testID="profile-row-privacy" /> : null}
          {terms ? <Row label="Terms of Service" icon="document" iconColor="textSecondary" onPress={() => void openDocument(terms)} testID="profile-row-terms" /> : null}
          <Row label={weatherCredit.label} icon="sun" iconColor="textSecondary" onPress={() => void openDocument(weatherCredit.url)} testID="profile-row-weather-credit" />
        </Group>
        <Group title="Account">
          <Row label="Log out" icon="logout" iconColor="textSecondary" onPress={() => !leave.isPending && leave.mutate()} testID="profile-sign-out" />
          <Row label="Delete account" icon="trash" danger onPress={() => router.push('/account/delete')} testID="profile-delete-account" />
        </Group>
      </View>
    </Screen>
  );
}

/** The first two styles by name and how many more there are, so the row stays on one line. */
function stylesValue(names: string[]): string {
  if (names.length === 0) {
    return 'None chosen';
  }

  const more = names.length - 2;
  return more > 0 ? `${names.slice(0, 2).join(', ')} +${more}` : names.join(', ');
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  meText: { flex: 1, gap: 2 },
});
