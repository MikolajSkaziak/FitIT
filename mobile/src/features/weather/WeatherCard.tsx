import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DayWeather, Weather } from '@/api/weather';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Hairline } from '@/components/Hairline';
import { Icon, SkyBackdrop, type Sky } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Fade, Nudge, Shiver, Spin } from '@/components/motion';
import { motion, space } from '@/theme';

import { advice, formatDegrees, glyphOf, headline, hourSlots, isAhead, placeLine, rangeOf } from './copy';

/** Whether the forecast has already greeted the person in this run of the app. */
let greeted = false;

/** Lets the next forecast to arrive greet again (tests). */
export function resetWeatherGreeting(): void {
  greeted = false;
}

/** True for the one card that is the first to appear in this run of the app, never for a tab switch, a refetch or a re-render. */
function useGreeting(): boolean {
  // Decided on the first render (a read, so safe to repeat) and claimed once the card is really on screen.
  const [greet] = useState(() => !greeted);
  useEffect(() => {
    greeted = true;
  }, []);
  return greet;
}

/** The sky icon's one small act, matching the sky: a drop falls (rain), the sun turns, the cold shivers (snow); cloud does nothing. */
function SkyAct({ sky, play, children }: { sky: Sky; play: boolean; children: ReactNode }) {
  switch (sky) {
    case 'rain':
      return (
        <Nudge dy={3} play={play}>
          {children}
        </Nudge>
      );
    case 'sun':
      return (
        <Spin degrees={45} play={play}>
          {children}
        </Spin>
      );
    case 'snow':
      return <Shiver play={play}>{children}</Shiver>;
    default:
      return <>{children}</>;
  }
}

/**
 * The weather between two hairlines: how it feels now in large serif figures beside one line about the sky and one
 * about what to do, then the hours from now to the evening. Read as one sentence by screen readers. The first time the forecast arrives in a run of the
 * app, the sky icon plays one small act that matches the sky.
 *
 * For a day ahead (`day` names it: "Thursday") there is no "now": the large figure is the warmest the day will feel,
 * labelled "High", the range beside it holds the coldest, and the hours are that day's, each named by its clock.
 */
export function WeatherCard({ weather, day }: { weather: Weather | DayWeather; day?: string }) {
  const summary = headline(weather);
  const greet = useGreeting();
  const ahead = isAhead(weather);
  const slots = hourSlots(weather, ahead);
  const now = weather.hours[0]?.feels ?? weather.feelsMin;
  const figure = ahead ? weather.feelsMax : now;
  const when = day ?? 'that day';
  const spoken = [
    ahead
      ? `${placeLine(weather)}, ${when}. Feels like ${rangeOf(weather)}. ${summary}. ${advice(weather)}`
      : `${placeLine(weather)}. ${formatDegrees(now)} now, feels like ${rangeOf(weather)} today. ${summary}. ${advice(weather)}`,
    ...slots.slice(ahead ? 0 : 1).map((slot) => `${slot.label}: ${slot.value}.`),
  ].join(' ');

  return (
    <Fade>
      <View style={styles.block} accessible accessibilityLabel={spoken} testID="weather-row">
        <Hairline />
        <View style={styles.now}>
          <View>
            {ahead ? (
              <AppText variant="eyebrow" testID="weather-high">
                High
              </AppText>
            ) : null}
            <AppText variant="figure" tabular testID="weather-now">
              {formatDegrees(figure)}
            </AppText>
          </View>
          <View style={styles.words}>
            <View style={styles.sky}>
              <SkyAct sky={glyphOf(weather.sky)} play={greet}>
                <SkyBackdrop sky={glyphOf(weather.sky)} size={20} color="text" />
              </SkyAct>
              <AppText variant="title" numberOfLines={1} style={styles.shrink}>
                {summary}
              </AppText>
            </View>
            <AppText variant="secondary" color="textSecondary">
              <AppText variant="secondary" color="textSecondary" numberOfLines={1}>
                {placeLine(weather)}
              </AppText>
              {' · '}
              <AppText variant="secondary" color="textSecondary" testID="weather-range">
                Feels like {rangeOf(weather)}. {advice(weather)}
              </AppText>
            </AppText>
          </View>
        </View>
        {slots.length > 0 ? (
          <View style={styles.hours} testID="weather-hours">
            {slots.map((slot) => (
              <View key={slot.key} style={styles.hour}>
                <AppText variant="eyebrow" numberOfLines={1}>
                  {slot.label}
                </AppText>
                <View style={styles.value}>
                  {slot.wet ? <Icon name="drop" size={12} color="textSecondary" /> : null}
                  <AppText variant="caption" numberOfLines={1} tabular>
                    {slot.value}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Hairline />
      </View>
    </Fade>
  );
}

/** The block as it will look, while the forecast is on its way. Close to its height, so little below it moves. */
export function WeatherSkeleton() {
  return (
    <Fade enter={false} exit duration={motion.exit}>
      <View style={styles.block} accessibilityRole="progressbar" accessibilityLabel="Checking the weather" testID="weather-loading">
        <Hairline />
        <View style={styles.now}>
          <Skeleton height={56} width={96} />
          <View style={styles.words}>
            <Skeleton height={20} width="80%" />
            <Skeleton height={16} width="60%" />
          </View>
        </View>
        <Skeleton height={32} />
        <Hairline />
      </View>
    </Fade>
  );
}

/** What the weather says in place of a forecast, between the same two hairlines. */
function Notice({ title, text, children, testID }: { title: string; text: string; children: ReactNode; testID: string }) {
  return (
    <Fade>
      <View style={styles.block} testID={testID}>
        <Hairline />
        <View style={styles.noticeWords}>
          <View style={styles.sky}>
            <SkyBackdrop sky="cloud" size={20} color="text" />
            <AppText variant="title" accessibilityRole="header" style={styles.shrink}>
              {title}
            </AppText>
          </View>
          <AppText variant="secondary" color="textSecondary">
            {text}
          </AppText>
        </View>
        {children}
        <Hairline />
      </View>
    </Fade>
  );
}

interface LocationMissingProps {
  onLocate: () => void;
  locating: boolean;
  onChooseCity: () => void;
  problem?: string | null;
}

/** No place to check the weather for: the way out is two steps, the phone or a city. */
export function LocationMissing({ onLocate, locating, onChooseCity, problem }: LocationMissingProps) {
  return (
    <Notice title="Where should we check the weather?" text="Turn on location or choose a city, and we’ll pick outfits to match the weather." testID="weather-no-place">
      <View style={styles.actions}>
        <Button label="Turn on location" icon="location" compact inline busy={locating} onPress={onLocate} testID="weather-locate" />
        <LinkText label="Choose a city" onPress={onChooseCity} testID="weather-choose-city" />
      </View>
      <FormError message={problem} />
    </Notice>
  );
}

interface WeatherProblemProps {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

/** The forecast could not be fetched: what happened, and a way to try again. */
export function WeatherProblem({ message, onRetry, retrying }: WeatherProblemProps) {
  return (
    <Notice title="We couldn’t get the weather" text={message} testID="weather-problem">
      <Button label="Try again" kind="secondary" compact inline busy={retrying} onPress={onRetry} testID="weather-retry" />
    </Notice>
  );
}

const styles = StyleSheet.create({
  block: { gap: 14 },
  now: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  words: { flex: 1, gap: space[1] },
  sky: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  shrink: { flexShrink: 1 },
  hours: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] },
  hour: { gap: space[1] },
  value: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  noticeWords: { gap: space[1] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
});
