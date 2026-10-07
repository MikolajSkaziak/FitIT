import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { PlaceMatch } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { PlaceSearch } from '@/components/PlaceSearch';
import { messageFor } from '@/copy/errors';
import { EditScreen } from '@/features/profile/EditScreen';
import { locationProblems } from '@/features/weather/copy';
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
  const problem = locate.isError ? messageFor(locate.error) : outcome === 'denied' || outcome === 'unavailable' ? locationProblems[outcome] : null;

  return (
    <EditScreen
      title="Miejsce pogody"
      lead="Zestawy dobieramy do pogody w tym miejscu."
      actionLabel="Zapisz miasto"
      busy={choose.isPending}
      error={choose.error}
      notice={missing && !city ? 'Wybierz miejscowość z listy.' : null}
      onAction={() => (city ? choose.mutate(city, { onSuccess: () => router.back() }) : setMissing(true))}
      testID="edit-place">
      <View style={styles.body}>
        {place ? (
          <AppText variant="secondary" color="textSecondary" testID="place-current">
            Teraz: {place.name}, {place.source === 'device' ? 'według lokalizacji telefonu' : 'wybrane miasto'}.
          </AppText>
        ) : null}
        <View style={styles.device}>
          <Button
            label="Użyj lokalizacji telefonu"
            icon="location"
            kind="secondary"
            busy={locate.isPending}
            onPress={() => locate.mutate(undefined, { onSuccess: (result) => result === 'saved' && router.back() })}
            testID="place-locate"
          />
          <FormError message={problem} />
          {outcome === 'denied' ? <LinkText label="Otwórz ustawienia telefonu" onPress={() => void Linking.openSettings()} testID="place-settings" /> : null}
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
