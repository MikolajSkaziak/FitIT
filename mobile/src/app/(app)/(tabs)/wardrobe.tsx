import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function Wardrobe() {
  return (
    <Screen aboveTabBar testID="wardrobe-screen">
      <View style={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Szafa
        </AppText>
        <AppText color="textSecondary">Twoje ubrania pojawią się tutaj po dodaniu pierwszych zdjęć.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[3] },
});
