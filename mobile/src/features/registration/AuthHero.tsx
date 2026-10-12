import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { welcomePictures } from '@/components/brand';
import { IconButton } from '@/components/controls';
import { size, space, useTheme } from '@/theme';

/** How tall each well is, and the photograph that fills it. */
const layouts = {
  welcome: { height: 470, photo: welcomePictures.hero },
  compact: { height: 250, photo: welcomePictures.heroWide },
} as const;

interface AuthHeroProps {
  /** `welcome` is the tall start screen; `compact` tops the log in and reset screens. */
  variant?: keyof typeof layouts;
  /** A round way back over the photo. Left out on the first screen. */
  onBack?: () => void;
}

/** The full-bleed well that opens the screens before sign-up: a tall photograph on the first one, its wide companion on the others. Decorative apart from the back button. */
export function AuthHero({ variant = 'compact', onBack }: AuthHeroProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const layout = layouts[variant];
  return (
    <View style={[styles.hero, { height: layout.height, backgroundColor: theme.well }]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <Image source={layout.photo} contentFit="cover" style={StyleSheet.absoluteFill} />
      </View>
      {onBack ? <IconButton icon="back" label="Back" onPress={onBack} style={{ position: 'absolute', top: insets.top + space[2], left: size.gutter }} testID="auth-back" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: 'stretch', overflow: 'hidden' },
});
