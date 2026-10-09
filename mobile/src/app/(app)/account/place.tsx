import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlaceMatch } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PlaceSearch } from '@/components/PlaceSearch';
import { messageFor } from '@/copy/errors';
import { EditScreen } from '@/features/profile/EditScreen';
import { LocationProblem } from '@/features/weather/LocationProblem';
import { useChooseCity, useLocate } from '@/features/weather/place';
import { space } from '@/theme';

/** Where the weather is checked: the phone's own position, or a city picked by hand. */
export default function EditPlace() {
  const router = useRouter();
  const place = useSession((session) => session.user?.location);
  const [city, setCity] = useState<PlaceMatch | null>(null);
  const [missing, setMissing] = useState(false);
  const locate = useLocate();
  const choose = useChooseCity();

  const outcome = locate.data;

  return (
    <EditScreen
      title="Weather location"
      lead="We pick outfits for the weather in this place."
      actionLabel="Save city"
      busy={choose.isPending}
      error={choose.error}
      notice={missing && !city ? 'Pick a place from the list.' : null}
      onAction={() => (city ? choose.mutate(city, { onSuccess: () => router.back() }) : setMissing(true))}
      testID="edit-place">
      <View style={styles.body}>
        {place ? (
          <AppText variant="secondary" color="textSecondary" testID="place-current">
            Now: {place.name}, {place.source === 'device' ? 'from your phone’s location' : 'chosen city'}.
          </AppText>
        ) : null}
        <View style={styles.device}>
          <Button
            label="Use phone location"
            icon="location"
            kind="secondary"
            busy={locate.isPending}
            onPress={() => locate.mutate(undefined, { onSuccess: (result) => result === 'saved' && router.back() })}
            testID="place-locate"
          />
          <LocationProblem outcome={outcome === 'denied' || outcome === 'unavailable' ? outcome : null} message={locate.isError ? messageFor(locate.error) : null} />
        </View>
        <PlaceSearch
          value={city}
          onChange={(next) => {
            setCity(next);
            setMissing(false);
          }}
        />
      </View>
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4] },
  device: { gap: space[1] },
});
