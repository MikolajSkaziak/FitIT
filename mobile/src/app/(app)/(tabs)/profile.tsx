import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { signOut, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Group, Row } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { genderLabel } from '@/copy/labels';
import { formatDate, fromIso } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';

export default function Profile() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSession((session) => session.user);
  const leave = useMutation({ mutationFn: () => signOut() });

  // This tab only exists while somebody is signed in; the check keeps the types honest during sign out.
  if (!user) {
    return null;
  }

  const birthDate = fromIso(user.birthDate);

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
        <Button label="Wyloguj się" kind="secondary" busy={leave.isPending} onPress={() => leave.mutate()} testID="profile-sign-out" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  avatar: { width: 72, height: 96, borderRadius: radius.well },
  meText: { flex: 1, alignItems: 'flex-start' },
});
