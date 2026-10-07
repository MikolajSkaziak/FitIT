import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { updateProfile } from '@/api/account';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';
import { setUser, signOut, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Group, Row } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { genderLabel, styleLabel, thermalLabel } from '@/copy/labels';
import { consentLine } from '@/features/profile/consent';
import { privacyPolicyUrl } from '@/features/profile/legal';
import { formatDate, fromIso } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';

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

  return (
    <Screen aboveTabBar testID="profile-screen">
      <View style={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Profil
        </AppText>
        <View style={styles.me}>
          <Image
            source={{ uri: user.avatar.thumbUrl }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Sylwetka: ${user.avatar.label}`}
            style={[styles.avatar, { backgroundColor: theme.well }]}
          />
          <View style={styles.meText}>
            <AppText variant="heading" testID="profile-name">
              {user.displayName}
            </AppText>
            <AppText variant="secondary" color="textSecondary" testID="profile-silhouette">
              Typ sylwetki: {user.avatar.label.toLowerCase()}
            </AppText>
            <LinkText label="Zmień sylwetkę" onPress={() => router.push('/account/silhouette')} testID="profile-change-silhouette" />
          </View>
        </View>
        <Group title="Konto">
          <Row label="Imię" value={user.displayName} onPress={() => router.push('/account/name')} testID="profile-row-name" />
          <Row
            label="Data urodzenia"
            value={birthDate ? formatDate(birthDate) : undefined}
            onPress={() => router.push('/account/birth-date')}
            testID="profile-row-birth-date"
          />
          <Row label="Płeć" value={genderLabel(user.gender)} onPress={() => router.push('/account/gender')} testID="profile-row-gender" />
          <Row label="E-mail" value={user.email} last />
        </Group>
        <Group title="Pogoda i styl">
          <Row
            label="Pogoda według"
            value={user.location ? (user.location.source === 'device' ? 'Lokalizacji telefonu' : 'Wybranego miasta') : 'Nie ustawiono'}
            meta={user.location?.name}
            onPress={() => router.push('/account/place')}
            testID="profile-row-place"
          />
          <Row
            label="Odczuwanie temperatury"
            value={thermalLabel(user.thermalPreference)}
            onPress={() => router.push('/account/thermal')}
            testID="profile-row-thermal"
          />
          {/* There is no screen for changing the styles yet, so the row only tells what is chosen. */}
          <Row
            label="Preferowane style"
            value={user.styles.length > 0 ? user.styles.map((tag) => styleLabel(tag).toLowerCase()).join(', ') : 'Nie wybrano'}
            last
            testID="profile-row-styles"
          />
        </Group>
        {usage.data ? (
          <Group title="Limity na dziś">
            <Row label="Propozycje" value={`${usage.data.suggestions.used} z ${usage.data.suggestions.limit}`} testID="profile-limit-suggestions" />
            <Row label="Wizualizacje" value={`${usage.data.visualizations.used} z ${usage.data.visualizations.limit}`} testID="profile-limit-visualizations" />
            <Row label="Nowe ubrania" value={`${usage.data.items.used} z ${usage.data.items.limit}`} last testID="profile-limit-items" />
          </Group>
        ) : null}
        <View style={styles.privacy}>
          <Group title="Prywatność">
            <ToggleRow
              label="Zdjęcia ubrań w zewnętrznym AI"
              meta={consentLine(user.aiConsentAt)}
              value={Boolean(user.aiConsentAt)}
              onChange={(agreed) => consent.mutate(agreed)}
              disabled={consent.isPending}
              last={!policyUrl}
              testID="profile-consent"
            />
            {policyUrl ? <Row label="Polityka prywatności" onPress={() => void Linking.openURL(policyUrl)} last testID="profile-row-privacy" /> : null}
          </Group>
          <FormError message={consent.isError ? messageFor(consent.error) : null} />
        </View>
        <Button label="Wyloguj się" kind="secondary" busy={leave.isPending} onPress={() => leave.mutate()} testID="profile-sign-out" />
        <View style={styles.danger}>
          <Group title="Usuwanie konta">
            <View style={styles.dangerBody}>
              <AppText variant="secondary" color="textSecondary">
                Usuniemy konto, ubrania, zestawy i obrazy. Tego nie da się cofnąć.
              </AppText>
              <Button label="Usuń konto" kind="dangerText" inline onPress={() => router.push('/account/delete')} testID="profile-delete-account" />
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
  avatar: { width: 72, height: 96, borderRadius: radius.well },
  meText: { flex: 1, alignItems: 'flex-start' },
  privacy: { gap: space[2] },
  // The mock-up sets the danger zone a little apart from the button above it.
  danger: { marginTop: space[2] },
  dangerBody: { padding: space[4], gap: space[1], alignItems: 'flex-start' },
});
