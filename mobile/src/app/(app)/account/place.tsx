import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { PlaceMatch } from '@/api/account';
import { weatherKeys, type Weather } from '@/api/weather';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Hairline } from '@/components/Hairline';
import { SkyBackdrop } from '@/components/Icon';
import { Row } from '@/components/lists';
import { PlaceSearch } from '@/components/PlaceSearch';
import { messageFor } from '@/copy/errors';
import { EditScreen } from '@/features/profile/EditScreen';
import { LabelHero } from '@/features/profile/LabelHero';
import { LocationProblem } from '@/features/weather/LocationProblem';
import { formatDegrees, glyphOf, headline } from '@/features/weather/copy';
import { useChooseCity, useLocate } from '@/features/weather/place';
import { space, useTheme } from '@/theme';

/** Where the weather is checked: the phone's own position, or a city picked by hand. */
export default function EditPlace() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const place = useSession((session) => session.user?.location);
  const [city, setCity] = useState<PlaceMatch | null>(null);
  const [missing, setMissing] = useState(false);
  const locate = useLocate();
  const choose = useChooseCity();

  const outcome = locate.data;
  // The forecast Today already holds for the saved place; nothing is asked for here, and a city not yet saved has none to show.
  const forecast = city ? undefined : queryClient.getQueryData<Weather>(weatherKeys.today);
  const now = forecast ? (forecast.hours[0]?.feels ?? forecast.feelsMin) : null;

  return (
    <EditScreen
      title="Weather for"
      hero={
        <LabelHero
          value={city?.name ?? place?.name ?? 'Not set'}
          eyebrow="Profile · weather for"
          note={
            forecast && now !== null ? (
              <View style={styles.sky}>
                <SkyBackdrop sky={glyphOf(forecast.sky)} size={12} color="textSecondary" />
                <AppText variant="caption" color="textSecondary">
                  {formatDegrees(now)} · {headline(forecast)}
                </AppText>
              </View>
            ) : null
          }
        />
      }
      actionLabel="Save"
      busy={choose.isPending}
      error={choose.error}
      notice={missing && !city ? 'Pick a place from the list.' : null}
      onAction={() => (city ? choose.mutate(city, { onSuccess: () => router.back() }) : setMissing(true))}
      testID="edit-place">
      {place ? (
        <AppText variant="secondary" color="textSecondary" testID="place-current">
          Now: {place.name}, {place.source === 'device' ? 'from your phone’s location' : 'chosen city'}.
        </AppText>
      ) : null}
      <View style={styles.device}>
        <View>
          <Hairline />
          <Row
            label="Use phone location"
            meta="Follows you when you travel"
            icon="pin"
            iconColor="textSecondary"
            right={locate.isPending ? <ActivityIndicator size="small" color={theme.textSecondary} /> : undefined}
            onPress={() => {
              if (!locate.isPending) {
                locate.mutate(undefined, { onSuccess: (result) => result === 'saved' && router.back() });
              }
            }}
            testID="place-locate"
          />
        </View>
        <LocationProblem outcome={outcome === 'denied' || outcome === 'unavailable' ? outcome : null} message={locate.isError ? messageFor(locate.error) : null} />
      </View>
      <PlaceSearch
        value={city}
        onChange={(next) => {
          setCity(next);
          setMissing(false);
        }}
      />
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  device: { gap: space[1] },
  sky: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
