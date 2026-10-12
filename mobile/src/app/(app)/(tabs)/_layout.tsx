import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useSession } from '@/auth/session';
import { needsOnboarding } from '@/features/onboarding/steps';

import { useTabSlide } from '@/components/motion';
import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const slide = useTabSlide();
  const onboarding = useSession((session) => needsOnboarding(session.user));
  // A new account sees the steps after sign-up once, before the app. The server remembers it, so a second phone does not replay them.
  if (onboarding) {
    return <Redirect href="/onboarding" />;
  }

  // The bar floats: it is positioned over the scenes, which pad their own bottoms (see `useTabBarSpace`).
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ ...slide, headerShown: false, sceneStyle: { backgroundColor: theme.canvas }, tabBarStyle: { position: 'absolute' } }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
