import { StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { formatWeekday } from '@/lib/dates';
import { space } from '@/theme';

export default function Today() {
  const name = useSession((session) => session.user?.displayName);
  return (
    <Screen aboveTabBar testID="today-screen">
      <View style={styles.content}>
        <View style={styles.head}>
          <AppText variant="secondary" color="textSecondary">
            {name ? `Cześć, ${name}. ` : ''}Dziś {formatWeekday(new Date())}.
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            Co dziś{' '}
            <AppText variant="display" color="action">
              ubrać?
            </AppText>
          </AppText>
        </View>
        <AppText color="textSecondary">Zestawy na dziś ułożymy, gdy w szafie będą ubrania.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  head: { gap: 2 },
});
