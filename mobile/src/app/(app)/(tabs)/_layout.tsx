import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useSession } from '@/auth/session';
import { needsOnboarding } from '@/features/onboarding/steps';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const onboarding = useSession((session) => needsOnboarding(session.user));
  // A new account sees the three steps once, before the app. The server remembers it, so a second phone does not replay them.
  if (onboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.canvas } }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
