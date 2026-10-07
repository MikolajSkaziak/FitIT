import { Stack } from 'expo-router';

import { useKeepPlaceCurrent } from '@/features/weather/place';
import { radius, useTheme } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/** Everything behind sign in: the four tabs, the screens that open on top of them, and the sheets that slide over them. */
export default function AppLayout() {
  const theme = useTheme();
  useKeepPlaceCurrent();
  const sheet = (detents: number[]) =>
    ({
      presentation: 'formSheet',
      sheetAllowedDetents: detents,
      sheetGrabberVisible: true,
      sheetCornerRadius: radius.sheet,
      contentStyle: { backgroundColor: theme.canvas },
    }) as const;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add" options={sheet([0.62, 0.94])} />
      <Stack.Screen name="filters" options={sheet([0.72])} />
      <Stack.Screen name="occasion" options={sheet([0.8])} />
    </Stack>
  );
}
