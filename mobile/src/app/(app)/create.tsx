import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/controls';
import { Hairline } from '@/components/Hairline';
import { Icon, type IconName } from '@/components/Icon';
import { Fade, PressScale, staggerOf } from '@/components/motion';
import { create } from '@/features/onboarding/copy';
import { size, space, travel, useTheme } from '@/theme';

/** What the raised plus in the tab bar opens: the two ways to put something into the app. A short sheet. */
export default function Create() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The menu is gone before the target slides up, so one sheet is replaced by the other and nothing flashes in between.
  const go = (href: Href) => () => router.replace(href);

  // The root stays a real native view and is not stretched, so the sheet can be fitted to what is in it.
  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="create-sheet">
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header" accessibilityLabel={create.title}>
          Add to fit
          <AppText variant="heading" color="action">
            it.
          </AppText>
        </AppText>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <View>
        <Hairline />
        <Fade rise={travel.rise} {...staggerOf(0, true)}>
          <Choice icon="camera" label={create.clothes} caption="Photograph new pieces for your wardrobe" onPress={go('/add')} testID="create-clothes" />
        </Fade>
        <Fade rise={travel.rise} {...staggerOf(1, true)}>
          <Choice icon="hanger" label={create.build} caption="Put pieces together yourself" onPress={go('/builder')} testID="create-build" />
        </Fade>
      </View>
    </View>
  );
}

function Choice({ icon, label, caption, onPress, testID }: { icon: IconName; label: string; caption: string; onPress: () => void; testID: string }) {
  const theme = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <Icon name={icon} color="action" />
      <View style={styles.words}>
        <AppText variant="title">{label}</AppText>
        <AppText variant="caption" color="textSecondary">
          {caption}
        </AppText>
      </View>
      <Icon name="forward" size={16} color="textSecondary" />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { minHeight: size.option + space[2], paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1 },
  words: { flex: 1, gap: 2 },
});
