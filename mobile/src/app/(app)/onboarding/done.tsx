import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { fetchClothes, fetchWardrobeStats, noFilter, wardrobeKeys } from '@/api/wardrobe';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { useSession } from '@/auth/session';
import { BoardView } from '@/components/BoardView';
import { onboardingPictures } from '@/components/brand';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { Row, Skeleton } from '@/components/lists';
import { Fade } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import { recap } from '@/features/onboarding/copy';
import { lookOfClothes } from '@/features/onboarding/firstLook';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { recapLines } from '@/features/onboarding/recap';
import { boardAspect, boardSize } from '@/features/styling/board';
import { useAdvance } from '@/features/onboarding/useAdvance';
import { radius, size, useTheme } from '@/theme';

/**
 * The last step: a board with a look made of the pieces now in the wardrobe at the top (a photograph while there are too few for
 * one), a short recap of what the person gave, and one way into the app.
 */
export default function OnboardingDone() {
  const theme = useTheme();
  const width = useWindowDimensions().width - 2 * size.gutter;
  const user = useSession((session) => session.user);
  const advance = useAdvance();
  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const clothes = useQuery({ queryKey: wardrobeKeys.list(noFilter), queryFn: ({ signal }) => fetchClothes(noFilter, signal) });
  const weather = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs, enabled: Boolean(user?.location) });

  if (!user) {
    return null;
  }

  const look = lookOfClothes(clothes.data ?? []);
  const ready = look.length > 0;
  return (
    <Frame
      step="done"
      onBack={() => advance.back('/onboarding/done', Boolean(user.colorAnalysis))}
      visual
      underlined
      picture={
        clothes.isPending ? (
          <Skeleton width={width} height={boardSize(width).height} radius={radius.well} />
        ) : ready ? (
          <BoardView items={look} width={width} testID="recap-look" />
        ) : (
          <Fade style={[styles.photo, { backgroundColor: theme.well }]} testID="recap-photo">
            <Image source={onboardingPictures.rail} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
          </Fade>
        )
      }
      title={recap.title}
      lead={clothes.isPending ? undefined : ready ? recap.readyLead(user.location?.name) : recap.lead}
      testID="onboarding-done"
      footer={
        <Actions>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button label={recap.action} busy={advance.pending} onPress={advance.finish} testID="done-finish" />
        </Actions>
      }>
      <View>
        {recapLines(user, weather.data, stats.data?.total ?? 0).map((line) => (
          <Row key={line.key} label={line.label} value={line.value} meta={line.meta} testID={`recap-${line.key}`} />
        ))}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: 'stretch', aspectRatio: boardAspect, borderRadius: radius.well, overflow: 'hidden' },
});
