import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Weather } from '@/api/weather';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Icon, SkyBackdrop } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Fade } from '@/components/motion';
import { motion, radius, space, useTheme } from '@/theme';

import { advice, formatDegrees, glyphOf, headline, hourSlots, placeLine, rangeOf } from './copy';

/** How strongly the quiet parts of the card show against its green: the sky behind the words, the rule, and the labels of the hours. */
const faint = { sky: 0.2, rule: 0.22, label: 0.8 } as const;

/**
 * Today's weather on the one green card of the app: the place, what it feels like now, one line about the sky, one
 * about what to do, and the hours from now to the evening. Read as one sentence by screen readers.
 */
export function WeatherCard({ weather }: { weather: Weather }) {
  const theme = useTheme();
  const summary = headline(weather);
  const slots = hourSlots(weather);
  const now = weather.hours[0]?.feels ?? weather.feelsMin;
  const spoken = [
    `${placeLine(weather)}. ${formatDegrees(now)} now, feels like ${rangeOf(weather)} today. ${summary}. ${advice(weather)}`,
    ...slots.slice(1).map((slot) => `${slot.label}: ${slot.value}.`),
  ].join(' ');

  return (
    <Fade>
      <View style={[styles.card, styles.forecast, { backgroundColor: theme.action }]} accessible accessibilityLabel={spoken} testID="weather-row">
        <View style={[styles.backdrop, { opacity: faint.sky }]}>
          <SkyBackdrop sky={glyphOf(weather.sky)} />
        </View>
        <View style={styles.place}>
          <Icon name="pin" size={16} color="onAction" />
          <AppText variant="secondaryStrong" color="onAction" numberOfLines={1} style={styles.shrink}>
            {placeLine(weather)}
          </AppText>
        </View>
        <View style={styles.now}>
          <AppText variant="figure" color="onAction" tabular testID="weather-now">
            {formatDegrees(now)}
          </AppText>
          <View style={styles.words}>
            <AppText variant="label" color="onAction">
              {summary}
            </AppText>
            <AppText variant="secondary" color="onAction" testID="weather-range">
              Feels like {rangeOf(weather)}. {advice(weather)}
            </AppText>
          </View>
        </View>
        {slots.length > 0 ? (
          <View style={styles.hours} testID="weather-hours">
            <View style={[styles.rule, { backgroundColor: theme.onAction, opacity: faint.rule }]} />
            {slots.map((slot) => (
              <View key={slot.key} style={styles.hour}>
                <AppText variant="secondary" color="onAction" numberOfLines={1} style={{ opacity: faint.label }}>
                  {slot.label}
                </AppText>
                <AppText variant="secondaryStrong" color="onAction" numberOfLines={1} tabular>
                  {slot.value}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Fade>
  );
}

/** The card as it will look, while the forecast is on its way. Close to its height, so little below it moves. */
export function WeatherSkeleton() {
  const theme = useTheme();
  return (
    <Fade enter={false} exit duration={motion.exit}>
      <View
        style={[styles.card, styles.forecast, styles.quiet, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Checking the weather"
        testID="weather-loading">
        <Skeleton height={16} width={96} />
        <View style={styles.now}>
          <Skeleton height={56} width={96} />
          <View style={styles.words}>
            <Skeleton height={20} width="80%" />
            <Skeleton height={16} width="60%" />
          </View>
        </View>
        <Skeleton height={42} />
      </View>
    </Fade>
  );
}

/** The sage card the weather speaks from when it has no forecast to show. */
function Notice({ title, text, children, testID }: { title: string; text: string; children: ReactNode; testID: string }) {
  const theme = useTheme();
  return (
    <Fade>
      <View style={[styles.card, styles.notice, { backgroundColor: theme.sage }]} testID={testID}>
        <View style={[styles.backdrop, { opacity: faint.sky }]}>
          <SkyBackdrop sky="cloud" color="onSage" />
        </View>
        <View style={styles.noticeWords}>
          <AppText variant="subheading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="secondary" color="onSage">
            {text}
          </AppText>
        </View>
        {children}
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
  card: { borderRadius: radius.card, overflow: 'hidden' },
  forecast: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, gap: 14 },
  quiet: { borderWidth: 1 },
  notice: { padding: space[4], gap: space[3] },
  noticeWords: { gap: 2, paddingRight: space[12] },
  backdrop: { position: 'absolute', right: -18, top: -22 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  now: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  words: { flex: 1, paddingBottom: space[1] },
  hours: { flexDirection: 'row', gap: space[2], paddingTop: space[3] },
  rule: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  hour: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
});
