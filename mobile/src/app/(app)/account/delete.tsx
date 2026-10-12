import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteAccount } from '@/api/account';
import { fetchWardrobeStats, wardrobeKeys } from '@/api/wardrobe';
import { signOut, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { Group, Row } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { confirmationWord, isDeletionConfirmed, memberSince } from '@/features/profile/deletion';
import { LabelHero } from '@/features/profile/LabelHero';
import * as haptics from '@/lib/haptics';
import { garments } from '@/lib/plural';
import { size, space } from '@/theme';

/**
 * Deleting the account: says what will go, asks for the confirmation word and the password, and only then offers the
 * button. Once the server has deleted the account the session ends, and the sign-in guard returns the person to the start screen.
 */
export default function DeleteAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSession((session) => session.user);
  const [word, setWord] = useState('');
  const [password, setPassword] = useState('');
  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const remove = useMutation({
    mutationFn: (current: string) => deleteAccount(current),
    onSuccess: () => signOut(),
  });

  const ready = isDeletionConfirmed(word) && password.length > 0;
  const submit = () => {
    if (ready) {
      haptics.destroy();
      remove.mutate(password);
    }
  };

  const since = user ? memberSince(user.createdAt) : null;
  return (
    <Screen
      testID="delete-account"
      contentStyle={styles.bleed}
      footer={
        <>
          <FormError message={remove.isError ? messageFor(remove.error) : null} />
          <Button label="Delete my account" kind="danger" disabled={!ready} busy={remove.isPending} onPress={submit} testID="delete-confirm" />
          <Button label="Keep my account" kind="text" onPress={() => router.back()} testID="delete-cancel" />
        </>
      }>
      <View>
        <LabelHero
          value={user?.displayName ?? ''}
          eyebrow="Leaving fitit."
          note={
            since ? (
              <AppText variant="caption" color="textSecondary">
                Member since {since}
              </AppText>
            ) : null
          }
        />
        <IconButton icon="back" label="Back" onPress={() => router.back()} style={[styles.back, { top: insets.top + space[2] }]} />
      </View>
      <View style={styles.content}>
        <View style={styles.text}>
          <AppText variant="eyebrow">This can’t be undone</AppText>
          <AppText variant="display" accessibilityRole="header">
            Delete your{'\n'}account
          </AppText>
        </View>
        <Group title="Removed for good, right away">
          <View testID="delete-summary">
            <Row label="Wardrobe" value={stats.data ? garments(stats.data.total) : undefined} />
            <Row label="Saved outfits" />
            <Row label="Try-on pictures" />
            <Row label="Profile, colors and preferences" />
          </View>
        </Group>
        <View style={styles.fields}>
          <Field
            label={`Type ${confirmationWord} to confirm`}
            value={word}
            onChangeText={(text) => {
              setWord(text);
              remove.reset();
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="next"
            testID="delete-word"
          />
          <PasswordField
            label="Enter your password to confirm"
            placeholder="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              remove.reset();
            }}
            returnKeyType="done"
            onSubmitEditing={submit}
            testID="delete-password"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The hero reaches the edges of the screen; the rest keeps the gutter.
  bleed: { paddingTop: 0, paddingHorizontal: 0 },
  back: { position: 'absolute', left: size.gutter },
  content: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[6] },
  text: { gap: 10 },
  fields: { gap: space[4] },
});
