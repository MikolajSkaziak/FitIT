import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.canvas } }}>
      <Tabs.Screen name="index" options={{ title: 'Dziś' }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Szafa' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
