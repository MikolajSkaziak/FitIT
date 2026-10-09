import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { fetchWardrobeStats, wardrobeKeys } from '@/api/wardrobe';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { Card, Row } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { recap } from '@/features/onboarding/copy';
import { flow } from '@/features/flow';
import { Frame } from '@/features/onboarding/Frame';
import { nextLine, recapLines } from '@/features/onboarding/recap';
import { useAdvance } from '@/features/onboarding/useAdvance';
import { space } from '@/theme';

/** Step 9 of 9: what the person gave, what happens next, and one way into the app. */
export default function OnboardingDone() {
  const user = useSession((session) => session.user);
  const advance = useAdvance();
  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const weather = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs, enabled: Boolean(user?.location) });
  const clothes = stats.data?.total ?? 0;

  if (!user) {
    return null;
  }

  const lines = recapLines(user, weather.data, clothes);
  return (
    <Frame
      step={flow.done}
      onBack={() => advance.back('/onboarding/done', false)}
      title={recap.title}
      lead={recap.lead}
      testID="onboarding-done"
      footer={
        <>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button label={recap.action} busy={advance.pending} onPress={advance.finish} testID="done-finish" />
        </>
      }>
      <Card>
        {lines.map((line, index) => (
          <Row key={line.key} label={line.label} value={line.value} meta={line.meta} last={index === lines.length - 1} testID={`recap-${line.key}`} />
        ))}
      </Card>
      <View style={styles.next}>
        <AppText variant="subheading" accessibilityRole="header">
          {recap.next}
        </AppText>
        <AppText color="textSecondary" testID="recap-next">
          {nextLine(clothes)}
        </AppText>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  next: { gap: space[1] },
});
