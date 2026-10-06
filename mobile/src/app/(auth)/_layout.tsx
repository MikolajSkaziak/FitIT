import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
