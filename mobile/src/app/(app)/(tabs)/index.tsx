import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Occasion } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { fetchUsage, fetchWardrobeStats, wardrobeKeys } from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { OccasionPicker } from '@/features/styling/OccasionPicker';
import { proposalsRoute } from '@/features/styling/request';
import { locationProblems } from '@/features/weather/copy';
import { useLocate } from '@/features/weather/place';
import { LocationMissing, WeatherProblem, WeatherRow, WeatherSkeleton } from '@/features/weather/WeatherRow';
import { formatCalendarWeekday, today, wallClock } from '@/lib/dates';
import { space } from '@/theme';

export default function Today() {
  const router = useRouter();
  const name = useSession((session) => session.user?.displayName);
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const [note, setNote] = useState('');
  const locate = useLocate();

  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });
  const weather = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs });

  const forecast = weather.data;
  // The date is the one on the wall at the place the weather is for, not the one on the phone.
  const day = (forecast ? wallClock(forecast.from)?.date : null) ?? today();
  const left = usage.data ? usage.data.suggestions.limit - usage.data.suggestions.used : null;
  const limitUsed = left !== null && left <= 0;
  const locateOutcome = locate.data;

  const greeting = (
    <View style={styles.head}>
      <AppText variant="secondary" color="textSecondary">
        {name ? `Cześć, ${name}. ` : ''}
        {forecast?.forTomorrow ? 'Jutro' : 'Dziś'} {formatCalendarWeekday(day)}.
      </AppText>
      <AppText variant="display" accessibilityRole="header">
        Co {forecast?.forTomorrow ? 'jutro' : 'dziś'}{' '}
        <AppText variant="display" color="action">
          ubrać?
        </AppText>
      </AppText>
    </View>
  );

  // Nothing to dress anybody from yet: the page offers the one thing that helps.
  if (stats.data?.total === 0) {
    return (
      <Screen aboveTabBar testID="today-screen">
        {greeting}
        <EmptyState
          icon="sun"
          title="Zacznij od swojej szafy"
          text="Dodaj kilka ubrań, a ułożymy z nich zestawy na pogodę i na okazję."
          action={{ label: 'Dodaj ubrania', icon: 'plus', onPress: () => router.push('/add'), testID: 'today-add' }}
          testID="today-empty"
        />
      </Screen>
    );
  }

  const weatherBlock = forecast ? (
    <WeatherRow weather={forecast} />
  ) : weather.isPending ? (
    <WeatherSkeleton />
  ) : codeOf(weather.error) === 'location_missing' ? (
    <LocationMissing
      onLocate={() => locate.mutate()}
      locating={locate.isPending}
      onChooseCity={() => router.push('/account/place')}
      problem={locate.isError ? messageFor(locate.error) : locateOutcome === 'denied' || locateOutcome === 'unavailable' ? locationProblems[locateOutcome] : null}
    />
  ) : (
    <WeatherProblem message={messageFor(weather.error)} onRetry={() => void weather.refetch()} retrying={weather.isFetching} />
  );

  return (
    <Screen
      aboveTabBar
      testID="today-screen"
      footer={
        <>
          {limitUsed ? (
            <AppText variant="secondary" color="textSecondary" align="center" testID="today-limit">
              Dzisiejszy limit propozycji jest wykorzystany. Wróć jutro.
            </AppText>
          ) : forecast && left !== null && usage.data ? (
            <AppText variant="meta" color="textSecondary" align="center" tabular testID="today-remaining">
              Zostało {left} z {usage.data.suggestions.limit} propozycji na dziś.
            </AppText>
          ) : null}
          <Button
            label="Zaproponuj zestawy"
            disabled={!forecast || limitUsed}
            onPress={() => router.push(proposalsRoute({ occasion, note }))}
            testID="today-suggest"
          />
        </>
      }>
      <View style={styles.content}>
        {greeting}
        {weatherBlock}
        <OccasionPicker occasion={occasion} onOccasion={setOccasion} note={note} onNote={setNote} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  head: { gap: 2 },
});
