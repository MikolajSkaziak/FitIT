import { StyleSheet, View } from 'react-native';

import type { Weather } from '@/api/weather';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Icon, SkyGlyph } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { space } from '@/theme';

import { advice, glyphOf, headline, placeLine, rangeOf, skyNames } from './copy';

/** The weather without a box: place, temperature, one line about the sky, one line of advice, and the sky itself on the right. */
export function WeatherRow({ weather }: { weather: Weather }) {
  const summary = headline(weather);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${placeLine(weather)}. Odczuwalnie ${rangeOf(weather)}. ${summary}. ${advice(weather)}`} testID="weather-row">
      <View style={styles.words}>
        <View style={styles.place}>
          <Icon name="location" size={16} color="textSecondary" />
          <AppText variant="secondaryStrong" color="textSecondary" numberOfLines={1} style={styles.placeName}>
            {placeLine(weather)}
          </AppText>
        </View>
        <AppText variant="display" tabular testID="weather-range">
          {rangeOf(weather)}
        </AppText>
        <View style={styles.sky}>
          <AppText variant="subheading">{summary}</AppText>
          <AppText color="textSecondary">{advice(weather)}</AppText>
        </View>
      </View>
      <SkyGlyph sky={glyphOf(weather.sky)} label={skyNames[weather.sky]} />
    </View>
  );
}

/** The row as it will look, while the forecast is on its way. Same height, so nothing below it moves. */
export function WeatherSkeleton() {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Sprawdzamy pogodę" testID="weather-loading">
      <View style={styles.words}>
        <Skeleton height={16} width={96} />
        <Skeleton height={38} width={160} />
        <View style={styles.sky}>
          <Skeleton height={20} width="80%" />
          <Skeleton height={16} width="60%" />
        </View>
      </View>
      <Skeleton height={80} width={80} radius={40} />
    </View>
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
    <View style={styles.row} testID="weather-no-place">
      <View style={styles.words}>
        <View style={styles.sky}>
          <AppText variant="subheading" accessibilityRole="header">
            Nie wiemy, gdzie sprawdzić pogodę
          </AppText>
          <AppText color="textSecondary">Włącz lokalizację albo wpisz miasto, a dobierzemy zestaw do pogody.</AppText>
        </View>
        <View style={styles.actions}>
          <Button label="Włącz lokalizację" icon="location" compact inline busy={locating} onPress={onLocate} testID="weather-locate" />
          <LinkText label="Wpisz miasto" onPress={onChooseCity} testID="weather-choose-city" />
        </View>
        <FormError message={problem} />
      </View>
      <SkyGlyph sky="cloud" size={80} muted label="Nie znamy pogody" />
    </View>
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
    <View style={styles.row} testID="weather-problem">
      <View style={styles.words}>
        <View style={styles.sky}>
          <AppText variant="subheading" accessibilityRole="header">
            Nie znamy dziś pogody
          </AppText>
          <AppText color="textSecondary">{message}</AppText>
        </View>
        <Button label="Spróbuj ponownie" kind="secondary" compact inline busy={retrying} onPress={onRetry} testID="weather-retry" />
      </View>
      <SkyGlyph sky="cloud" size={80} muted label="Nie znamy pogody" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[4] },
  words: { flex: 1, gap: space[2] },
  place: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  placeName: { flexShrink: 1 },
  sky: { gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
});
