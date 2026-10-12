import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { fetchTodaysOutfits, outfitKeys, type Occasion } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { fetchWeatherForDay, fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { fetchClothes, fetchWardrobeStats, noFilter, wardrobeKeys, type ClothesFilter } from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Fade, PressScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { calendarCopy, daySectionTitle, horizonDays, suggestLabel } from '@/features/calendar/copy';
import { DayEntries } from '@/features/calendar/DaySection';
import { usePickOutfit } from '@/features/calendar/session';
import { entriesOn, useCalendarActions, useCalendarRange, useCanPlan } from '@/features/calendar/useCalendar';
import { WeekStrip } from '@/features/calendar/WeekStrip';
import { missingNotice, noOutfits } from '@/features/styling/copy';
import { proposalsRoute } from '@/features/styling/request';
import { wardrobeGoal } from '@/features/today/copy';
import { OccasionTabs } from '@/features/today/OccasionTabs';
import { PicksCarousel, PicksEmpty, PicksHead, PicksSkeleton } from '@/features/today/Picks';
import { ColorsNudge, ForgottenCard, WardrobeNudge } from '@/features/today/WardrobeCards';
import { greetingAt, locationProblems } from '@/features/weather/copy';
import { useLocate } from '@/features/weather/place';
import { LocationMissing, WeatherCard, WeatherProblem, WeatherSkeleton } from '@/features/weather/WeatherCard';
import { addDays, formatCalendarWeekday, fromIso, toIso, today, wallClock, weekdayName } from '@/lib/dates';
import { success, useWarning } from '@/lib/haptics';
import { motion, size, space, useTheme } from '@/theme';

const forgottenOnly: ClothesFilter = { ...noFilter, forgotten: true };

export default function Today() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const name = useSession((session) => session.user?.displayName);
  // Known only once the profile is loaded: without it the nudge would flash at people who already have their colours.
  const noColors = useSession((session) => (session.user ? !session.user.colorAnalysis : false));
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const locate = useLocate();
  const canPlan = useCanPlan();
  const pickOutfit = usePickOutfit();
  const calendarActions = useCalendarActions();
  // The day of the week strip the page is turned to; null is today. Coming back to the tab, or to the app, starts from today again.
  const [chosen, setChosen] = useState<string | null>(null);
  const focused = useIsFocused();
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (!focused) {
      setChosen(null);
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setChosen(null);
      }
    });
    return () => subscription.remove();
  }, []);

  const stats = useQuery({ queryKey: wardrobeKeys.stats, queryFn: fetchWardrobeStats });
  const weather = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs });

  const forecast = weather.data;
  // The date and the hour are the ones on the wall at the place the weather is for, not the ones on the phone.
  const clock = forecast ? wallClock(forecast.from) : null;
  const day = clock?.date ?? today();
  const total = stats.data?.total;
  const noPlace = codeOf(weather.error) === 'location_missing';

  // The strip runs from the person's own today for as far as the forecast reaches; a day chosen before midnight that the
  // strip no longer shows falls back to today.
  const todayIso = toIso(day);
  const lastDay = addDays(day, horizonDays - 1);
  const selectedIso = chosen && chosen > todayIso && chosen <= toIso(lastDay) ? chosen : todayIso;
  const selectedDay = fromIso(selectedIso) ?? day;
  const ahead = selectedIso !== todayIso;
  // Asked once the day of the place is known (or the forecast has failed and the phone's date has to do).
  const week = useCalendarRange(day, lastDay, canPlan && !weather.isPending);
  const dayWeather = useQuery({
    queryKey: weatherKeys.day(selectedIso),
    queryFn: () => fetchWeatherForDay(selectedIso),
    staleTime: weatherStaleMs,
    enabled: ahead && !noPlace,
  });
  const dayEntries = entriesOn(week.data, selectedIso);

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
  useWarning(codeOf(picks.error) === 'limit_reached');
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

  const weatherBlock = ahead && !noPlace ? (
    dayWeather.data ? (
      // One card per day, so each arrives with its own fade.
      <WeatherCard key={`weather-${selectedIso}`} weather={dayWeather.data} day={weekdayName(selectedDay)} />
    ) : dayWeather.isError ? (
      <WeatherProblem message={messageFor(dayWeather.error)} onRetry={() => void dayWeather.refetch()} retrying={dayWeather.isFetching} />
    ) : (
      <WeatherSkeleton />
    )
  ) : forecast ? (
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

  // The line over the cards; with cards on show the carousel asks for it with the count of the card in front.
  const head = (counter?: string) => (
    <>
      <PicksHead counter={counter}>
        {canRefresh ? (
          <IconButton
            icon="refresh"
            label="Suggest new outfits"
            color="textSecondary"
            bare
            busy={refreshing || picks.isFetching}
            onPress={() => refresh.mutate({ occasion, key: picksKey })}
            testID="today-refresh"
          />
        ) : null}
      </PicksHead>
      {refresh.isError && !refreshing ? (
        <Fade key="refused" exit duration={motion.exit}>
          <AppText variant="secondary" color="textSecondary" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="today-limit">
            {messageFor(refresh.error)}
          </AppText>
        </Fade>
      ) : null}
    </>
  );
  const withHead = (body: ReactNode) => (
    <>
      {head()}
      {body}
    </>
  );

  const picksBody = noPlace ? (
    withHead(
      <AppText variant="secondary" color="textSecondary" testID="today-picks-place">
        Once we know where you are, your outfits for the weather show up here.
      </AppText>,
    )
  ) : picks.isPending || refreshing ? (
    withHead(<PicksSkeleton />)
  ) : picks.isError ? (
    withHead(
      <Fade key="problem" style={styles.message} testID="today-picks-problem">
        <AppText variant="secondary" color="textSecondary">
          {messageFor(picks.error)}
        </AppText>
        {codeOf(picks.error) === 'limit_reached' ? null : (
          <Button label="Try again" kind="secondary" compact inline busy={picks.isFetching} onPress={() => void picks.refetch()} testID="today-picks-retry" />
        )}
      </Fade>,
    )
  ) : answer?.status === 'missing_garments' ? (
    withHead(<PicksEmpty {...missingNotice(answer.missing, answer.missingEither, answer.weather.feelsMin)} onAdd={addClothes} />)
  ) : proposed ? (
    // A new set starts from its first card.
    <PicksCarousel key={proposed[0]?.requestId} outfits={proposed} head={head} onOpen={(outfit) => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })} />
  ) : (
    withHead(
      <AppText variant="secondary" color="textSecondary" testID="today-picks-none">
        {noOutfits}
      </AppText>,
    )
  );

  const pickSaved = async () => {
    const outfit = await pickOutfit(selectedIso);
    if (outfit && (await calendarActions.add(outfit, selectedIso))) {
      success();
    }
  };

  // A day ahead is dressed for on request: nothing is made, and nothing counted against the day's limit, until the button is pressed.
  const planBody = noPlace ? (
    <AppText variant="secondary" color="textSecondary" testID="today-picks-place">
      Once we know where you are, your outfits for the weather show up here.
    </AppText>
  ) : (
    <>
      <Button label={suggestLabel(selectedDay, day)} icon="sparkle" onPress={() => router.push(proposalsRoute({ occasion, note: '', date: selectedIso }))} testID="today-suggest-day" />
      <LinkText label={calendarCopy.pickSaved} center onPress={() => void pickSaved()} testID="today-pick-saved" />
    </>
  );

  return (
    <Screen aboveTabBar testID="today-screen">
      <View style={styles.content}>
        <View style={styles.head}>
          <View style={styles.greeting}>
            <AppText variant="eyebrow" testID="today-date">
              {formatCalendarWeekday(day).replace(', ', ' · ')}
            </AppText>
            <AppText variant="display" accessibilityRole="header" testID="today-greeting">
              {greetingAt(clock?.hour ?? new Date().getHours())}
              {name ? ',\n' : ''}
              {name ? (
                <AppText variant="displayItalic" color="action">
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
            <AppText variant="title" color="action">
              {name?.trim().charAt(0).toUpperCase() || '?'}
            </AppText>
          </PressScale>
        </View>

        {canPlan ? <WeekStrip today={day} selected={selectedIso} onSelect={setChosen} calendar={week.data} /> : null}

        {weatherBlock}

        {total === 0 ? (
          <PicksEmpty title="Start with your wardrobe" text="Add a few pieces and we’ll put outfits together for the weather and the occasion." onAdd={addClothes} />
        ) : (
          <>
            <OccasionTabs occasion={occasion} onOccasion={choose} />
            <View style={styles.section}>{ahead ? planBody : picksBody}</View>
          </>
        )}

        {/* What stands on the day (worn or planned) comes after the proposals for it: the fresh looks lead, the record follows. */}
        {dayEntries.length > 0 ? (
          <Fade key={`planned-${selectedIso}`} style={styles.section} testID="today-planned">
            <AppText variant="eyebrow" accessibilityRole="header" testID="today-planned-title">
              {daySectionTitle(dayEntries, selectedDay, day)}
            </AppText>
            <DayEntries entries={dayEntries} today={day} size="card" onConfirm={calendarActions.confirm} onRemove={(entry) => void calendarActions.remove(entry)} style={styles.entries} />
          </Fade>
        ) : null}
        <FormError message={calendarActions.error ? messageFor(calendarActions.error) : null} />

        {/* What follows is about the wardrobe as it is now: it belongs to today's own page. */}
        {!ahead && total !== undefined && total > 0 && total < wardrobeGoal ? <WardrobeNudge total={total} recent={recent.data ?? []} onAdd={addClothes} /> : null}

        {!ahead && noColors ? <ColorsNudge onFind={() => router.push({ pathname: '/onboarding/colors', params: { redo: '1' } })} /> : null}

        {!ahead && unworn ? <ForgottenCard item={unworn} onStyle={() => router.push({ pathname: '/occasion', params: { base: unworn.id } })} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] },
  greeting: { flex: 1, gap: space[2] },
  initial: { width: size.touch, height: size.touch, borderRadius: size.touch / 2, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 14 },
  entries: { gap: space[3] },
  message: { gap: space[3], alignItems: 'flex-start' },
});
