import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/** Everything behind sign in: the four tabs, and the screens that open on top of them. */
export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
