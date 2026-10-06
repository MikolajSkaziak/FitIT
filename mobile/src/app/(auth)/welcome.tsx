import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Brandmark, GarmentMosaic } from '@/components/brand';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useRegistrationDraft } from '@/features/registration/draft';
import { space } from '@/theme';

export default function Welcome() {
  const router = useRouter();

  // Coming back here means the registration was abandoned: nothing typed there (a password included) is kept.
  useFocusEffect(
    useCallback(() => {
      useRegistrationDraft.getState().reset();
    }, []),
  );

  return (
    <Screen
      testID="welcome-screen"
      footer={
        <View style={styles.actions}>
          <Button label="Załóż konto" onPress={() => router.push('/register')} testID="welcome-register" />
          <Button label="Mam już konto" kind="secondary" onPress={() => router.push('/login')} testID="welcome-login" />
        </View>
      }>
      <View style={styles.top}>
        <GarmentMosaic />
        <Brandmark />
        <View style={styles.pitch}>
          <AppText variant="display" accessibilityRole="header">
            Pełna szafa, a nie masz się{' '}
            <AppText variant="display" color="action">
              w co ubrać?
            </AppText>
          </AppText>
          <AppText color="textSecondary">Ułożymy zestawy z tego, co już masz. Na pogodę i na okazję.</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: space[6] },
  pitch: { gap: space[2] },
  actions: { gap: space[2] },
});
