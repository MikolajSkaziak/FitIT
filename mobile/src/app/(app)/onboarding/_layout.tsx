import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Steps 6 to 8 of the journey, after the account is created. The first one has no way back, so the account is not left half way by a swipe. */
export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="colors" options={{ gestureEnabled: false }} />
      <Stack.Screen name="basics" />
      <Stack.Screen name="done" />
    </Stack>
  );
}
