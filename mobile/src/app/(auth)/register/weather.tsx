import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlaceMatch } from '@/api/account';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ThermalChoice } from '@/components/choices';
import { LinkText, OptionTile } from '@/components/controls';
import { FormError } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { Fade } from '@/components/motion';
import { PlaceSearch } from '@/components/PlaceSearch';
import { messageFor } from '@/copy/errors';
import { flow } from '@/features/flow';
import { useRegistrationDraft } from '@/features/registration/draft';
import { LegalNote } from '@/features/registration/LegalNote';
import { useRegister, type WeatherPlace } from '@/features/registration/useRegister';
import { WizardStep } from '@/features/registration/WizardStep';
import { LocationProblem } from '@/features/weather/LocationProblem';
import { findDevicePlace, roundCoordinate, type Place } from '@/lib/location';
import { space } from '@/theme';

type Method = 'device' | 'city';
type Device = { status: 'idle' | 'locating' | 'denied' | 'unavailable' } | { status: 'found'; place: Place };

/** Step 6 of 9: where the weather is checked, by the phone's location or a city. Its button creates the account; the steps after it carry on signed in, in the same frame. */
export default function RegisterWeather() {
  const thermalPreference = useRegistrationDraft((draft) => draft.thermalPreference);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const registration = useRegister();
  const [method, setMethod] = useState<Method | null>(null);
  const [device, setDevice] = useState<Device>({ status: 'idle' });
  const [city, setCity] = useState<PlaceMatch | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);

  const place: WeatherPlace =
    method === 'device' && device.status === 'found'
      ? { ...device.place, source: 'device' }
      : method === 'city' && city
        ? { source: 'manual', name: city.name, lat: roundCoordinate(city.lat), lon: roundCoordinate(city.lon) }
        : null;

  const pickDevice = async () => {
    registration.clearError();
    setMethod('device');
    if (device.status === 'found' || device.status === 'locating') {
      return;
    }

    setDevice({ status: 'locating' });
    const found = await findDevicePlace();
    if (found.kind === 'found') {
      setDevice({ status: 'found', place: found.place });
    } else {
      // No is a fine answer: the city search takes over right here, with the reason above it.
      setDevice({ status: found.kind });
      setFocusSearch(false);
      setMethod('city');
    }
  };

  const chooseCity = () => {
    registration.clearError();
    setFocusSearch(true);
    setMethod('city');
  };

  const create = (chosen: WeatherPlace) => {
    if (!registration.pending && registration.ready()) {
      registration.clearError();
      registration.submit(chosen);
    }
  };

  return (
    <WizardStep
      step={flow.weather}
      title="Weather where you are"
      lead="Outfits follow the local weather, so we need a place. We only keep an approximate one."
      testID="register-weather"
      footer={
        <>
          <FormError message={registration.error ? messageFor(registration.error) : null} />
          {place ? null : (
            <AppText variant="meta" color="textSecondary" align="center">
              Choose how to set your place, or skip it for now.
            </AppText>
          )}
          <Button label="Create account" disabled={!place} busy={registration.pending} onPress={() => create(place)} testID="register-submit" />
          <LegalNote />
          <LinkText label="Skip, I’ll set it later" center onPress={() => create(null)} testID="register-skip-place" />
        </>
      }>
      <View style={styles.body}>
        <View style={styles.location}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Where to check the weather" style={styles.choices}>
            <OptionTile icon="location" label="Use my location" selected={method === 'device'} onPress={() => void pickDevice()} testID="register-use-location" />
            <OptionTile icon="search" label="Choose a city instead" selected={method === 'city'} onPress={chooseCity} testID="register-choose-city" />
          </View>
          {device.status === 'locating' ? (
            <AppText variant="secondary" color="textSecondary" accessibilityRole="progressbar" accessibilityLabel="Finding your location">
              Finding your location…
            </AppText>
          ) : null}
          {method === 'device' && device.status === 'found' ? (
            <Fade key="found" style={styles.found}>
              <Icon name="check" size={20} color="action" />
              <AppText variant="secondary" style={styles.foundText} testID="register-found">
                {device.place.name}
              </AppText>
            </Fade>
          ) : null}
          <LocationProblem outcome={device.status === 'denied' || device.status === 'unavailable' ? device.status : null} />
          {method === 'city' ? (
            <Fade key="city">
              <PlaceSearch value={city} onChange={setCity} autoFocus={focusSearch} />
            </Fade>
          ) : null}
        </View>
        <ThermalChoice value={thermalPreference} onChange={(value) => setDraft({ thermalPreference: value })} />
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
  location: { gap: space[3] },
  choices: { gap: space[2] },
  found: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  foundText: { flex: 1 },
});
