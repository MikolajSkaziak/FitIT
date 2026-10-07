import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { updateProfile, type ProfileChange } from '@/api/account';
import { weatherKeys } from '@/api/weather';
import { setUser } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { space } from '@/theme';

/** Saves a change to the profile; the signed-in person kept in memory is replaced by what the server answers. */
export function useSaveProfile(onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: ProfileChange) => updateProfile(change),
    onSuccess: (user) => {
      setUser(user);
      // The thermal preference shifts the forecast's band, so the weather on Dziś is asked for again.
      void queryClient.invalidateQueries({ queryKey: weatherKeys.all });
      onSaved();
    },
  });
}

interface EditScreenProps {
  title: string;
  lead?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction: () => void;
  busy?: boolean;
  /** What the server refused, shown above the button in the app's own words. */
  error?: unknown;
  /** Something the person still has to do before the action can run. */
  notice?: string | null;
  testID?: string;
}

/** A screen that changes one thing in the profile: a way back, the control, one button. */
export function EditScreen({ title, lead, children, actionLabel = 'Zapisz', onAction, busy, error, notice, testID }: EditScreenProps) {
  const router = useRouter();
  return (
    <Screen
      testID={testID}
      footer={
        <>
          <FormError message={notice ?? (error ? messageFor(error) : null)} />
          <Button label={actionLabel} busy={busy} onPress={onAction} testID="edit-save" />
        </>
      }>
      <View style={styles.content}>
        <BackHeader title={title} onBack={() => router.back()} />
        {lead ? <AppText color="textSecondary">{lead}</AppText> : null}
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4] },
});
