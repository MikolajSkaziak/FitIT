import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DropIn } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { AuthHero } from '@/features/registration/AuthHero';
import { useRegistrationDraft } from '@/features/registration/draft';
import { motion, size } from '@/theme';

/** The first thing a new person sees: a photograph, the name, one line about it, and the two ways in. "Get started" asks for nothing: the account comes after the first look. */
export default function Welcome() {
  const router = useRouter();

  // Coming back here means the sign-up was left: nothing picked or typed there (a password included) is kept.
  useFocusEffect(
    useCallback(() => {
      useRegistrationDraft.getState().reset();
    }, []),
  );

  return (
    <Screen
      testID="welcome-screen"
      contentStyle={styles.flush}
      footer={
        <>
          <Button label="Get started" onPress={() => router.push('/register')} testID="welcome-register" />
          <Button label="I already have an account" kind="text" onPress={() => router.push('/login')} testID="welcome-login" />
        </>
      }>
      <AuthHero variant="welcome" />
      <View style={styles.words}>
        {/* A word nested in a word cannot move, so the wordmark is three pieces in a row: the full stop drops in last. */}
        <View accessible accessibilityRole="header" accessibilityLabel="fitit." style={styles.wordmark} testID="welcome-wordmark">
          <AppText variant="logo" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            fit
          </AppText>
          <AppText variant="logo" color="action" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            it
          </AppText>
          <DropIn delay={motion.sheet} testID="welcome-wordmark-stop">
            <AppText variant="logo" color="action" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              .
            </AppText>
          </DropIn>
        </View>
        <AppText color="textSecondary">Your wardrobe, dressed for today’s weather.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The well runs to the edges of the screen and under the status bar; the words keep the gutter.
  flush: { paddingHorizontal: 0, paddingTop: 0 },
  wordmark: { flexDirection: 'row' },
  words: { paddingHorizontal: size.gutter, paddingTop: 28, gap: 10 },
});
