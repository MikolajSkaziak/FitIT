import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useRegistrationDraft } from '@/features/registration/draft';
import { StoryPager } from '@/features/story/StoryPager';
import { useTheme } from '@/theme';

/** The first thing a new person sees: the story in four pages, with the two ways in always at hand. */
export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();

  // Coming back here means the registration was abandoned: nothing typed there (a password included) is kept.
  useFocusEffect(
    useCallback(() => {
      useRegistrationDraft.getState().reset();
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas }} testID="welcome-screen">
      <StoryPager onCreate={() => router.push('/register')} onLogin={() => router.push('/login')} />
    </View>
  );
}
