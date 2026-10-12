import { BodoniModa_500Medium } from '@expo-google-fonts/bodoni-moda/500Medium';
import { BodoniModa_500Medium_Italic } from '@expo-google-fonts/bodoni-moda/500Medium_Italic';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { fetchMe } from '@/api/account';
import { restoreSession, useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Brandmark } from '@/components/brand';
import { Button } from '@/components/Button';
import { PhotoPeekHost } from '@/components/PhotoPeek';
import { Screen } from '@/components/Screen';
import { queryClient } from '@/lib/queryClient';
import { space, useTheme } from '@/theme';

// The splash screen stays until the fonts are in and we know whether somebody is signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const status = useSession((session) => session.status);
  const [fontsLoaded, fontError] = useFonts({ BodoniModa_500Medium, BodoniModa_500Medium_Italic, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold });

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
    // Gestures (arranging an outfit's board) are recognised inside this view only.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="auto" />
          <PhotoPeekHost>
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
          </PhotoPeekHost>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
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
    <Screen scroll={false} footer={<Button label="Try again" busy={retrying} onPress={() => void retry()} testID="retry-connection" />}>
      <View style={styles.unreachable}>
        <Brandmark small />
        <View style={styles.message}>
          <AppText variant="display" accessibilityRole="header">
            Couldn’t connect
          </AppText>
          <AppText color="textSecondary">Check your internet and try again. Your account and clothes are safe.</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  unreachable: { flex: 1, justifyContent: 'center', gap: space[6] },
  message: { gap: space[2] },
});
