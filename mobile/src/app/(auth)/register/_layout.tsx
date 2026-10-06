import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** The five registration steps, in order; the city screen stands in for the fifth when location is not wanted. */
export default function RegisterLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="silhouette" />
      <Stack.Screen name="style" />
      <Stack.Screen name="weather" />
      <Stack.Screen name="city" />
    </Stack>
  );
}
