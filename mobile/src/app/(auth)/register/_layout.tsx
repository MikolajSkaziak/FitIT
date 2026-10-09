import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** The first six steps of the one journey, in order. The last one sets the weather place and creates the account. */
export default function RegisterLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="silhouette" />
      <Stack.Screen name="fit" />
      <Stack.Screen name="style" />
      <Stack.Screen name="weather" />
    </Stack>
  );
}
