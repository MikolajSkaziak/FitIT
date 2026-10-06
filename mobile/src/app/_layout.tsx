import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { fetchMe } from '@/api/account';
import { restoreSession, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Brandmark } from '@/components/brand';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { queryClient } from '@/lib/queryClient';
import { space, useTheme } from '@/theme';

// The splash screen stays until the fonts are in and we know whether somebody is signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const status = useSession((session) => session.status);
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_600SemiBold, Figtree_400Regular, Figtree_600SemiBold });

  useEffect(() => {
    void restoreSession(fetchMe);
  }, []);

  // If the fonts cannot be read the app still opens, in the system typeface.
  const ready = (fontsLoaded || fontError !== null) && status !== 'loading';
  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: theme.canvas, card: theme.surface, text: theme.text, border: theme.border, primary: theme.action, notification: theme.danger },
  };
  const signedIn = status === 'signedIn';

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="auto" />
        {status === 'unreachable' ? (
          <Unreachable />
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Somebody is signed in on this phone, but the server could not be reached to confirm it. */
function Unreachable() {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    await restoreSession(fetchMe);
    setRetrying(false);
  };

  return (
    <Screen scroll={false} footer={<Button label="Spróbuj ponownie" busy={retrying} onPress={() => void retry()} testID="retry-connection" />}>
      <View style={styles.unreachable}>
        <Brandmark small />
        <View style={styles.message}>
          <AppText variant="display" accessibilityRole="header">
            Nie udało się połączyć
          </AppText>
          <AppText color="textSecondary">Sprawdź internet i spróbuj ponownie. Twoje konto i ubrania są bezpieczne.</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  unreachable: { flex: 1, justifyContent: 'center', gap: space[6] },
  message: { gap: space[2] },
});
