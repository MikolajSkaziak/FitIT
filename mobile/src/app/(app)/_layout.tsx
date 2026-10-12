import { Stack } from 'expo-router';

import { useKeepPlaceCurrent } from '@/features/weather/place';
import { radius, useTheme } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/** Everything behind sign in: the four tabs, the screens that open on top of them, and the sheets that slide over them. */
export default function AppLayout() {
  const theme = useTheme();
  useKeepPlaceCurrent();
  const sheet = (detents: number[] | 'fitToContents') =>
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
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="add" options={sheet([0.62, 0.94])} />
      <Stack.Screen name="filters" options={sheet([0.72, 0.94])} />
      <Stack.Screen name="occasion" options={sheet('fitToContents')} />
      <Stack.Screen name="create" options={sheet('fitToContents')} />
      <Stack.Screen name="basics" options={sheet([0.9])} />
      <Stack.Screen name="consent" options={sheet('fitToContents')} />
      <Stack.Screen name="report" options={sheet('fitToContents')} />
      <Stack.Screen name="plan" options={sheet([0.5, 0.94])} />
      <Stack.Screen name="pick-outfit" options={sheet([0.72, 0.94])} />
      <Stack.Screen name="builder/swap" options={sheet([0.72, 0.94])} />
      {/* The camera covers everything, the sheet it was opened from included. */}
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
