import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlaceMatch } from '@/api/account';
import { Button } from '@/components/Button';
import { ThermalChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { PlaceSearch } from '@/components/PlaceSearch';
import { messageFor } from '@/copy/errors';
import { useRegistrationDraft } from '@/features/registration/draft';
import { LegalNote } from '@/features/registration/LegalNote';
import { useRegister } from '@/features/registration/useRegister';
import { WizardStep } from '@/features/registration/WizardStep';
import { roundCoordinate } from '@/lib/location';
import { space } from '@/theme';

export default function RegisterCity() {
  const router = useRouter();
  const thermalPreference = useRegistrationDraft((draft) => draft.thermalPreference);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const registration = useRegister();
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [missing, setMissing] = useState(false);

  const createAccount = (withPlace: boolean) => {
    if (withPlace && !place) {
      setMissing(true);
      return;
    }

    if (registration.ready()) {
      registration.submit(
        withPlace && place ? { source: 'manual', name: place.name, lat: roundCoordinate(place.lat), lon: roundCoordinate(place.lon) } : null,
      );
    }
  };

  return (
    <WizardStep
      step={5}
      title="Wpisz miasto"
      lead="Bez dostępu do lokalizacji sprawdzimy pogodę dla wybranego miasta."
      testID="register-city"
      footer={
        <>
          <LegalNote />
          <FormError message={registration.error ? messageFor(registration.error) : null} />
          <Button label="Załóż konto" busy={registration.pending} onPress={() => createAccount(true)} testID="register-submit" />
          <LinkText label="Pomiń, ustawię później" center onPress={() => createAccount(false)} testID="register-skip-place" />
        </>
      }>
      <View style={styles.body}>
        <View>
          <PlaceSearch
            value={place}
            onChange={(next) => {
              setPlace(next);
              setMissing(false);
              registration.clearError();
            }}
            error={missing && !place ? 'Wybierz miejscowość z listy.' : null}
          />
          <LinkText label="Użyj lokalizacji telefonu" onPress={() => router.back()} />
        </View>
        <ThermalChoice value={thermalPreference} onChange={(value) => setDraft({ thermalPreference: value })} />
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
});
