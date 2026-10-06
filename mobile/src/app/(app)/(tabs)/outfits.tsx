import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function Outfits() {
  return (
    <Screen aboveTabBar testID="outfits-screen">
      <View style={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Outfity
        </AppText>
        <AppText color="textSecondary">Tu znajdziesz zapisane zestawy.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[3] },
});
