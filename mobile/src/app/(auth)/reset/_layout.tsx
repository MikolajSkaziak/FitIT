import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Asking for the code, then using it. */
export default function ResetLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="code" />
    </Stack>
  );
}
