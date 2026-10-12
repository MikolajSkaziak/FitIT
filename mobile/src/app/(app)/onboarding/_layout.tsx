import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** The steps after the account is created: body shape, fit, colors, recap. The first one has no way back, so the account is not left half way by a swipe. */
export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="shape" options={{ gestureEnabled: false }} />
      <Stack.Screen name="fit" />
      <Stack.Screen name="colors" />
      <Stack.Screen name="done" />
    </Stack>
  );
}
