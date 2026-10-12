import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** The steps before the account, in order: gender, styles, the pieces you own, a place, the first look made of them, and the account that keeps it. */
export default function RegisterLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="style" />
      <Stack.Screen name="basics" />
      <Stack.Screen name="place" />
      <Stack.Screen name="look" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
