import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ThermalChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { messageFor } from '@/copy/errors';
import { useRegistrationDraft } from '@/features/registration/draft';
import { LegalNote } from '@/features/registration/LegalNote';
import { useRegister } from '@/features/registration/useRegister';
import { WizardStep } from '@/features/registration/WizardStep';
import { findDevicePlace } from '@/lib/location';
import { space } from '@/theme';

const locationUnavailable = 'Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wpisz miasto.';

export default function RegisterWeather() {
  const router = useRouter();
  const thermalPreference = useRegistrationDraft((draft) => draft.thermalPreference);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const registration = useRegister();
  const [locating, setLocating] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const createAccount = async () => {
    if (!registration.ready()) {
      return;
    }

    registration.clearError();
    setUnavailable(false);
    setLocating(true);
    const found = await findDevicePlace();
    setLocating(false);

    if (found.kind === 'found') {
      registration.submit({ ...found.place, source: 'device' });
    } else if (found.kind === 'denied') {
      // The answer was no, which is fine: the city screen asks for the one thing we still need.
      router.push('/register/city');
    } else {
      setUnavailable(true);
    }
  };

  return (
    <WizardStep
      step={5}
      title="Pogoda tam, gdzie jesteś"
      lead="Zestawy dobieramy do pogody w Twojej okolicy. Nie musisz podawać miasta."
      testID="register-weather"
      footer={
        <>
          <LegalNote />
          <FormError message={unavailable ? locationUnavailable : registration.error ? messageFor(registration.error) : null} />
          <Button label="Załóż konto" busy={locating || registration.pending} onPress={() => void createAccount()} testID="register-submit" />
          <LinkText label="Wolę wpisać miasto" center onPress={() => router.push('/register/city')} testID="register-city-link" />
        </>
      }>
      <View style={styles.body}>
        <View style={styles.info}>
          <Icon name="location" color="action" />
          <View style={styles.infoText}>
            <AppText variant="label" accessibilityRole="header">
              Użyjemy lokalizacji telefonu
            </AppText>
            <AppText variant="secondary" color="textSecondary">
              Za chwilę telefon zapyta o zgodę. Wystarczy przybliżona lokalizacja, sprawdzamy tylko pogodę.
            </AppText>
          </View>
        </View>
        <ThermalChoice value={thermalPreference} onChange={(value) => setDraft({ thermalPreference: value })} />
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  infoText: { flex: 1, gap: space[1] },
});
