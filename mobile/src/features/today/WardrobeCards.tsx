import { StyleSheet, View } from 'react-native';

import type { Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GarmentImage } from '@/components/garments';
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
      <View style={[styles.nudge, { backgroundColor: theme.sage }]} testID="today-nudge">
        <View style={styles.head}>
          <View style={styles.words}>
            <AppText variant="subheading" accessibilityRole="header">
              {piecesTitle(total)}
            </AppText>
            <AppText variant="secondary" color="onSage">
              {nudgeLine(total)}
            </AppText>
          </View>
          <View style={styles.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {recent.slice(0, 3).map((item, position) => (
              <GarmentImage
                key={item.id}
                url={item.imageUrl}
                cacheKey={item.imageKey}
                height={40}
                inset={space[1]}
                corner={20}
                style={[styles.face, position > 0 ? styles.overlap : null, { backgroundColor: theme.wellChip, borderColor: theme.sage }]}
              />
            ))}
          </View>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={piecesProgress(total)}
          accessibilityValue={{ min: 0, max: wardrobeGoal, now: total }}
          style={[styles.track, { backgroundColor: theme.surface }]}>
          <ProgressFill progress={Math.min(1, total / wardrobeGoal)} style={[styles.fill, { backgroundColor: theme.action }]} />
        </View>
        <Button label="Add clothes" icon="plus" compact inline onPress={onAdd} testID="today-add" />
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
  const theme = useTheme();
  return (
    <Fade>
      <View style={[styles.forgotten, { backgroundColor: theme.surface, borderColor: theme.border }]} testID="today-forgotten">
        <GarmentImage url={item.imageUrl} cacheKey={item.imageKey} height={84} inset={space[2]} style={styles.picture} />
        <View style={styles.forgottenWords}>
          <AppText variant="metaStrong" color="textSecondary">
            Not worn lately
          </AppText>
          <AppText variant="label">{turnLine(item.name)}</AppText>
          <PressScale accessibilityRole="button" accessibilityLabel="Style it" onPress={onStyle} hitSlop={space[1]} style={styles.link} testID="today-style-it">
            <AppText variant="label" color="action">
              Style it
            </AppText>
            <Icon name="forward" size={16} color="action" />
          </PressScale>
        </View>
      </View>
    </Fade>
  );
}

const styles = StyleSheet.create({
  nudge: { borderRadius: radius.card, padding: space[4], gap: space[3], alignItems: 'flex-start' },
  head: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  words: { flex: 1 },
  faces: { flexDirection: 'row' },
  face: { width: 40, borderWidth: 2 },
  overlap: { marginLeft: -space[3] },
  track: { alignSelf: 'stretch', height: space[2], borderRadius: space[1], overflow: 'hidden' },
  fill: { borderRadius: space[1] },
  forgotten: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: radius.card, padding: space[3] },
  picture: { width: 84 },
  forgottenWords: { flex: 1, gap: 2 },
  link: { alignSelf: 'flex-start', minHeight: size.touch, flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
