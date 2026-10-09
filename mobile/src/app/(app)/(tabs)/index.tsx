import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchTodaysOutfits, outfitKeys, type Occasion } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { fetchClothes, fetchWardrobeStats, noFilter, wardrobeKeys, type ClothesFilter } from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Fade, PressScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { missingNotice, noOutfits } from '@/features/styling/copy';
import { picksLine, wardrobeGoal } from '@/features/today/copy';
import { OccasionPills } from '@/features/today/OccasionPills';
import { PicksCarousel, PicksEmpty, PicksSkeleton } from '@/features/today/Picks';
import { ForgottenCard, WardrobeNudge } from '@/features/today/WardrobeCards';
import { greetingAt, locationProblems } from '@/features/weather/copy';
import { useLocate } from '@/features/weather/place';
import { LocationMissing, WeatherCard, WeatherProblem, WeatherSkeleton } from '@/features/weather/WeatherCard';
import { formatCalendarWeekday, toIso, today, wallClock } from '@/lib/dates';
import { motion, size, space, useTheme } from '@/theme';

const forgottenOnly: ClothesFilter = { ...noFilter, forgotten: true };

export default function Today() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const name = useSession((session) => session.user?.displayName);
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const locate = useLocate();

  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const weather = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs });

  const forecast = weather.data;
  // The date and the hour are the ones on the wall at the place the weather is for, not the ones on the phone.
  const clock = forecast ? wallClock(forecast.from) : null;
  const day = clock?.date ?? today();
  const total = stats.data?.total;
  const noPlace = codeOf(weather.error) === 'location_missing';

  // Whatever the answer, the count of proposals left for today has changed or is now known.
  const counted = () => void queryClient.invalidateQueries({ queryKey: wardrobeKeys.usage });
  const picksKey = outfitKeys.today(occasion, toIso(day), total ?? null);
  const picks = useQuery({
    queryKey: picksKey,
    queryFn: () => fetchTodaysOutfits(occasion).finally(counted),
    // The server keeps one set per day and occasion, so asking is free after the first time; an empty wardrobe and a
    // profile without a place have nothing to ask for. It waits for the size of the wardrobe, which is part of the key.
    enabled: !stats.isPending && total !== 0 && !noPlace,
    staleTime: weatherStaleMs,
    retry: false,
  });
  const refresh = useMutation({
    mutationFn: (asked: { occasion: Occasion; key: ReturnType<typeof outfitKeys.today> }) => fetchTodaysOutfits(asked.occasion, true).finally(counted),
    onSuccess: (fresh, asked) => queryClient.setQueryData(asked.key, fresh),
  });
  const refreshing = refresh.isPending && refresh.variables.occasion === occasion;

  const recent = useQuery({
    queryKey: wardrobeKeys.list(noFilter),
    queryFn: ({ signal }) => fetchClothes(noFilter, signal),
    enabled: total !== undefined && total > 0 && total < wardrobeGoal,
  });
  const forgotten = useQuery({
    queryKey: wardrobeKeys.list(forgottenOnly),
    queryFn: ({ signal }) => fetchClothes(forgottenOnly, signal),
    enabled: (stats.data?.forgotten ?? 0) > 0,
  });
  const unworn = forgotten.data?.find((item) => item.status === 'ready');

  const choose = (next: Occasion) => {
    refresh.reset();
    setOccasion(next);
  };
  const addClothes = () => router.push('/add');
  const locateOutcome = locate.data;

  const weatherBlock = forecast ? (
    <WeatherCard weather={forecast} />
  ) : weather.isPending ? (
    <WeatherSkeleton />
  ) : noPlace ? (
    <LocationMissing
      onLocate={() => locate.mutate()}
      locating={locate.isPending}
      onChooseCity={() => router.push('/account/place')}
      problem={locate.isError ? messageFor(locate.error) : locateOutcome === 'denied' || locateOutcome === 'unavailable' ? locationProblems[locateOutcome] : null}
    />
  ) : (
    <WeatherProblem message={messageFor(weather.error)} onRetry={() => void weather.refetch()} retrying={weather.isFetching} />
  );

  const answer = picks.data;
  const proposed = answer?.status === 'proposed' && answer.outfits.length > 0 ? answer.outfits : null;
  // The refresh button belongs to picks that exist or are on their way, not to a wardrobe or a profile that cannot have any.
  const canRefresh = !noPlace && (picks.isPending || refreshing || picks.isError || proposed !== null);

  const picksBody = noPlace ? (
    <AppText color="textSecondary" testID="today-picks-place">
      Once we know where you are, your outfits for the weather show up here.
    </AppText>
  ) : picks.isPending || refreshing ? (
    <PicksSkeleton />
  ) : picks.isError ? (
    <Fade key="problem" style={styles.message} testID="today-picks-problem">
      <AppText color="textSecondary">{messageFor(picks.error)}</AppText>
      {codeOf(picks.error) === 'limit_reached' ? null : (
        <Button label="Try again" kind="secondary" compact inline busy={picks.isFetching} onPress={() => void picks.refetch()} testID="today-picks-retry" />
      )}
    </Fade>
  ) : answer?.status === 'missing_garments' ? (
    <PicksEmpty {...missingNotice(answer.missing, answer.missingEither, answer.weather.feelsMin)} onAdd={addClothes} />
  ) : proposed ? (
    // A new set starts from its first card.
    <PicksCarousel key={proposed[0]?.requestId} outfits={proposed} onOpen={(outfit) => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })} />
  ) : (
    <AppText color="textSecondary" testID="today-picks-none">
      {noOutfits}
    </AppText>
  );

  return (
    <Screen aboveTabBar testID="today-screen">
      <View style={styles.content}>
        <View style={styles.head}>
          <View style={styles.greeting}>
            <AppText variant="secondary" color="textSecondary" testID="today-date">
              {formatCalendarWeekday(day)}
            </AppText>
            <AppText variant="display" accessibilityRole="header" testID="today-greeting">
              {greetingAt(clock?.hour ?? new Date().getHours())}
              {name ? ', ' : ''}
              {name ? (
                <AppText variant="display" color="action">
                  {name}
                </AppText>
              ) : null}
            </AppText>
          </View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.navigate('/profile')}
            style={[styles.initial, { backgroundColor: theme.sage }]}
            testID="today-profile">
            <AppText variant="label" color="onSage">
              {name?.trim().charAt(0).toUpperCase() || '?'}
            </AppText>
          </PressScale>
        </View>

        {weatherBlock}

        {total === 0 ? (
          <PicksEmpty title="Start with your wardrobe" text="Add a few pieces and we’ll put outfits together for the weather and the occasion." onAdd={addClothes} />
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionWords}>
                  <AppText variant="heading" accessibilityRole="header">
                    Today’s picks
                  </AppText>
                  <AppText variant="secondary" color="textSecondary" testID="today-picks-line">
                    {proposed && !refreshing ? picksLine(proposed.length) : 'Outfits from your wardrobe, for this weather'}
                  </AppText>
                </View>
                {canRefresh ? (
                  <IconButton
                    icon="refresh"
                    label="Suggest new outfits"
                    outlined
                    busy={refreshing || picks.isFetching}
                    onPress={() => refresh.mutate({ occasion, key: picksKey })}
                    testID="today-refresh"
                  />
                ) : null}
              </View>
              {refresh.isError && !refreshing ? (
                <Fade key="refused" exit duration={motion.exit}>
                  <AppText variant="secondary" color="textSecondary" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="today-limit">
                    {messageFor(refresh.error)}
                  </AppText>
                </Fade>
              ) : null}
              {picksBody}
            </View>

            <View style={styles.section}>
              <AppText variant="subheading" accessibilityRole="header">
                Dressing for something else?
              </AppText>
              <OccasionPills occasion={occasion} onOccasion={choose} />
            </View>
          </>
        )}

        {total !== undefined && total > 0 && total < wardrobeGoal ? <WardrobeNudge total={total} recent={recent.data ?? []} onAdd={addClothes} /> : null}

        {unworn ? <ForgottenCard item={unworn} onStyle={() => router.push({ pathname: '/occasion', params: { base: unworn.id } })} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] + space[1] },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] },
  greeting: { flex: 1, gap: 2 },
  initial: { width: size.touch, height: size.touch, borderRadius: size.touch / 2, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space[3] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  sectionWords: { flex: 1 },
  message: { gap: space[3], alignItems: 'flex-start' },
});
