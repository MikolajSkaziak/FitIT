import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GarmentMosaic, welcomePictures } from '@/components/brand';
import { ProgressBar } from '@/components/controls';
import { Icon, SkyGlyph, type IconName } from '@/components/Icon';
import { ToggleFade } from '@/components/motion';
import { motion, radius, space, useTheme } from '@/theme';

import type { StoryPage } from './pages';

/** Each page's picture is built from what the app already has: the garment pictures, icons and the weather glyph. Decorative. */
export function Illustration({ page, active }: { page: StoryPage['id']; active: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.frame} testID={`story-art-${page}`}>
      {page === 'problem' ? <GarmentMosaic /> : page === 'photograph' ? <Photograph active={active} /> : page === 'daily' ? <Daily active={active} /> : <Rediscover active={active} />}
    </View>
  );
}

function Well({ source, style }: { source: number; style?: object }) {
  const theme = useTheme();
  return (
    <View style={[styles.well, { backgroundColor: theme.well, borderColor: theme.wellLine }, style]}>
      <Image source={source} contentFit="contain" style={styles.picture} />
    </View>
  );
}

/** One photo, and the description that appears beside it. */
function Photograph({ active }: { active: boolean }) {
  const theme = useTheme();
  const facts = [
    ['Type', 'Sweater'],
    ['Color', 'Burgundy'],
    ['Material', 'Wool'],
  ] as const;
  return (
    <View style={styles.photograph}>
      <Well source={welcomePictures.sweaterBurgundy} style={styles.big} />
      <ToggleFade on={active} duration={motion.enter} style={styles.facts}>
        {facts.map(([label, value], index) => (
          <View key={label} style={[styles.fact, index < facts.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null]}>
            <AppText variant="meta" color="textSecondary">
              {label}
            </AppText>
            <AppText variant="label">{value}</AppText>
          </View>
        ))}
      </ToggleFade>
    </View>
  );
}

const occasions: readonly { icon: IconName; label: string }[] = [
  { icon: 'coffee', label: 'Everyday' },
  { icon: 'briefcase', label: 'Work' },
  { icon: 'wine', label: 'Evening' },
  { icon: 'friends', label: 'Friends' },
  { icon: 'barbell', label: 'Sport' },
];

/** Today’s weather, an occasion, and the outfit that comes of both. */
function Daily({ active }: { active: boolean }) {
  return (
    <View style={styles.daily}>
      <View style={styles.weather}>
        <SkyGlyph sky="cloud-sun" size={56} label="Partly cloudy" />
        <View>
          <AppText variant="meta" color="textSecondary">
            Today
          </AppText>
          <AppText variant="heading">Mild, a little cloud</AppText>
        </View>
      </View>
      <View style={styles.occasions}>
        {occasions.map((occasion) => (
          <View key={occasion.label} style={styles.occasion}>
            <Icon name={occasion.icon} color={occasion.label === 'Work' ? 'action' : 'textSecondary'} />
            <AppText variant="meta" color={occasion.label === 'Work' ? 'action' : 'textSecondary'}>
              {occasion.label}
            </AppText>
          </View>
        ))}
      </View>
      <ToggleFade on={active} duration={motion.enter} style={styles.outfit}>
        {[welcomePictures.sweaterBurgundy, welcomePictures.trousersCamel, welcomePictures.bootBrown].map((source, position) => (
          <View key={position} style={styles.back}>
            <Well source={source} style={styles.small} />
          </View>
        ))}
      </ToggleFade>
    </View>
  );
}

/** The share of the wardrobe in use goes up, and a piece nobody wore comes back. */
function Rediscover({ active }: { active: boolean }) {
  return (
    <View style={styles.rediscover}>
      <View style={styles.usage}>
        <AppText variant="secondaryStrong">Your wardrobe in use</AppText>
        <ProgressBar progress={active ? 0.8 : 0.3} label="Share of your wardrobe in use" />
      </View>
      <View style={styles.outfit}>
        <View style={styles.back}>
          <Well source={welcomePictures.coatGrey} style={styles.small} />
          <AppText variant="meta" color="textSecondary">
            Worn often
          </AppText>
        </View>
        <View style={styles.back}>
          <Well source={welcomePictures.coatNavy} style={styles.small} />
          <AppText variant="meta" color="textSecondary">
            Worn often
          </AppText>
        </View>
        <View style={styles.back}>
          <Well source={welcomePictures.bootBrown} style={styles.small} />
          <View style={styles.found}>
            <Icon name="sparkle" size={16} color="action" />
            <AppText variant="meta" color="action">
              Back in your outfits
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { minHeight: 296, justifyContent: 'center' },
  well: { borderRadius: radius.card, borderWidth: 1, padding: space[4] },
  picture: { flex: 1 },
  big: { width: 148, height: 196 },
  small: { height: 104 },
  photograph: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  facts: { flex: 1 },
  fact: { paddingVertical: space[3], gap: 2 },
  daily: { gap: space[6] },
  weather: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  occasions: { flexDirection: 'row', justifyContent: 'space-between' },
  occasion: { alignItems: 'center', gap: space[1], minWidth: 56 },
  outfit: { flexDirection: 'row', gap: space[2] },
  rediscover: { gap: space[6] },
  usage: { gap: space[2] },
  back: { flex: 1, gap: space[2] },
  found: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
