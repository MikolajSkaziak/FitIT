import { StyleSheet, View } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GarmentImage } from '@/components/garments';
import { Hairline } from '@/components/Hairline';
import { Icon } from '@/components/Icon';
import { Fade, PressScale, ProgressFill } from '@/components/motion';
import { radius, size, space, useTheme } from '@/theme';

import { nudgeLine, piecesProgress, piecesTitle, turnLine, wardrobeGoal } from './copy';

interface WardrobeNudgeProps {
  total: number;
  /** The newest pieces, for the three small pictures; fewer or none is fine. */
  recent: readonly Clothing[];
  onAdd: () => void;
}

/** A small wardrobe gives the stylist little to vary: how far it is from ten pieces, and the way to add more. */
export function WardrobeNudge({ total, recent, onAdd }: WardrobeNudgeProps) {
  const theme = useTheme();
  return (
    <Fade>
      <View style={styles.nudge} testID="today-nudge">
        <Hairline />
        <View style={styles.head}>
          <View style={styles.words}>
            <AppText variant="title" accessibilityRole="header">
              {piecesTitle(total)}
            </AppText>
            <AppText variant="secondary" color="textSecondary">
              {nudgeLine(total)}
            </AppText>
          </View>
          <View style={styles.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {recent.slice(0, 3).map((item) => (
              <GarmentImage key={item.id} url={item.imageUrl} cacheKey={item.imageKey} height={40} inset={space[1]} corner={radius.thumb} style={styles.face} />
            ))}
          </View>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={piecesProgress(total)}
          accessibilityValue={{ min: 0, max: wardrobeGoal, now: total }}
          style={[styles.track, { backgroundColor: theme.border }]}>
          <ProgressFill progress={Math.min(1, total / wardrobeGoal)} style={{ backgroundColor: theme.action }} />
        </View>
        <Button label="Add clothes" kind="text" icon="plus" compact inline onPress={onAdd} style={styles.flush} testID="today-add" />
      </View>
    </Fade>
  );
}

interface ForgottenCardProps {
  item: Clothing;
  onStyle: () => void;
}

/** One garment that has not been worn in a while, and the way to an outfit built around it. */
export function ForgottenCard({ item, onStyle }: ForgottenCardProps) {
  return (
    <Fade>
      <View style={styles.nudge} testID="today-forgotten">
        <Hairline />
        <View style={styles.forgotten}>
          <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={84} inset={space[2]} style={styles.picture} />
          <View style={styles.forgottenWords}>
            <AppText variant="eyebrow">Not worn lately</AppText>
            <AppText variant="title">{turnLine(item.name)}</AppText>
            <PressScale accessibilityRole="button" accessibilityLabel="Style it" haptic="quiet" onPress={onStyle} hitSlop={space[1]} style={styles.link} testID="today-style-it">
              <AppText variant="title" color="action">
                Style it
              </AppText>
              <Icon name="forward" size={16} color="action" />
            </PressScale>
          </View>
        </View>
      </View>
    </Fade>
  );
}

interface ColorsNudgeProps {
  onFind: () => void;
}

/** For someone who skipped the colour analysis: that it exists, what it changes, and the way in. */
export function ColorsNudge({ onFind }: ColorsNudgeProps) {
  const theme = useTheme();
  return (
    <Fade>
      <View style={styles.nudge} testID="today-colors">
        <Hairline />
        <View style={styles.forgotten}>
          <View style={[styles.picture, styles.glyph, { backgroundColor: theme.well }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="palette" size={24} color="action" />
          </View>
          <View style={styles.forgottenWords}>
            <AppText variant="eyebrow">Your colors</AppText>
            <AppText variant="title">Find the colors that suit you</AppText>
            <AppText variant="secondary" color="textSecondary">
              One selfie, and your looks lean toward them.
            </AppText>
            <PressScale accessibilityRole="button" accessibilityLabel="Find my colors" haptic="quiet" onPress={onFind} hitSlop={space[1]} style={styles.link} testID="today-find-colors">
              <AppText variant="title" color="action">
                Find my colors
              </AppText>
              <Icon name="forward" size={16} color="action" />
            </PressScale>
          </View>
        </View>
      </View>
    </Fade>
  );
}

const styles = StyleSheet.create({
  nudge: { gap: space[3], alignItems: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  words: { flex: 1, gap: 2 },
  faces: { flexDirection: 'row', gap: space[1] },
  face: { width: 40 },
  track: { height: size.bar, overflow: 'hidden' },
  // A text button carries its own horizontal padding; here it has none, so it starts at the page's left edge.
  flush: { paddingHorizontal: 0 },
  forgotten: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  picture: { width: 84 },
  glyph: { height: 84, borderRadius: radius.well, alignItems: 'center', justifyContent: 'center' },
  forgottenWords: { flex: 1, gap: 2 },
  link: { alignSelf: 'flex-start', minHeight: size.touch, flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
