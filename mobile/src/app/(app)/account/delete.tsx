import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { deleteAccount } from '@/api/account';
import { fetchWardrobeStats, wardrobeKeys } from '@/api/wardrobe';
import { signOut } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { FormError, PasswordField } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { confirmationWord, deletionSummary, isDeletionConfirmed } from '@/features/profile/deletion';
import { space } from '@/theme';

/**
 * Deleting the account: says what will go, asks for the confirmation word and the password, and only then offers the
 * button. Once the server has deleted the account the session ends, and the sign-in guard returns the person to the start screen.
 */
export default function DeleteAccount() {
  const router = useRouter();
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
      remove.mutate(password);
    }
  };

  return (
    <Screen
      testID="delete-account"
      footer={
        <>
          <FormError message={remove.isError ? messageFor(remove.error) : null} />
          <Button label="Usuń konto" kind="danger" disabled={!ready} busy={remove.isPending} onPress={submit} testID="delete-confirm" />
          <Button label="Zostaw konto" kind="secondary" onPress={() => router.back()} testID="delete-cancel" />
        </>
      }>
      <View style={styles.content}>
        <View style={styles.text}>
          <AppText variant="heading" accessibilityRole="header">
            Usunąć konto?
          </AppText>
          <AppText testID="delete-summary">{deletionSummary(stats.data?.total)}</AppText>
        </View>
        <Field
          label={`Wpisz ${confirmationWord}, aby potwierdzić`}
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
          label="Hasło"
          helper="Podaj hasło do konta, żeby potwierdzić usunięcie."
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
  text: { gap: space[2] },
});
